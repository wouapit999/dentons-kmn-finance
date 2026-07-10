import { NextRequest } from "next/server";
import { z } from "zod";
import { handle } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/auth";
import { accountBalances } from "@/lib/reports";
import { nlReport, aiConfigured } from "@/lib/ai";
import { writeAudit } from "@/lib/audit";

export const dynamic = "force-dynamic";

const schema = z.object({ question: z.string().min(3).max(500) });
const round = (n: number) => Math.round(n * 100) / 100;

// POST /api/ai/nl-report — answer a finance question grounded in this
// company's real figures (built server-side; the model never queries the DB).
export async function POST(req: NextRequest) {
  return handle(async () => {
    const user = await requirePermission("report:read");
    const { question } = schema.parse(await req.json());

    const year = new Date().getFullYear();
    const balances = await accountBalances(user.companyId, {
      from: new Date(Date.UTC(year, 0, 1)),
      to: new Date(Date.UTC(year, 11, 31, 23, 59, 59)),
    });

    const sumType = (t: string) =>
      round(balances.filter((b) => b.type === t).reduce((s, b) => s + b.balance, 0));

    const [invoices, bills, trust] = await Promise.all([
      prisma.invoice.findMany({
        where: { companyId: user.companyId, status: { in: ["POSTED", "PART_PAID"] } },
        select: { number: true, total: true, amountPaid: true, dueDate: true, client: { select: { name: true } } },
      }),
      prisma.vendorBill.findMany({
        where: { companyId: user.companyId, status: { in: ["POSTED", "PART_PAID"] } },
        select: { number: true, total: true, amountPaid: true, dueDate: true, supplier: { select: { name: true } } },
      }),
      prisma.trustAccount.findMany({
        where: { companyId: user.companyId },
        select: { balance: true, client: { select: { name: true } } },
      }),
    ]);

    const context = {
      currency: "XAF",
      year,
      incomeStatement: {
        revenue: sumType("REVENUE"),
        expenses: sumType("EXPENSE"),
        netResult: round(sumType("REVENUE") - sumType("EXPENSE")),
      },
      balanceSheet: {
        assets: sumType("ASSET"),
        liabilities: sumType("LIABILITY"),
        equity: sumType("EQUITY"),
      },
      accounts: balances.filter((b) => b.balance !== 0).map((b) => ({ code: b.code, name: b.name, type: b.type, balance: b.balance })),
      receivables: invoices.map((i) => ({ number: i.number, client: i.client.name, outstanding: round(Number(i.total) - Number(i.amountPaid)), dueDate: i.dueDate })),
      payables: bills.map((b) => ({ number: b.number, supplier: b.supplier.name, outstanding: round(Number(b.total) - Number(b.amountPaid)), dueDate: b.dueDate })),
      trustBalances: trust.map((t) => ({ client: t.client.name, balance: Number(t.balance) })),
    };

    if (!aiConfigured()) {
      return {
        configured: false,
        answer:
          "AI reporting is not configured. Set the ANTHROPIC_API_KEY environment variable to enable natural-language reporting.",
      };
    }

    const answer = await nlReport(question, context, user.locale);
    await writeAudit({
      companyId: user.companyId,
      actorId: user.id,
      action: "AI_NL_REPORT",
      entityType: "Report",
      entityId: null,
      after: { question },
    });
    return { configured: true, answer };
  });
}

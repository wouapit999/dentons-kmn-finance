import { handle } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/auth";

export const dynamic = "force-dynamic";
const round = (n: number) => Math.round(n * 100) / 100;

// GET /api/insights — deterministic analytics:
//  - duplicate-bill detection (same supplier + amount within 30 days)
//  - cash-flow forecast (AR inflows vs AP outflows by 30/60/90-day horizon)
//  - overdue alerts
// NOTE: OCR and natural-language reporting require an external AI provider
// (e.g. the Claude API) and are intentionally out of scope here.
export async function GET() {
  return handle(async () => {
    const user = await requirePermission("report:read");
    const companyId = user.companyId;
    const now = new Date();
    const days = (n: number) => new Date(now.getTime() + n * 86_400_000);

    const [bills, invoices, openBills] = await Promise.all([
      prisma.vendorBill.findMany({
        where: { companyId },
        include: { supplier: { select: { name: true } } },
        orderBy: { date: "asc" },
      }),
      prisma.invoice.findMany({
        where: { companyId, status: { in: ["POSTED", "PART_PAID"] } },
        include: { client: { select: { name: true } } },
      }),
      prisma.vendorBill.findMany({
        where: { companyId, status: { in: ["POSTED", "PART_PAID"] } },
        include: { supplier: { select: { name: true } } },
      }),
    ]);

    // --- Duplicate detection ---
    const duplicates: { supplier: string; amount: number; bills: string[] }[] = [];
    const seen = new Map<string, { number: string; date: Date }[]>();
    for (const b of bills) {
      const key = `${b.supplierId}:${Number(b.total)}`;
      const arr = seen.get(key) ?? [];
      arr.push({ number: b.number, date: b.date });
      seen.set(key, arr);
    }
    for (const [key, arr] of seen) {
      if (arr.length < 2) continue;
      arr.sort((a, b) => a.date.getTime() - b.date.getTime());
      for (let i = 1; i < arr.length; i++) {
        const gap = (arr[i].date.getTime() - arr[i - 1].date.getTime()) / 86_400_000;
        if (gap <= 30) {
          const b = bills.find((x) => x.number === arr[i].number)!;
          duplicates.push({
            supplier: b.supplier.name,
            amount: Number(b.total),
            bills: [arr[i - 1].number, arr[i].number],
          });
        }
      }
    }

    // --- Cash-flow forecast ---
    const horizon = (dueList: { due: Date; amt: number }[]) => {
      const b = { d30: 0, d60: 0, d90: 0, beyond: 0 };
      for (const x of dueList) {
        if (x.due <= days(30)) b.d30 += x.amt;
        else if (x.due <= days(60)) b.d60 += x.amt;
        else if (x.due <= days(90)) b.d90 += x.amt;
        else b.beyond += x.amt;
      }
      return b;
    };
    const arDue = invoices.map((i) => ({ due: i.dueDate, amt: Number(i.total) - Number(i.amountPaid) })).filter((x) => x.amt > 0);
    const apDue = openBills.map((b) => ({ due: b.dueDate, amt: Number(b.total) - Number(b.amountPaid) })).filter((x) => x.amt > 0);
    const inflow = horizon(arDue);
    const outflow = horizon(apDue);
    const forecast = {
      inflow,
      outflow,
      net: {
        d30: round(inflow.d30 - outflow.d30),
        d60: round(inflow.d60 - outflow.d60),
        d90: round(inflow.d90 - outflow.d90),
      },
    };

    // --- Alerts ---
    const overdueInvoices = arDue.filter((x) => x.due < now);
    const alerts = {
      overdueInvoiceCount: overdueInvoices.length,
      overdueInvoiceAmount: round(overdueInvoices.reduce((s, x) => s + x.amt, 0)),
      duplicateBillCount: duplicates.length,
    };

    return { duplicates, forecast, alerts };
  });
}

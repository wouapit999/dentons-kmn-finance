import { NextRequest } from "next/server";
import { handle } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { requirePermission, AuthError } from "@/lib/auth";
import { createBudgetSchema } from "@/lib/validation";
import { writeAudit } from "@/lib/audit";

export const dynamic = "force-dynamic";

// GET /api/budgets — list budgets.
export async function GET() {
  return handle(async () => {
    const user = await requirePermission("budget:read");
    const budgets = await prisma.budget.findMany({
      where: { companyId: user.companyId },
      orderBy: { createdAt: "desc" },
      include: { lines: true },
    });
    return budgets.map((b) => ({
      id: b.id,
      name: b.name,
      year: b.year,
      status: b.status,
      lines: b.lines.length,
      total: b.lines.reduce((s, l) => s + Number(l.annualAmount), 0),
    }));
  });
}

// POST /api/budgets — create a budget with per-account annual amounts.
export async function POST(req: NextRequest) {
  return handle(async () => {
    const user = await requirePermission("budget:manage");
    const input = createBudgetSchema.parse(await req.json());

    const codes = input.lines.map((l) => l.accountCode);
    const accounts = await prisma.account.findMany({
      where: { companyId: user.companyId, code: { in: codes } },
    });
    const byCode = new Map(accounts.map((a) => [a.code, a]));
    if (accounts.length !== new Set(codes).size) throw new AuthError(422, "invalid_account");

    const created = await prisma.budget.create({
      data: {
        companyId: user.companyId,
        name: input.name,
        year: input.year,
        createdById: user.id,
        lines: {
          create: input.lines.map((l) => ({
            accountCode: l.accountCode,
            accountName: byCode.get(l.accountCode)!.name,
            annualAmount: l.annualAmount,
          })),
        },
      },
    });
    await writeAudit({
      companyId: user.companyId,
      actorId: user.id,
      action: "BUDGET_CREATED",
      entityType: "Budget",
      entityId: created.id,
      after: { name: created.name, year: created.year },
    });
    return { id: created.id };
  });
}

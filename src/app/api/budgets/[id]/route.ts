import { handle } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { requirePermission, AuthError } from "@/lib/auth";
import { accountBalances } from "@/lib/reports";

export const dynamic = "force-dynamic";

const round = (n: number) => Math.round(n * 100) / 100;

// GET /api/budgets/:id — budget lines with actuals & variance from the GL.
// For the budgeted year (Jan 1 – Dec 31) actuals come from POSTED entries.
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  return handle(async () => {
    const user = await requirePermission("budget:read");
    const budget = await prisma.budget.findFirst({
      where: { id: params.id, companyId: user.companyId },
      include: { lines: true },
    });
    if (!budget) throw new AuthError(404, "not_found");

    const from = new Date(Date.UTC(budget.year, 0, 1));
    const to = new Date(Date.UTC(budget.year, 11, 31, 23, 59, 59));
    const balances = await accountBalances(user.companyId, { from, to });
    const actualByCode = new Map(balances.map((b) => [b.code, { balance: b.balance, type: b.type }]));

    const rows = budget.lines.map((l) => {
      const info = actualByCode.get(l.accountCode);
      const actual = info ? info.balance : 0;
      const type = info?.type ?? "EXPENSE";
      const budgeted = Number(l.annualAmount);
      // Favourable variance: under budget for expenses, over target for revenue.
      const variance = type === "REVENUE" ? round(actual - budgeted) : round(budgeted - actual);
      const usedPct = budgeted > 0 ? round((actual / budgeted) * 100) : 0;
      return {
        accountCode: l.accountCode,
        accountName: l.accountName,
        type,
        budget: budgeted,
        actual: round(actual),
        variance,
        usedPct,
        favourable: variance >= 0,
      };
    });

    return {
      id: budget.id,
      name: budget.name,
      year: budget.year,
      status: budget.status,
      rows,
      totals: {
        budget: round(rows.reduce((s, r) => s + r.budget, 0)),
        actual: round(rows.reduce((s, r) => s + r.actual, 0)),
      },
    };
  });
}

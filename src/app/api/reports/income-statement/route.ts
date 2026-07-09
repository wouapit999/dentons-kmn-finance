import { NextRequest } from "next/server";
import { handle } from "@/lib/api";
import { requirePermission } from "@/lib/auth";
import { accountBalances } from "@/lib/reports";

export const dynamic = "force-dynamic";

// GET /api/reports/income-statement?from=&to=
export async function GET(req: NextRequest) {
  return handle(async () => {
    const user = await requirePermission("report:read");
    const fromStr = req.nextUrl.searchParams.get("from");
    const toStr = req.nextUrl.searchParams.get("to");
    const from = fromStr ? new Date(fromStr) : undefined;
    const to = toStr ? new Date(toStr) : undefined;

    const balances = await accountBalances(user.companyId, { from, to });
    const revenue = balances.filter((b) => b.type === "REVENUE" && b.balance !== 0);
    const expense = balances.filter((b) => b.type === "EXPENSE" && b.balance !== 0);

    const revenueTotal = revenue.reduce((s, b) => s + b.balance, 0);
    const expenseTotal = expense.reduce((s, b) => s + b.balance, 0);

    return {
      from: fromStr,
      to: toStr,
      revenue,
      expense,
      revenueTotal: Math.round(revenueTotal * 100) / 100,
      expenseTotal: Math.round(expenseTotal * 100) / 100,
      netResult: Math.round((revenueTotal - expenseTotal) * 100) / 100,
    };
  });
}

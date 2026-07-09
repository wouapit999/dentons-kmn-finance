import { NextRequest } from "next/server";
import { handle } from "@/lib/api";
import { requirePermission } from "@/lib/auth";
import { accountBalances } from "@/lib/reports";

export const dynamic = "force-dynamic";

// GET /api/reports/balance-sheet?asOf=
// Assets = Liabilities + Equity + net result for the period-to-date.
export async function GET(req: NextRequest) {
  return handle(async () => {
    const user = await requirePermission("report:read");
    const asOfStr = req.nextUrl.searchParams.get("asOf");
    const to = asOfStr ? new Date(asOfStr) : undefined;

    const balances = await accountBalances(user.companyId, { to });
    const pick = (t: string) => balances.filter((b) => b.type === t && b.balance !== 0);

    const assets = pick("ASSET");
    const liabilities = pick("LIABILITY");
    const equity = pick("EQUITY");

    const assetTotal = assets.reduce((s, b) => s + b.balance, 0);
    const liabilityTotal = liabilities.reduce((s, b) => s + b.balance, 0);
    const equityBooked = equity.reduce((s, b) => s + b.balance, 0);
    const revenueTotal = balances
      .filter((b) => b.type === "REVENUE")
      .reduce((s, b) => s + b.balance, 0);
    const expenseTotal = balances
      .filter((b) => b.type === "EXPENSE")
      .reduce((s, b) => s + b.balance, 0);
    const netResult = revenueTotal - expenseTotal;
    const equityTotal = equityBooked + netResult;

    const r = (n: number) => Math.round(n * 100) / 100;
    return {
      asOf: asOfStr,
      assets,
      liabilities,
      equity,
      assetTotal: r(assetTotal),
      liabilityTotal: r(liabilityTotal),
      equityBooked: r(equityBooked),
      netResult: r(netResult),
      equityTotal: r(equityTotal),
      liabilitiesPlusEquity: r(liabilityTotal + equityTotal),
      balanced: Math.abs(assetTotal - (liabilityTotal + equityTotal)) < 0.01,
    };
  });
}

import { NextRequest } from "next/server";
import { handle } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { requirePermission, AuthError } from "@/lib/auth";
import { postJournal } from "@/lib/ledger";
import { depreciateSchema } from "@/lib/validation";
import { writeAudit } from "@/lib/audit";

export const dynamic = "force-dynamic";

const round = (n: number) => Math.round(n * 100) / 100;

// POST /api/assets/depreciate — run one month of straight-line depreciation for
// every eligible asset and post a single journal:
//   Dr Depreciation expense (681000)      total
//   Cr Accumulated depreciation (281000)  total
export async function POST(req: NextRequest) {
  return handle(async () => {
    const user = await requirePermission("asset:post");
    const input = depreciateSchema.parse(await req.json());
    const date = new Date(input.date);

    const result = await prisma.$transaction(async (tx) => {
      const assets = await tx.fixedAsset.findMany({
        where: { companyId: user.companyId, status: "ACTIVE" },
      });

      let total = 0;
      let count = 0;
      for (const a of assets) {
        if (a.monthsDepreciated >= a.usefulLifeMonths) continue;
        const cost = Number(a.cost);
        const salvage = Number(a.salvageValue);
        const acc = Number(a.accumulatedDepreciation);
        const monthly = round((cost - salvage) / a.usefulLifeMonths);
        // Don't depreciate below (cost - salvage).
        const remaining = round(cost - salvage - acc);
        const amount = Math.min(monthly, remaining);
        if (amount <= 0) continue;

        await tx.depreciationEntry.create({
          data: {
            companyId: user.companyId,
            assetId: a.id,
            period: input.period,
            date,
            amount,
          },
        });
        await tx.fixedAsset.update({
          where: { id: a.id },
          data: {
            accumulatedDepreciation: round(acc + amount),
            monthsDepreciated: a.monthsDepreciated + 1,
          },
        });
        total += amount;
        count += 1;
      }

      if (count === 0) throw new AuthError(422, "nothing_to_depreciate");
      total = round(total);

      const entry = await postJournal(tx, {
        companyId: user.companyId,
        journalCode: "GEN",
        date,
        description: `Depreciation — ${input.period}`,
        createdById: user.id,
        lines: [
          { accountCode: "681000", debit: total, description: "Depreciation expense" },
          { accountCode: "281000", credit: total, description: "Accumulated depreciation" },
        ],
      });

      // Link the posted entry onto this period's depreciation rows.
      await tx.depreciationEntry.updateMany({
        where: { companyId: user.companyId, period: input.period, postedEntryId: null },
        data: { postedEntryId: entry.id },
      });

      return { count, total, entryNo: entry.entryNo };
    });

    await writeAudit({
      companyId: user.companyId,
      actorId: user.id,
      action: "DEPRECIATION_POSTED",
      entityType: "PayrollRun",
      entityId: null,
      after: { period: input.period, assets: result.count, total: result.total },
    });

    return { ok: true, assets: result.count, total: result.total, entryNo: result.entryNo };
  });
}

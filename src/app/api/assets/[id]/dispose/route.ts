import { NextRequest } from "next/server";
import { handle } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { requirePermission, AuthError } from "@/lib/auth";
import { postJournal } from "@/lib/ledger";
import { disposeAssetSchema } from "@/lib/validation";
import { writeAudit } from "@/lib/audit";

export const dynamic = "force-dynamic";

const round = (n: number) => Math.round(n * 100) / 100;

// POST /api/assets/:id/dispose — remove an asset and recognise gain/loss:
//   Dr Accumulated depreciation (281000)   accumulated
//   Dr Bank (521000)                        proceeds
//   Cr Asset account                        cost
//   Cr Gain on disposal (754000)  OR  Dr Loss on disposal (654000)   balancing
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  return handle(async () => {
    const user = await requirePermission("asset:manage");
    const input = disposeAssetSchema.parse(await req.json());

    const result = await prisma.$transaction(async (tx) => {
      const asset = await tx.fixedAsset.findFirst({
        where: { id: params.id, companyId: user.companyId },
      });
      if (!asset) throw new AuthError(404, "not_found");
      if (asset.status !== "ACTIVE") throw new AuthError(422, "already_disposed");

      const cost = Number(asset.cost);
      const acc = Number(asset.accumulatedDepreciation);
      const proceeds = round(input.proceeds);
      const nbv = round(cost - acc);
      const gainLoss = round(proceeds - nbv);

      const lines = [
        { accountCode: "281000", debit: acc, description: "Remove accumulated depreciation" },
        { accountCode: "521000", debit: proceeds, description: "Disposal proceeds" },
        { accountCode: asset.assetAccountCode, credit: cost, description: `Dispose ${asset.tag}` },
      ];
      if (gainLoss > 0) lines.push({ accountCode: "754000", credit: gainLoss, description: "Gain on disposal" });
      else if (gainLoss < 0) lines.push({ accountCode: "654000", debit: -gainLoss, description: "Loss on disposal" });

      const entry = await postJournal(tx, {
        companyId: user.companyId,
        journalCode: "GEN",
        date: new Date(input.date),
        description: `Disposal of ${asset.tag}`,
        createdById: user.id,
        lines,
      });

      await tx.fixedAsset.update({
        where: { id: asset.id },
        data: { status: "DISPOSED", disposedAt: new Date(input.date) },
      });

      return { asset, gainLoss, entryNo: entry.entryNo };
    });

    await writeAudit({
      companyId: user.companyId,
      actorId: user.id,
      action: "ASSET_DISPOSED",
      entityType: "FixedAsset",
      entityId: result.asset.id,
      after: { tag: result.asset.tag, gainLoss: result.gainLoss, entryNo: result.entryNo },
    });

    return { ok: true, gainLoss: result.gainLoss, entryNo: result.entryNo };
  });
}

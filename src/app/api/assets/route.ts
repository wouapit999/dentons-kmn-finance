import { NextRequest } from "next/server";
import { handle } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { requirePermission, AuthError } from "@/lib/auth";
import { createAssetSchema } from "@/lib/validation";
import { writeAudit } from "@/lib/audit";

export const dynamic = "force-dynamic";

const round = (n: number) => Math.round(n * 100) / 100;

// GET /api/assets — asset register with net book value.
export async function GET() {
  return handle(async () => {
    const user = await requirePermission("asset:read");
    const assets = await prisma.fixedAsset.findMany({
      where: { companyId: user.companyId },
      orderBy: { createdAt: "desc" },
    });
    return assets.map((a) => {
      const cost = Number(a.cost);
      const acc = Number(a.accumulatedDepreciation);
      return {
        id: a.id,
        tag: a.tag,
        name: a.name,
        category: a.category,
        cost,
        salvageValue: Number(a.salvageValue),
        usefulLifeMonths: a.usefulLifeMonths,
        monthsDepreciated: a.monthsDepreciated,
        accumulatedDepreciation: acc,
        netBookValue: round(cost - acc),
        status: a.status,
      };
    });
  });
}

// POST /api/assets — register a fixed asset.
export async function POST(req: NextRequest) {
  return handle(async () => {
    const user = await requirePermission("asset:manage");
    const input = createAssetSchema.parse(await req.json());
    if (input.salvageValue >= input.cost) throw new AuthError(422, "salvage_ge_cost");

    const account = await prisma.account.findFirst({
      where: { companyId: user.companyId, code: input.assetAccountCode, type: "ASSET", isPostable: true },
    });
    if (!account) throw new AuthError(422, "invalid_asset_account");

    const created = await prisma.fixedAsset.create({
      data: {
        companyId: user.companyId,
        tag: input.tag,
        name: input.name,
        category: input.category || null,
        assetAccountCode: input.assetAccountCode,
        acquisitionDate: new Date(input.acquisitionDate),
        cost: input.cost,
        salvageValue: input.salvageValue,
        usefulLifeMonths: input.usefulLifeMonths,
        createdById: user.id,
      },
    });
    await writeAudit({
      companyId: user.companyId,
      actorId: user.id,
      action: "ASSET_REGISTERED",
      entityType: "FixedAsset",
      entityId: created.id,
      after: { tag: created.tag, name: created.name, cost: input.cost },
    });
    return { id: created.id };
  });
}

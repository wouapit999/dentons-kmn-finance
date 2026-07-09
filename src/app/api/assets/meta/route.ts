import { handle } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/auth";

export const dynamic = "force-dynamic";

// GET /api/assets/meta — postable asset accounts (excluding accumulated depreciation).
export async function GET() {
  return handle(async () => {
    const user = await requirePermission("asset:read");
    const accounts = await prisma.account.findMany({
      where: { companyId: user.companyId, type: "ASSET", isPostable: true, status: "ACTIVE" },
      select: { code: true, name: true },
      orderBy: { code: "asc" },
    });
    return {
      assetAccounts: accounts
        .filter((a) => a.code !== "281000")
        .map((a) => ({ code: a.code, name: `${a.code} — ${a.name}` })),
    };
  });
}

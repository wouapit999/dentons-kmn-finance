import { handle } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/auth";

export const dynamic = "force-dynamic";

// GET /api/bank/meta — postable accounts for the counterpart leg.
export async function GET() {
  return handle(async () => {
    const user = await requirePermission("bank:read");
    const accounts = await prisma.account.findMany({
      where: { companyId: user.companyId, isPostable: true, status: "ACTIVE" },
      select: { code: true, name: true },
      orderBy: { code: "asc" },
    });
    return { accounts: accounts.map((a) => ({ code: a.code, name: `${a.code} — ${a.name}` })) };
  });
}

import { handle } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/auth";

export const dynamic = "force-dynamic";

// GET /api/bills/meta — suppliers + expense accounts for the bill form.
export async function GET() {
  return handle(async () => {
    const user = await requirePermission("ap:read");
    const [suppliers, accounts] = await Promise.all([
      prisma.supplier.findMany({
        where: { companyId: user.companyId, status: "ACTIVE" },
        select: { id: true, name: true },
        orderBy: { name: "asc" },
      }),
      prisma.account.findMany({
        where: { companyId: user.companyId, type: "EXPENSE", isPostable: true, status: "ACTIVE" },
        select: { code: true, name: true },
        orderBy: { code: "asc" },
      }),
    ]);
    return {
      suppliers,
      expenseAccounts: accounts.map((a) => ({ code: a.code, name: `${a.code} — ${a.name}` })),
    };
  });
}

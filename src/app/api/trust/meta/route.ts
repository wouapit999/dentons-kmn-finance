import { handle } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/auth";

export const dynamic = "force-dynamic";

// GET /api/trust/meta — clients without a trust account yet (for opening one).
export async function GET() {
  return handle(async () => {
    const user = await requirePermission("trust:read");
    const existing = await prisma.trustAccount.findMany({
      where: { companyId: user.companyId },
      select: { clientId: true },
    });
    const taken = new Set(existing.map((e) => e.clientId));
    const clients = await prisma.client.findMany({
      where: { companyId: user.companyId, deletedAt: null, status: "ACTIVE" },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    });
    return { clients: clients.filter((c) => !taken.has(c.id)) };
  });
}

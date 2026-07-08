import { handle } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/auth";

export const dynamic = "force-dynamic";

// GET /api/matters/meta — options for the matter form:
// KYC-verified, non-blocked clients + practice areas + potential partners.
export async function GET() {
  return handle(async () => {
    const user = await requirePermission("matter:read");
    const [clients, practiceAreas, partners] = await Promise.all([
      prisma.client.findMany({
        where: {
          companyId: user.companyId,
          deletedAt: null,
          kycStatus: "VERIFIED",
          conflictStatus: { not: "BLOCKED" },
        },
        select: { id: true, name: true },
        orderBy: { name: "asc" },
      }),
      prisma.practiceArea.findMany({
        where: { companyId: user.companyId },
        select: { id: true, name: true },
        orderBy: { name: "asc" },
      }),
      prisma.user.findMany({
        where: { companyId: user.companyId, status: "ACTIVE", deletedAt: null },
        select: { id: true, fullName: true },
        orderBy: { fullName: "asc" },
      }),
    ]);
    return { clients, practiceAreas, partners };
  });
}

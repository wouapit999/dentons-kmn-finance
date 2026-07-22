import { handle } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/auth";

export const dynamic = "force-dynamic";

// GET /api/matters/meta — options for the matter form. Returns ALL clients
// with their KYC/conflict status so the UI can show ineligible ones disabled
// with the reason (instead of silently hiding them, which reads as a bug).
// The hard gate stays server-side in POST /api/matters.
export async function GET() {
  return handle(async () => {
    const user = await requirePermission("matter:read");
    const [clients, practiceAreas, partners] = await Promise.all([
      prisma.client.findMany({
        where: { companyId: user.companyId, deletedAt: null },
        select: { id: true, name: true, kycStatus: true, conflictStatus: true },
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

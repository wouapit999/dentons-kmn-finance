import { handle } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/auth";
import { CASE_TYPES } from "@/lib/constants";

export const dynamic = "force-dynamic";

// GET /api/clients/meta — options for the intake wizard.
export async function GET() {
  return handle(async () => {
    const user = await requirePermission("client:read");
    const lawyers = await prisma.user.findMany({
      where: { companyId: user.companyId, status: "ACTIVE", deletedAt: null },
      orderBy: { fullName: "asc" },
      select: { id: true, fullName: true },
    });
    return { lawyers, caseTypes: CASE_TYPES };
  });
}

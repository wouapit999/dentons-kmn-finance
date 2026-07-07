import { handle } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/auth";

export const dynamic = "force-dynamic";

// GET /api/gl/journals — journals + open periods (for the entry form).
export async function GET() {
  return handle(async () => {
    const user = await requirePermission("gl:read");
    const [journals, periods] = await Promise.all([
      prisma.journal.findMany({
        where: { companyId: user.companyId },
        orderBy: { code: "asc" },
      }),
      prisma.accountingPeriod.findMany({
        where: { companyId: user.companyId, status: "OPEN" },
        orderBy: { seq: "asc" },
        include: { fiscalYear: true },
      }),
    ]);
    return {
      journals: journals.map((j) => ({ id: j.id, code: j.code, name: j.name })),
      periods: periods.map((p) => ({
        id: p.id,
        name: `${p.fiscalYear.name} · ${p.name}`,
        status: p.status,
      })),
    };
  });
}

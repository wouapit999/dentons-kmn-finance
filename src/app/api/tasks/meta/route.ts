import { handle } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

// GET /api/tasks/meta — options for the task forms (categories, users, matters, clients).
export async function GET() {
  return handle(async () => {
    const user = await requireUser();
    const [categories, users, matters, clients] = await Promise.all([
      prisma.taskCategory.findMany({
        where: { companyId: user.companyId },
        orderBy: { name: "asc" },
        select: { key: true, name: true, isCourtDeadline: true, isBillable: true },
      }),
      prisma.user.findMany({
        where: { companyId: user.companyId, status: "ACTIVE", deletedAt: null },
        orderBy: { fullName: "asc" },
        select: { id: true, fullName: true },
      }),
      prisma.matter.findMany({
        where: { companyId: user.companyId, status: { not: "CLOSED" } },
        orderBy: { code: "asc" },
        select: { id: true, code: true, name: true },
      }),
      prisma.client.findMany({
        where: { companyId: user.companyId, deletedAt: null, status: "ACTIVE" },
        orderBy: { name: "asc" },
        select: { id: true, name: true },
      }),
    ]);
    return { categories, users, matters, clients };
  });
}

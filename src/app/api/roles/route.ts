import { handle } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/auth";

export const dynamic = "force-dynamic";

// GET /api/roles — roles with their permissions (for the admin console).
export async function GET() {
  return handle(async () => {
    const admin = await requirePermission("role:read");
    const roles = await prisma.role.findMany({
      where: { companyId: admin.companyId },
      orderBy: { hierarchyLevel: "asc" },
      include: {
        rolePermissions: { include: { permission: true } },
        _count: { select: { userRoles: true } },
      },
    });
    return roles.map((r) => ({
      id: r.id,
      key: r.key,
      name: r.name,
      hierarchyLevel: r.hierarchyLevel,
      isSystem: r.isSystem,
      userCount: r._count.userRoles,
      permissions: r.rolePermissions.map((rp) => rp.permission.key),
    }));
  });
}

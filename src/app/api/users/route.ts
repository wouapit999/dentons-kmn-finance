import { NextRequest } from "next/server";
import { handle } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { requirePermission, hashPassword } from "@/lib/auth";
import { createUserSchema } from "@/lib/validation";
import { writeAudit } from "@/lib/audit";

export const dynamic = "force-dynamic";

// GET /api/users — list users in the caller's company.
export async function GET() {
  return handle(async () => {
    const admin = await requirePermission("user:read");
    const users = await prisma.user.findMany({
      where: { companyId: admin.companyId, deletedAt: null },
      orderBy: { createdAt: "desc" },
      include: {
        department: true,
        userRoles: { include: { role: true } },
      },
    });
    return users.map((u) => ({
      id: u.id,
      fullName: u.fullName,
      email: u.email,
      status: u.status,
      locale: u.locale,
      lastLoginAt: u.lastLoginAt,
      department: u.department?.name ?? null,
      roles: u.userRoles.map((ur) => ({ key: ur.role.key, name: ur.role.name })),
    }));
  });
}

// POST /api/users — create a user (IT Administrator only).
export async function POST(req: NextRequest) {
  return handle(async () => {
    const admin = await requirePermission("user:manage");
    const input = createUserSchema.parse(await req.json());

    // Roles must belong to the same company.
    const roles = await prisma.role.findMany({
      where: { id: { in: input.roleIds }, companyId: admin.companyId },
    });
    if (roles.length !== input.roleIds.length) {
      throw new Error("one or more roles are invalid");
    }

    const created = await prisma.user.create({
      data: {
        companyId: admin.companyId,
        fullName: input.fullName,
        email: input.email.toLowerCase(),
        phone: input.phone || null,
        passwordHash: await hashPassword(input.password),
        locale: input.locale,
        currency: input.currency,
        departmentId: input.departmentId || null,
        status: "ACTIVE",
        userRoles: { create: input.roleIds.map((roleId) => ({ roleId })) },
      },
    });

    await writeAudit({
      companyId: admin.companyId,
      actorId: admin.id,
      action: "USER_CREATED",
      entityType: "User",
      entityId: created.id,
      after: { email: created.email, roles: input.roleIds },
    });

    return { id: created.id };
  });
}

import { NextRequest } from "next/server";
import { handle } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { requirePermission, AuthError } from "@/lib/auth";
import { updateUserSchema } from "@/lib/validation";
import { writeAudit } from "@/lib/audit";

async function loadScoped(companyId: string, id: string) {
  const user = await prisma.user.findFirst({
    where: { id, companyId, deletedAt: null },
    include: { userRoles: true },
  });
  if (!user) throw new AuthError(404, "not_found");
  return user;
}

// PATCH /api/users/:id — update profile / status / roles (IT Administrator).
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  return handle(async () => {
    const admin = await requirePermission("user:manage");
    const existing = await loadScoped(admin.companyId, params.id);
    const input = updateUserSchema.parse(await req.json());

    const before = {
      status: existing.status,
      locale: existing.locale,
      roles: existing.userRoles.map((r) => r.roleId),
    };

    await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: existing.id },
        data: {
          fullName: input.fullName,
          phone: input.phone,
          status: input.status,
          locale: input.locale,
          currency: input.currency,
          departmentId: input.departmentId ?? undefined,
          version: { increment: 1 },
        },
      });
      if (input.roleIds) {
        await tx.userRole.deleteMany({ where: { userId: existing.id } });
        await tx.userRole.createMany({
          data: input.roleIds.map((roleId) => ({ userId: existing.id, roleId })),
        });
      }
    });

    await writeAudit({
      companyId: admin.companyId,
      actorId: admin.id,
      action: "USER_UPDATED",
      entityType: "User",
      entityId: existing.id,
      before,
      after: input,
    });

    return { ok: true };
  });
}

// DELETE /api/users/:id — soft-deactivate (never hard delete).
export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  return handle(async () => {
    const admin = await requirePermission("user:manage");
    const existing = await loadScoped(admin.companyId, params.id);
    if (existing.id === admin.id) throw new AuthError(400, "cannot_disable_self");

    await prisma.user.update({
      where: { id: existing.id },
      data: { status: "DISABLED", version: { increment: 1 } },
    });
    await prisma.session.updateMany({
      where: { userId: existing.id, revokedAt: null },
      data: { revokedAt: new Date() },
    });

    await writeAudit({
      companyId: admin.companyId,
      actorId: admin.id,
      action: "USER_DEACTIVATED",
      entityType: "User",
      entityId: existing.id,
      before: { status: existing.status },
      after: { status: "DISABLED" },
    });

    return { ok: true };
  });
}

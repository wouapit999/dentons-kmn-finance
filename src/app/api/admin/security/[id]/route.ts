import { NextRequest } from "next/server";
import { z } from "zod";
import { handle } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { requirePermission, requireUser, hashPassword, AuthError } from "@/lib/auth";
import { validatePassword, pushPasswordHistory, getPolicy } from "@/lib/security";
import { writeAudit } from "@/lib/audit";

export const dynamic = "force-dynamic";

const schema = z.object({
  action: z.enum(["reset", "forceChange", "lock", "unlock", "disableMfa"]),
  password: z.string().optional(),
  mustChange: z.boolean().optional(),
});

// POST /api/admin/security/:id — admin actions on a user's security.
//   reset       -> set a new password (optionally force change at next login)
//   forceChange -> require the user to change password at next login
//   lock/unlock -> manual account lock
//   disableMfa  -> clear the user's MFA (recovery when a device is lost)
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  return handle(async () => {
    // reset uses the dedicated permission; the rest require security:admin.
    const input = schema.parse(await req.json());
    const admin =
      input.action === "reset"
        ? await requireAny(["user:reset_password", "security:admin"])
        : await requirePermission("security:admin");

    const target = await prisma.user.findFirst({
      where: { id: params.id, companyId: admin.companyId, deletedAt: null },
    });
    if (!target) throw new AuthError(404, "not_found");

    switch (input.action) {
      case "reset": {
        if (!input.password) throw new AuthError(422, "password_required");
        const violation = await validatePassword(admin.companyId, target.id, input.password);
        if (violation) throw new AuthError(422, violation);
        const policy = await getPolicy(admin.companyId);
        const hash = await hashPassword(input.password);
        await prisma.user.update({
          where: { id: target.id },
          data: {
            passwordHash: hash,
            passwordChangedAt: new Date(),
            mustChangePassword: input.mustChange ?? true,
            failedLogins: 0,
            lockedUntil: null,
            version: { increment: 1 },
          },
        });
        await pushPasswordHistory(target.id, target.passwordHash, policy.historyCount);
        await prisma.session.updateMany({
          where: { userId: target.id, revokedAt: null },
          data: { revokedAt: new Date() },
        });
        break;
      }
      case "forceChange":
        await prisma.user.update({ where: { id: target.id }, data: { mustChangePassword: true } });
        break;
      case "lock":
        if (target.id === admin.id) throw new AuthError(400, "cannot_lock_self");
        await prisma.user.update({ where: { id: target.id }, data: { lockedManually: true } });
        await prisma.session.updateMany({
          where: { userId: target.id, revokedAt: null },
          data: { revokedAt: new Date() },
        });
        break;
      case "unlock":
        await prisma.user.update({
          where: { id: target.id },
          data: { lockedManually: false, lockedUntil: null, failedLogins: 0 },
        });
        break;
      case "disableMfa":
        await prisma.user.update({ where: { id: target.id }, data: { mfaEnabled: false, mfaSecretEnc: null } });
        break;
    }

    await writeAudit({
      companyId: admin.companyId,
      actorId: admin.id,
      action: `SEC_${input.action.toUpperCase()}`,
      entityType: "User",
      entityId: target.id,
      after: { by: admin.email },
    });
    return { ok: true };
  });
}

// Small helper: allow the action if the caller holds ANY of the given perms.
async function requireAny(perms: string[]) {
  const user = await requireUser();
  if (!perms.some((p) => user.permissions.has(p))) throw new AuthError(403, "forbidden");
  return user;
}

import { NextRequest } from "next/server";
import { z } from "zod";
import { handle } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { requireUser, verifyPassword, hashPassword, AuthError } from "@/lib/auth";
import { validatePassword, pushPasswordHistory, getPolicy } from "@/lib/security";
import { writeAudit } from "@/lib/audit";

export const dynamic = "force-dynamic";

const schema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(1),
});

// POST /api/me/change-password — a user changes their OWN password.
export async function POST(req: NextRequest) {
  return handle(async () => {
    const user = await requireUser();
    const { currentPassword, newPassword } = schema.parse(await req.json());

    const dbUser = await prisma.user.findUnique({ where: { id: user.id } });
    if (!dbUser) throw new AuthError(404, "not_found");

    if (!(await verifyPassword(currentPassword, dbUser.passwordHash)))
      throw new AuthError(422, "current_password_wrong");
    if (currentPassword === newPassword) throw new AuthError(422, "same_password");

    const violation = await validatePassword(user.companyId, user.id, newPassword);
    if (violation) throw new AuthError(422, violation);

    const policy = await getPolicy(user.companyId);
    const hash = await hashPassword(newPassword);
    await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: user.id },
        data: {
          passwordHash: hash,
          passwordChangedAt: new Date(),
          mustChangePassword: false,
          version: { increment: 1 },
        },
      });
    });
    await pushPasswordHistory(user.id, dbUser.passwordHash, policy.historyCount);

    // Revoke all OTHER sessions on password change (keep the current one).
    await prisma.session.updateMany({
      where: { userId: user.id, revokedAt: null },
      data: { revokedAt: new Date() },
    });

    await writeAudit({
      companyId: user.companyId,
      actorId: user.id,
      action: "PASSWORD_CHANGED_SELF",
      entityType: "User",
      entityId: user.id,
    });
    return { ok: true, reloginRequired: true };
  });
}

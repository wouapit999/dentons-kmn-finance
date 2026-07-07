import { NextRequest } from "next/server";
import { handle } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { requirePermission, hashPassword, AuthError } from "@/lib/auth";
import { resetPasswordSchema } from "@/lib/validation";
import { writeAudit } from "@/lib/audit";

// POST /api/users/:id/reset-password — IT Administrator resets a password.
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  return handle(async () => {
    const admin = await requirePermission("user:reset_password");
    const target = await prisma.user.findFirst({
      where: { id: params.id, companyId: admin.companyId, deletedAt: null },
    });
    if (!target) throw new AuthError(404, "not_found");

    const { password } = resetPasswordSchema.parse(await req.json());
    await prisma.user.update({
      where: { id: target.id },
      data: { passwordHash: await hashPassword(password), version: { increment: 1 } },
    });
    // Invalidate existing sessions on password reset.
    await prisma.session.updateMany({
      where: { userId: target.id, revokedAt: null },
      data: { revokedAt: new Date() },
    });

    await writeAudit({
      companyId: admin.companyId,
      actorId: admin.id,
      action: "PASSWORD_RESET",
      entityType: "User",
      entityId: target.id,
    });

    return { ok: true };
  });
}

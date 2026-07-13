import { NextRequest } from "next/server";
import { z } from "zod";
import { handle } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { SESSION_COOKIE, verifyToken } from "@/lib/jwt";
import { cookies } from "next/headers";
import { writeAudit } from "@/lib/audit";

export const dynamic = "force-dynamic";

// GET /api/me/security — my security status: MFA, recovery email, last change,
// active sessions and recent security activity.
export async function GET() {
  return handle(async () => {
    const user = await requireUser();
    const token = cookies().get(SESSION_COOKIE)?.value;
    const claims = token ? await verifyToken(token) : null;
    const currentJti = claims?.jti;

    const dbUser = await prisma.user.findUnique({ where: { id: user.id } });
    const [sessions, attempts, audit] = await Promise.all([
      prisma.session.findMany({
        where: { userId: user.id, revokedAt: null, expiresAt: { gt: new Date() } },
        orderBy: { createdAt: "desc" },
      }),
      prisma.loginAttempt.findMany({
        where: { userId: user.id },
        orderBy: { createdAt: "desc" },
        take: 10,
      }),
      prisma.auditLog.findMany({
        where: {
          companyId: user.companyId,
          entityType: "User",
          entityId: user.id,
          action: { in: ["PASSWORD_CHANGED_SELF", "MFA_ENABLED", "MFA_DISABLED", "RECOVERY_EMAIL_SET", "SESSION_REVOKED"] },
        },
        orderBy: { createdAt: "desc" },
        take: 10,
      }),
    ]);

    return {
      email: user.email,
      mfaEnabled: dbUser?.mfaEnabled ?? false,
      recoveryEmail: dbUser?.recoveryEmail ?? null,
      passwordChangedAt: dbUser?.passwordChangedAt ?? null,
      sessions: sessions.map((s) => ({
        id: s.id,
        current: s.tokenId === currentJti,
        ip: s.ip,
        userAgent: s.userAgent,
        createdAt: s.createdAt,
        expiresAt: s.expiresAt,
      })),
      loginHistory: attempts.map((a) => ({
        at: a.createdAt,
        ip: a.ip,
        success: a.success,
        reason: a.reason,
      })),
      activity: audit.map((a) => ({ at: a.createdAt, action: a.action })),
    };
  });
}

// PUT /api/me/security — update recovery email.
const putSchema = z.object({ recoveryEmail: z.string().email().nullable() });
export async function PUT(req: NextRequest) {
  return handle(async () => {
    const user = await requireUser();
    const { recoveryEmail } = putSchema.parse(await req.json());
    await prisma.user.update({ where: { id: user.id }, data: { recoveryEmail } });
    await writeAudit({
      companyId: user.companyId,
      actorId: user.id,
      action: "RECOVERY_EMAIL_SET",
      entityType: "User",
      entityId: user.id,
    });
    return { ok: true };
  });
}

import { NextRequest } from "next/server";
import { headers } from "next/headers";
import { handle } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { loginSchema } from "@/lib/validation";
import { verifyPassword, createSession, AuthError } from "@/lib/auth";
import { writeAudit } from "@/lib/audit";

const MAX_FAILED = 5;
const LOCK_MINUTES = 15;

export async function POST(req: NextRequest) {
  return handle(async () => {
    const body = await req.json();
    const { email, password } = loginSchema.parse(body);
    const ip = headers().get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;

    const user = await prisma.user.findFirst({
      where: { email: email.toLowerCase(), deletedAt: null },
    });

    const fail = async (reason: string) => {
      await prisma.loginAttempt.create({
        data: { userId: user?.id ?? null, email, ip, success: false, reason },
      });
      throw new AuthError(401, "invalid_credentials");
    };

    if (!user) return fail("no_such_user");
    if (user.status === "DISABLED") return fail("disabled");
    if (user.lockedUntil && user.lockedUntil > new Date()) return fail("locked");

    const ok = await verifyPassword(password, user.passwordHash);
    if (!ok) {
      const failed = user.failedLogins + 1;
      await prisma.user.update({
        where: { id: user.id },
        data: {
          failedLogins: failed,
          lockedUntil:
            failed >= MAX_FAILED
              ? new Date(Date.now() + LOCK_MINUTES * 60_000)
              : null,
        },
      });
      return fail("bad_password");
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { failedLogins: 0, lockedUntil: null, lastLoginAt: new Date() },
    });
    await prisma.loginAttempt.create({
      data: { userId: user.id, email, ip, success: true, reason: "ok" },
    });
    await createSession(user.id, user.companyId);
    await writeAudit({
      companyId: user.companyId,
      actorId: user.id,
      action: "LOGIN_SUCCESS",
      entityType: "User",
      entityId: user.id,
    });

    return { ok: true, locale: user.locale };
  });
}

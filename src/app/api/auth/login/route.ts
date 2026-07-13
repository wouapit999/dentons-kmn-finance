import { NextRequest } from "next/server";
import { headers } from "next/headers";
import { z } from "zod";
import { handle } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { loginSchema } from "@/lib/validation";
import { verifyPassword, createSession, AuthError } from "@/lib/auth";
import { signToken, verifyToken } from "@/lib/jwt";
import { verifyTotp, decMfa, getPolicy, isExpired } from "@/lib/security";
import { writeAudit } from "@/lib/audit";

const MAX_FAILED = 5;
const LOCK_MINUTES = 15;

// Login supports an optional second factor. When a user has MFA enabled the
// password step returns { mfaRequired, mfaToken }; the client then re-POSTs
// with { mfaToken, code } to complete sign-in. Manual admin locks are honoured
// separately from failed-attempt lockouts.
const step2 = z.object({ mfaToken: z.string(), code: z.string().min(6).max(8) });

export async function POST(req: NextRequest) {
  return handle(async () => {
    const raw = await req.json();
    const ip = headers().get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;

    // --- Second factor step ---
    const s2 = step2.safeParse(raw);
    if (s2.success) {
      const claims = await verifyToken(s2.data.mfaToken);
      if (!claims || (claims as { mfa?: string }).mfa !== "pending") throw new AuthError(401, "mfa_expired");
      const user = await prisma.user.findFirst({ where: { id: claims.sub, deletedAt: null } });
      if (!user || !user.mfaEnabled || !user.mfaSecretEnc) throw new AuthError(401, "invalid_credentials");
      const secret = decMfa(user.mfaSecretEnc);
      if (!secret || !verifyTotp(secret, s2.data.code)) {
        await prisma.loginAttempt.create({ data: { userId: user.id, email: user.email, ip, success: false, reason: "bad_mfa" } });
        throw new AuthError(401, "invalid_mfa_code");
      }
      return finishLogin(user, ip);
    }

    // --- Password step ---
    const { email, password } = loginSchema.parse(raw);
    const user = await prisma.user.findFirst({ where: { email: email.toLowerCase(), deletedAt: null } });

    const fail = async (reason: string) => {
      await prisma.loginAttempt.create({ data: { userId: user?.id ?? null, email, ip, success: false, reason } });
      throw new AuthError(401, "invalid_credentials");
    };

    if (!user) return fail("no_such_user");
    if (user.status === "DISABLED") return fail("disabled");
    if (user.lockedManually) return fail("locked_admin");
    if (user.lockedUntil && user.lockedUntil > new Date()) return fail("locked");

    const ok = await verifyPassword(password, user.passwordHash);
    if (!ok) {
      const failed = user.failedLogins + 1;
      await prisma.user.update({
        where: { id: user.id },
        data: {
          failedLogins: failed,
          lockedUntil: failed >= MAX_FAILED ? new Date(Date.now() + LOCK_MINUTES * 60_000) : null,
        },
      });
      return fail("bad_password");
    }

    // Password OK. If MFA is on, issue a short-lived pending token instead of a session.
    if (user.mfaEnabled && user.mfaSecretEnc) {
      await prisma.user.update({ where: { id: user.id }, data: { failedLogins: 0, lockedUntil: null } });
      const mfaToken = await signMfaPending(user.id, user.companyId);
      return { mfaRequired: true, mfaToken };
    }

    return finishLogin(user, ip);
  });
}

async function signMfaPending(userId: string, companyId: string): Promise<string> {
  // Short-lived (~5 min) token that only authorises the second-factor step.
  return signToken({ sub: userId, jti: "mfa", cid: companyId }, 300, { mfa: "pending" });
}

async function finishLogin(
  user: { id: string; companyId: string; locale: string; passwordChangedAt: Date | null },
  ip: string | null,
) {
  const dbUser = await prisma.user.findUnique({ where: { id: user.id } });
  await prisma.user.update({
    where: { id: user.id },
    data: { failedLogins: 0, lockedUntil: null, lastLoginAt: new Date() },
  });
  await prisma.loginAttempt.create({ data: { userId: user.id, email: dbUser!.email, ip, success: true, reason: "ok" } });
  await createSession(user.id, user.companyId);
  await writeAudit({
    companyId: user.companyId,
    actorId: user.id,
    action: "LOGIN_SUCCESS",
    entityType: "User",
    entityId: user.id,
  });

  const policy = await getPolicy(user.companyId);
  const expired = isExpired(dbUser!.passwordChangedAt, policy.expiryDays);
  return {
    ok: true,
    locale: user.locale,
    mustChangePassword: dbUser!.mustChangePassword || expired,
  };
}

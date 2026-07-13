import { NextRequest } from "next/server";
import { z } from "zod";
import { handle } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { requireUser, verifyPassword, AuthError } from "@/lib/auth";
import { generateTotpSecret, otpauthUri, verifyTotp, encMfa, decMfa } from "@/lib/security";
import { writeAudit } from "@/lib/audit";

export const dynamic = "force-dynamic";

const schema = z.object({
  action: z.enum(["setup", "enable", "disable"]),
  code: z.string().optional(),
  password: z.string().optional(),
});

// POST /api/me/mfa — self-service MFA (TOTP).
//  setup   -> returns a new secret + otpauth URI (not yet enabled)
//  enable  -> verifies a code against the pending secret, then turns MFA on
//  disable -> requires a valid code OR the account password
export async function POST(req: NextRequest) {
  return handle(async () => {
    const user = await requireUser();
    const { action, code, password } = schema.parse(await req.json());
    const dbUser = await prisma.user.findUnique({ where: { id: user.id } });
    if (!dbUser) throw new AuthError(404, "not_found");

    if (action === "setup") {
      const secret = generateTotpSecret();
      // Store the pending secret encrypted; it only becomes active on enable.
      await prisma.user.update({ where: { id: user.id }, data: { mfaSecretEnc: encMfa(secret) } });
      return { secret, otpauth: otpauthUri(secret, user.email) };
    }

    if (action === "enable") {
      if (!dbUser.mfaSecretEnc) throw new AuthError(422, "run_setup_first");
      const secret = decMfa(dbUser.mfaSecretEnc);
      if (!secret || !verifyTotp(secret, code ?? "")) throw new AuthError(422, "invalid_mfa_code");
      await prisma.user.update({ where: { id: user.id }, data: { mfaEnabled: true } });
      await writeAudit({ companyId: user.companyId, actorId: user.id, action: "MFA_ENABLED", entityType: "User", entityId: user.id });
      return { ok: true, mfaEnabled: true };
    }

    // disable
    const okCode = dbUser.mfaSecretEnc && code
      ? verifyTotp(decMfa(dbUser.mfaSecretEnc) ?? "", code)
      : false;
    const okPw = password ? await verifyPassword(password, dbUser.passwordHash) : false;
    if (!okCode && !okPw) throw new AuthError(422, "verification_required");
    await prisma.user.update({ where: { id: user.id }, data: { mfaEnabled: false, mfaSecretEnc: null } });
    await writeAudit({ companyId: user.companyId, actorId: user.id, action: "MFA_DISABLED", entityType: "User", entityId: user.id });
    return { ok: true, mfaEnabled: false };
  });
}

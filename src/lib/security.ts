// Security primitives for password management and MFA — no external deps.
//  - Password policy validation (length, complexity, history, breach)
//  - HaveIBeenPwned k-anonymity breached-password check
//  - TOTP (RFC 6238) generation/verification for MFA
import "server-only";
import { createHash, createHmac, randomBytes, timingSafeEqual } from "crypto";
import bcrypt from "bcryptjs";
import { prisma } from "./prisma";
import { getSetting, setSetting, encrypt, decrypt } from "./settings";

export interface PasswordPolicy {
  minLength: number;
  requireUpper: boolean;
  requireLower: boolean;
  requireNumber: boolean;
  requireSpecial: boolean;
  historyCount: number; // 0 = disabled
  expiryDays: number; // 0 = never
  breachCheck: boolean;
}

export const DEFAULT_POLICY: PasswordPolicy = {
  minLength: 12,
  requireUpper: true,
  requireLower: true,
  requireNumber: true,
  requireSpecial: true,
  historyCount: 5,
  expiryDays: 0,
  breachCheck: true,
};

const POLICY_KEY = "security.password_policy";

export async function getPolicy(companyId: string): Promise<PasswordPolicy> {
  const raw = await getSetting(companyId, POLICY_KEY);
  if (!raw) return DEFAULT_POLICY;
  try {
    return { ...DEFAULT_POLICY, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_POLICY;
  }
}

export async function savePolicy(companyId: string, policy: PasswordPolicy, by: string): Promise<void> {
  await setSetting(companyId, POLICY_KEY, JSON.stringify(policy), { updatedBy: by });
}

/** Static complexity checks; returns a list of violations (empty = ok). */
export function checkComplexity(pw: string, policy: PasswordPolicy): string[] {
  const errs: string[] = [];
  if (pw.length < policy.minLength) errs.push(`at least ${policy.minLength} characters`);
  if (policy.requireUpper && !/[A-Z]/.test(pw)) errs.push("an uppercase letter");
  if (policy.requireLower && !/[a-z]/.test(pw)) errs.push("a lowercase letter");
  if (policy.requireNumber && !/[0-9]/.test(pw)) errs.push("a number");
  if (policy.requireSpecial && !/[^A-Za-z0-9]/.test(pw)) errs.push("a special character");
  return errs;
}

/** HaveIBeenPwned range API (k-anonymity: only a 5-char SHA-1 prefix leaves the server). */
export async function isBreached(pw: string): Promise<boolean> {
  try {
    const sha1 = createHash("sha1").update(pw).digest("hex").toUpperCase();
    const prefix = sha1.slice(0, 5);
    const suffix = sha1.slice(5);
    const res = await fetch(`https://api.pwnedpasswords.com/range/${prefix}`, {
      headers: { "Add-Padding": "true" },
      signal: AbortSignal.timeout(4000),
    });
    if (!res.ok) return false; // fail open — don't block on outage
    const body = await res.text();
    for (const line of body.split("\n")) {
      const [suf, count] = line.trim().split(":");
      if (suf === suffix && Number(count) > 0) return true;
    }
    return false;
  } catch {
    return false;
  }
}

/** Has this plaintext been used in the last N stored hashes? */
export async function isReused(userId: string, pw: string, historyCount: number): Promise<boolean> {
  if (historyCount <= 0) return false;
  const history = await prisma.passwordHistory.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: historyCount,
  });
  for (const h of history) {
    if (await bcrypt.compare(pw, h.passwordHash)) return true;
  }
  return false;
}

/** Full validation against a company's policy. Returns an error message or null. */
export async function validatePassword(
  companyId: string,
  userId: string | null,
  pw: string,
): Promise<string | null> {
  const policy = await getPolicy(companyId);
  const errs = checkComplexity(pw, policy);
  if (errs.length) return `Password must contain ${errs.join(", ")}.`;
  if (policy.breachCheck && (await isBreached(pw)))
    return "This password has appeared in a known data breach. Choose a different one.";
  if (userId && (await isReused(userId, pw, policy.historyCount)))
    return `You cannot reuse one of your last ${policy.historyCount} passwords.`;
  return null;
}

/** Record a new password hash into history (trims to keep only what policy needs). */
export async function pushPasswordHistory(userId: string, hash: string, keep: number): Promise<void> {
  await prisma.passwordHistory.create({ data: { userId, passwordHash: hash } });
  const rows = await prisma.passwordHistory.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    select: { id: true },
  });
  const toDelete = rows.slice(Math.max(keep, 1)).map((r) => r.id);
  if (toDelete.length) await prisma.passwordHistory.deleteMany({ where: { id: { in: toDelete } } });
}

export function isExpired(passwordChangedAt: Date | null, expiryDays: number): boolean {
  if (!expiryDays || !passwordChangedAt) return false;
  return Date.now() - passwordChangedAt.getTime() > expiryDays * 86_400_000;
}

// ---------------------------------------------------------------------------
// TOTP (RFC 6238) — MFA, dependency-free.
// ---------------------------------------------------------------------------

const B32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

function base32Encode(buf: Buffer): string {
  let bits = 0, value = 0, out = "";
  for (const byte of buf) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += B32[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += B32[(value << (5 - bits)) & 31];
  return out;
}

function base32Decode(str: string): Buffer {
  const clean = str.replace(/=+$/, "").toUpperCase().replace(/[^A-Z2-7]/g, "");
  let bits = 0, value = 0;
  const out: number[] = [];
  for (const ch of clean) {
    value = (value << 5) | B32.indexOf(ch);
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return Buffer.from(out);
}

export function generateTotpSecret(): string {
  return base32Encode(randomBytes(20));
}

function totpAt(secret: string, counter: number): string {
  const key = base32Decode(secret);
  const buf = Buffer.alloc(8);
  buf.writeBigInt64BE(BigInt(counter));
  const hmac = createHmac("sha1", key).update(buf).digest();
  const offset = hmac[hmac.length - 1] & 0xf;
  const bin =
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff);
  return String(bin % 1_000_000).padStart(6, "0");
}

/** Verify a 6-digit code against the secret, allowing +/- 1 time step. */
export function verifyTotp(secret: string, code: string): boolean {
  const clean = (code || "").replace(/\D/g, "");
  if (clean.length !== 6) return false;
  const counter = Math.floor(Date.now() / 1000 / 30);
  for (let w = -1; w <= 1; w++) {
    const expected = totpAt(secret, counter + w);
    if (
      expected.length === clean.length &&
      timingSafeEqual(Buffer.from(expected), Buffer.from(clean))
    )
      return true;
  }
  return false;
}

export function otpauthUri(secret: string, account: string, issuer = "Dentons KMN Finance"): string {
  return `otpauth://totp/${encodeURIComponent(issuer)}:${encodeURIComponent(account)}?secret=${secret}&issuer=${encodeURIComponent(issuer)}&period=30&digits=6`;
}

export const encMfa = encrypt;
export const decMfa = decrypt;

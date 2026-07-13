// Node-runtime auth layer: password hashing, session issue/verify/revoke,
// and current-user resolution with effective permissions.
import "server-only";
import bcrypt from "bcryptjs";
import { randomUUID } from "crypto";
import { cookies, headers } from "next/headers";
import { prisma } from "./prisma";
import { signToken, verifyToken, SESSION_COOKIE } from "./jwt";
import type { PermissionKey } from "./constants";

const TTL = Number(process.env.SESSION_TTL_SECONDS ?? 28800);

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, 10);
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

export interface CurrentUser {
  id: string;
  companyId: string;
  email: string;
  fullName: string;
  locale: string;
  status: string;
  mustChangePassword: boolean;
  mfaEnabled: boolean;
  permissions: Set<string>;
  roleKeys: string[];
}

/** Create a Session row + signed cookie for a user. */
export async function createSession(userId: string, companyId: string): Promise<string> {
  const jti = randomUUID();
  const expiresAt = new Date(Date.now() + TTL * 1000);
  const h = headers();
  await prisma.session.create({
    data: {
      userId,
      tokenId: jti,
      expiresAt,
      ip: h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
      userAgent: h.get("user-agent") ?? null,
    },
  });
  const token = await signToken({ sub: userId, jti, cid: companyId }, TTL);
  cookies().set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: TTL,
  });
  return token;
}

/** Resolve the current user from the cookie, verifying the session is live. */
export async function getCurrentUser(): Promise<CurrentUser | null> {
  const token = cookies().get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const claims = await verifyToken(token);
  if (!claims) return null;

  const session = await prisma.session.findUnique({ where: { tokenId: claims.jti } });
  if (!session || session.revokedAt || session.expiresAt < new Date()) return null;

  const user = await prisma.user.findUnique({
    where: { id: claims.sub },
    include: {
      userRoles: {
        include: { role: { include: { rolePermissions: { include: { permission: true } } } } },
      },
    },
  });
  if (!user || user.status !== "ACTIVE" || user.deletedAt) return null;

  const permissions = new Set<string>();
  const roleKeys: string[] = [];
  for (const ur of user.userRoles) {
    roleKeys.push(ur.role.key);
    for (const rp of ur.role.rolePermissions) permissions.add(rp.permission.key);
  }

  return {
    id: user.id,
    companyId: user.companyId,
    email: user.email,
    fullName: user.fullName,
    locale: user.locale,
    status: user.status,
    mustChangePassword: user.mustChangePassword,
    mfaEnabled: user.mfaEnabled,
    permissions,
    roleKeys,
  };
}

export async function destroySession(): Promise<void> {
  const token = cookies().get(SESSION_COOKIE)?.value;
  if (token) {
    const claims = await verifyToken(token);
    if (claims) {
      await prisma.session
        .update({ where: { tokenId: claims.jti }, data: { revokedAt: new Date() } })
        .catch(() => undefined);
    }
  }
  cookies().delete(SESSION_COOKIE);
}

export function can(user: CurrentUser | null, permission: PermissionKey): boolean {
  return !!user && user.permissions.has(permission);
}

/** Throwing guard for API routes / server actions. */
export class AuthError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

export async function requireUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) throw new AuthError(401, "unauthorized");
  return user;
}

export async function requirePermission(permission: PermissionKey): Promise<CurrentUser> {
  const user = await requireUser();
  if (!user.permissions.has(permission)) throw new AuthError(403, "forbidden");
  return user;
}

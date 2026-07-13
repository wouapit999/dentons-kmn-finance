// Edge-safe JWT helpers (jose only, no Node/Prisma imports).
// Used by middleware (Edge runtime) and by the Node auth layer.
import { SignJWT, jwtVerify, type JWTPayload } from "jose";

const secret = new TextEncoder().encode(
  process.env.AUTH_SECRET ?? "insecure-dev-secret-change-me-please-32chars",
);

export interface SessionClaims extends JWTPayload {
  sub: string; // userId
  jti: string; // session token id
  cid: string; // companyId
}

export async function signToken(
  claims: { sub: string; jti: string; cid: string },
  ttlSeconds: number,
  extra: Record<string, string> = {},
): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  return new SignJWT({ cid: claims.cid, ...extra })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(claims.sub)
    .setJti(claims.jti)
    .setIssuedAt(now)
    .setExpirationTime(now + ttlSeconds)
    .sign(secret);
}

export async function verifyToken(token: string): Promise<SessionClaims | null> {
  try {
    const { payload } = await jwtVerify(token, secret);
    if (!payload.sub || !payload.jti) return null;
    return payload as SessionClaims;
  } catch {
    return null;
  }
}

export const SESSION_COOKIE = "dkmn_session";

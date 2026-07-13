import { NextRequest } from "next/server";
import { z } from "zod";
import { handle } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { SESSION_COOKIE, verifyToken } from "@/lib/jwt";
import { cookies } from "next/headers";
import { writeAudit } from "@/lib/audit";

export const dynamic = "force-dynamic";

const schema = z.object({ target: z.string() }); // a session id, or "others"

// POST /api/me/sessions/revoke — sign out a specific device, or all others.
export async function POST(req: NextRequest) {
  return handle(async () => {
    const user = await requireUser();
    const { target } = schema.parse(await req.json());
    const token = cookies().get(SESSION_COOKIE)?.value;
    const claims = token ? await verifyToken(token) : null;

    if (target === "others") {
      await prisma.session.updateMany({
        where: { userId: user.id, revokedAt: null, NOT: { tokenId: claims?.jti } },
        data: { revokedAt: new Date() },
      });
    } else {
      await prisma.session.updateMany({
        where: { id: target, userId: user.id },
        data: { revokedAt: new Date() },
      });
    }
    await writeAudit({
      companyId: user.companyId,
      actorId: user.id,
      action: "SESSION_REVOKED",
      entityType: "User",
      entityId: user.id,
    });
    return { ok: true };
  });
}

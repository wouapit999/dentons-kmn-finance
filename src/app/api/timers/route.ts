/*
 * Dentons KMN ERP
 * Copyright (c) 2026 Bouquet Innovation SA. All rights reserved.
 * Proprietary and confidential. Unauthorised copying, distribution, modification,
 * or use of this file, via any medium, is strictly prohibited.
 */
import { NextRequest } from "next/server";
import { handle } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { requirePermission, AuthError } from "@/lib/auth";
import { startTimerSchema } from "@/lib/validation";
import { elapsedSeconds, toBillableMinutes } from "@/lib/timers";
import { writeAudit } from "@/lib/audit";

export const dynamic = "force-dynamic";

// GET /api/timers — the signed-in user's open timers (running or paused).
export async function GET() {
  return handle(async () => {
    const user = await requirePermission("time:log");
    const timers = await prisma.timer.findMany({
      where: { companyId: user.companyId, userId: user.id, status: { in: ["RUNNING", "PAUSED"] } },
      include: { matter: { select: { id: true, code: true, name: true } } },
      orderBy: { createdAt: "desc" },
    });
    const now = new Date();
    return timers.map((t) => {
      const sec = elapsedSeconds(t, now);
      return {
        id: t.id,
        status: t.status,
        source: t.source,
        narrative: t.narrative,
        matterId: t.matterId,
        matter: t.matter ? `${t.matter.code} — ${t.matter.name}` : null,
        elapsedSec: sec,
        billableMinutes: toBillableMinutes(sec),
        // Lets the client tick smoothly without polling.
        runningSince: t.runningSince,
        accumulatedSec: t.accumulatedSec,
      };
    });
  });
}

// POST /api/timers — start a new timer. Only one may run at a time: any other
// running timer for this user is paused first (banking its elapsed seconds).
export async function POST(req: NextRequest) {
  return handle(async () => {
    const user = await requirePermission("time:log");
    const input = startTimerSchema.parse(await req.json().catch(() => ({})));

    if (input.matterId) {
      const matter = await prisma.matter.findFirst({
        where: { id: input.matterId, companyId: user.companyId },
        select: { id: true },
      });
      if (!matter) throw new AuthError(422, "invalid_matter");
    }

    const now = new Date();
    const created = await prisma.$transaction(async (tx) => {
      const running = await tx.timer.findMany({
        where: { companyId: user.companyId, userId: user.id, status: "RUNNING" },
      });
      for (const r of running) {
        await tx.timer.update({
          where: { id: r.id },
          data: { accumulatedSec: elapsedSeconds(r, now), runningSince: null, status: "PAUSED" },
        });
      }
      return tx.timer.create({
        data: {
          companyId: user.companyId,
          userId: user.id,
          matterId: input.matterId || null,
          narrative: input.narrative || null,
          source: input.source,
          runningSince: now,
          status: "RUNNING",
        },
      });
    });

    await writeAudit({
      companyId: user.companyId,
      actorId: user.id,
      action: "TIMER_STARTED",
      entityType: "Timer",
      entityId: created.id,
      after: { source: created.source, matterId: created.matterId },
    });
    return { id: created.id, status: created.status, runningSince: created.runningSince };
  });
}

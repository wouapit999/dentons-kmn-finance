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
import { timerActionSchema } from "@/lib/validation";
import { elapsedSeconds, toBillableMinutes } from "@/lib/timers";
import { writeAudit } from "@/lib/audit";

export const dynamic = "force-dynamic";

// POST /api/timers/:id — pause | resume | discard | log
// "log" converts the elapsed time into a DRAFT TimeEntry (rounded up to the
// 6-minute billing increment) and closes the timer.
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  return handle(async () => {
    const user = await requirePermission("time:log");
    const input = timerActionSchema.parse(await req.json());

    // A user may only act on their own timers.
    const timer = await prisma.timer.findFirst({
      where: { id: params.id, companyId: user.companyId, userId: user.id },
    });
    if (!timer) throw new AuthError(404, "not_found");
    if (timer.status === "LOGGED" || timer.status === "DISCARDED") {
      throw new AuthError(422, "timer_already_closed");
    }

    const now = new Date();

    if (input.action === "pause") {
      if (timer.status !== "RUNNING") throw new AuthError(422, "timer_not_running");
      const updated = await prisma.timer.update({
        where: { id: timer.id },
        data: { accumulatedSec: elapsedSeconds(timer, now), runningSince: null, status: "PAUSED" },
      });
      return { id: updated.id, status: updated.status, elapsedSec: updated.accumulatedSec };
    }

    if (input.action === "resume") {
      if (timer.status !== "PAUSED") throw new AuthError(422, "timer_not_paused");
      // Pause any other running timer so only one runs at a time.
      const updated = await prisma.$transaction(async (tx) => {
        const running = await tx.timer.findMany({
          where: { companyId: user.companyId, userId: user.id, status: "RUNNING" },
        });
        for (const r of running) {
          await tx.timer.update({
            where: { id: r.id },
            data: { accumulatedSec: elapsedSeconds(r, now), runningSince: null, status: "PAUSED" },
          });
        }
        return tx.timer.update({
          where: { id: timer.id },
          data: { runningSince: now, status: "RUNNING" },
        });
      });
      return { id: updated.id, status: updated.status, runningSince: updated.runningSince };
    }

    if (input.action === "discard") {
      await prisma.timer.update({
        where: { id: timer.id },
        data: { status: "DISCARDED", runningSince: null, accumulatedSec: elapsedSeconds(timer, now) },
      });
      await writeAudit({
        companyId: user.companyId,
        actorId: user.id,
        action: "TIMER_DISCARDED",
        entityType: "Timer",
        entityId: timer.id,
      });
      return { ok: true, status: "DISCARDED" };
    }

    // action === "log"
    const matterId = input.matterId || timer.matterId;
    if (!matterId) throw new AuthError(422, "matter_required");
    const matter = await prisma.matter.findFirst({
      where: { id: matterId, companyId: user.companyId },
      select: { id: true, status: true, currency: true },
    });
    if (!matter) throw new AuthError(422, "invalid_matter");
    if (matter.status === "CLOSED") throw new AuthError(422, "matter_closed");

    const seconds = elapsedSeconds(timer, now);
    const minutes = input.minutes ?? toBillableMinutes(seconds);
    if (minutes <= 0) throw new AuthError(422, "nothing_to_log");

    const rate = input.rate ?? 0;
    const billable = input.billable ?? true;
    const amount = Math.round((minutes / 60) * rate * 100) / 100;

    const entry = await prisma.$transaction(async (tx) => {
      const created = await tx.timeEntry.create({
        data: {
          companyId: user.companyId,
          matterId,
          lawyerId: user.id,
          date: new Date(),
          minutes,
          billable,
          rate,
          amount,
          currency: matter.currency,
          narrative: input.narrative || timer.narrative || null,
          status: "DRAFT",
          source: timer.source === "APP" ? "TIMER" : timer.source,
          createdById: user.id,
        },
      });
      await tx.timer.update({
        where: { id: timer.id },
        data: {
          status: "LOGGED",
          runningSince: null,
          accumulatedSec: seconds,
          timeEntryId: created.id,
        },
      });
      return created;
    });

    await writeAudit({
      companyId: user.companyId,
      actorId: user.id,
      action: "TIMER_LOGGED",
      entityType: "TimeEntry",
      entityId: entry.id,
      after: { minutes, matterId, source: entry.source, fromTimer: timer.id },
    });
    return { ok: true, timeEntryId: entry.id, minutes, amount };
  });
}

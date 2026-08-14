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
import { weekGridSchema } from "@/lib/validation";
import { writeAudit } from "@/lib/audit";

export const dynamic = "force-dynamic";

// Monday-start week containing `d`, in UTC day boundaries.
function weekStart(d: Date): Date {
  const x = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const dow = (x.getUTCDay() + 6) % 7; // Mon = 0
  x.setUTCDate(x.getUTCDate() - dow);
  return x;
}
const dayKey = (d: Date) => d.toISOString().slice(0, 10);

// GET /api/time/week?start=YYYY-MM-DD — the signed-in user's weekly grid:
// one row per matter worked, seven day cells, with per-cell entry ids.
export async function GET(req: NextRequest) {
  return handle(async () => {
    const user = await requirePermission("time:read");
    const startParam = req.nextUrl.searchParams.get("start");
    const base = startParam ? new Date(startParam) : new Date();
    const start = weekStart(isNaN(base.getTime()) ? new Date() : base);
    const end = new Date(start);
    end.setUTCDate(end.getUTCDate() + 7);

    const entries = await prisma.timeEntry.findMany({
      where: {
        companyId: user.companyId,
        lawyerId: user.id,
        date: { gte: start, lt: end },
      },
      include: { matter: { select: { id: true, code: true, name: true } } },
      orderBy: { date: "asc" },
    });

    const days = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(start);
      d.setUTCDate(d.getUTCDate() + i);
      return dayKey(d);
    });

    // Group into matter rows -> day cells.
    const rows = new Map<
      string,
      { matterId: string; matter: string; cells: Record<string, { id: string; minutes: number; billable: boolean; narrative: string | null; locked: boolean }> }
    >();
    for (const e of entries) {
      const key = e.matterId;
      if (!rows.has(key)) {
        rows.set(key, {
          matterId: e.matterId,
          matter: `${e.matter.code} — ${e.matter.name}`,
          cells: {},
        });
      }
      rows.get(key)!.cells[dayKey(e.date)] = {
        id: e.id,
        minutes: e.minutes,
        billable: e.billable,
        narrative: e.narrative,
        locked: e.status !== "DRAFT", // billed time cannot be edited
      };
    }

    const totalMinutes = entries.reduce((s, e) => s + e.minutes, 0);
    const billableMinutes = entries.filter((e) => e.billable).reduce((s, e) => s + e.minutes, 0);

    return {
      start: dayKey(start),
      days,
      rows: Array.from(rows.values()),
      totals: {
        minutes: totalMinutes,
        billableMinutes,
        nonBillableMinutes: totalMinutes - billableMinutes,
        byDay: days.map((d) => ({
          day: d,
          minutes: entries.filter((e) => dayKey(e.date) === d).reduce((s, e) => s + e.minutes, 0),
        })),
      },
    };
  });
}

// POST /api/time/week — batch create/update/delete cells of the grid.
// minutes = 0 on an existing entry deletes it. Billed entries are never touched.
export async function POST(req: NextRequest) {
  return handle(async () => {
    const user = await requirePermission("time:log");
    const { entries } = weekGridSchema.parse(await req.json());
    if (!entries.length) return { created: 0, updated: 0, deleted: 0 };

    // Validate all referenced matters up front.
    const matterIds = Array.from(new Set(entries.map((e) => e.matterId)));
    const matters = await prisma.matter.findMany({
      where: { id: { in: matterIds }, companyId: user.companyId },
      select: { id: true, status: true, currency: true },
    });
    const byId = new Map(matters.map((m) => [m.id, m]));
    if (matters.length !== matterIds.length) throw new AuthError(422, "invalid_matter");
    if (matters.some((m) => m.status === "CLOSED")) throw new AuthError(422, "matter_closed");

    let created = 0, updated = 0, deleted = 0;
    await prisma.$transaction(async (tx) => {
      for (const e of entries) {
        const matter = byId.get(e.matterId)!;
        const rate = e.rate ?? 0;
        const amount = Math.round((e.minutes / 60) * rate * 100) / 100;
        const date = new Date(e.date);
        if (isNaN(date.getTime())) throw new AuthError(422, "invalid_date");

        if (e.id) {
          // Only the owner's own DRAFT rows are editable.
          const existing = await tx.timeEntry.findFirst({
            where: { id: e.id, companyId: user.companyId, lawyerId: user.id },
            select: { id: true, status: true },
          });
          if (!existing || existing.status !== "DRAFT") continue;
          if (e.minutes === 0) {
            await tx.timeEntry.delete({ where: { id: existing.id } });
            deleted++;
          } else {
            await tx.timeEntry.update({
              where: { id: existing.id },
              data: {
                minutes: e.minutes,
                billable: e.billable,
                narrative: e.narrative || null,
                rate,
                amount,
                date,
              },
            });
            updated++;
          }
        } else if (e.minutes > 0) {
          await tx.timeEntry.create({
            data: {
              companyId: user.companyId,
              matterId: e.matterId,
              lawyerId: user.id,
              date,
              minutes: e.minutes,
              billable: e.billable,
              rate,
              amount,
              currency: matter.currency,
              narrative: e.narrative || null,
              status: "DRAFT",
              source: "APP",
              createdById: user.id,
            },
          });
          created++;
        }
      }
    });

    await writeAudit({
      companyId: user.companyId,
      actorId: user.id,
      action: "TIME_WEEK_SAVED",
      entityType: "TimeEntry",
      entityId: null,
      after: { created, updated, deleted },
    });
    return { created, updated, deleted };
  });
}

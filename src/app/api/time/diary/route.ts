/*
 * Dentons KMN ERP
 * Copyright (c) 2026 Bouquet Innovation SA. All rights reserved.
 * Proprietary and confidential. Unauthorised copying, distribution, modification,
 * or use of this file, via any medium, is strictly prohibited.
 */
import { handle } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/auth";
import { elapsedSeconds } from "@/lib/timers";

export const dynamic = "force-dynamic";

const startOfDayUTC = (d: Date) => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
function weekStart(d: Date): Date {
  const x = startOfDayUTC(d);
  const dow = (x.getUTCDay() + 6) % 7;
  x.setUTCDate(x.getUTCDate() - dow);
  return x;
}
const dayKey = (d: Date) => d.toISOString().slice(0, 10);

// GET /api/time/diary — the signed-in user's centralised diary: what is
// recorded today / this week, what is still unbilled, and any open timers.
export async function GET() {
  return handle(async () => {
    const user = await requirePermission("time:read");
    const now = new Date();
    const today = startOfDayUTC(now);
    const tomorrow = new Date(today);
    tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
    const wkStart = weekStart(now);
    const wkEnd = new Date(wkStart);
    wkEnd.setUTCDate(wkEnd.getUTCDate() + 7);
    const trendStart = new Date(today);
    trendStart.setUTCDate(trendStart.getUTCDate() - 13);

    const [todayRows, weekRows, unbilled, timers, trendRows] = await Promise.all([
      prisma.timeEntry.findMany({
        where: { companyId: user.companyId, lawyerId: user.id, date: { gte: today, lt: tomorrow } },
        select: { minutes: true, billable: true },
      }),
      prisma.timeEntry.findMany({
        where: { companyId: user.companyId, lawyerId: user.id, date: { gte: wkStart, lt: wkEnd } },
        select: { minutes: true, billable: true },
      }),
      prisma.timeEntry.findMany({
        where: {
          companyId: user.companyId,
          lawyerId: user.id,
          status: "DRAFT",
          billable: true,
          invoiceId: null,
        },
        include: { matter: { select: { code: true, name: true } } },
      }),
      prisma.timer.findMany({
        where: { companyId: user.companyId, userId: user.id, status: { in: ["RUNNING", "PAUSED"] } },
        include: { matter: { select: { code: true } } },
      }),
      prisma.timeEntry.findMany({
        where: { companyId: user.companyId, lawyerId: user.id, date: { gte: trendStart, lt: tomorrow } },
        select: { date: true, minutes: true, billable: true },
      }),
    ]);

    const sum = (rows: { minutes: number }[]) => rows.reduce((s, r) => s + r.minutes, 0);
    const billableOf = (rows: { minutes: number; billable: boolean }[]) =>
      rows.filter((r) => r.billable).reduce((s, r) => s + r.minutes, 0);

    // Unbilled grouped by matter (top pending work to bill).
    const byMatter = new Map<string, { matter: string; minutes: number; amount: number }>();
    for (const e of unbilled) {
      const key = `${e.matter.code} — ${e.matter.name}`;
      const cur = byMatter.get(key) ?? { matter: key, minutes: 0, amount: 0 };
      cur.minutes += e.minutes;
      cur.amount += Number(e.amount);
      byMatter.set(key, cur);
    }

    // 14-day trend for the personal dashboard.
    const trend: { day: string; minutes: number; billableMinutes: number }[] = [];
    for (let i = 0; i < 14; i++) {
      const d = new Date(trendStart);
      d.setUTCDate(d.getUTCDate() + i);
      const k = dayKey(d);
      const rows = trendRows.filter((r) => dayKey(r.date) === k);
      trend.push({ day: k, minutes: sum(rows), billableMinutes: billableOf(rows) });
    }

    const weekMinutes = sum(weekRows);
    const weekBillable = billableOf(weekRows);

    return {
      today: { minutes: sum(todayRows), billableMinutes: billableOf(todayRows) },
      week: {
        start: dayKey(wkStart),
        minutes: weekMinutes,
        billableMinutes: weekBillable,
        nonBillableMinutes: weekMinutes - weekBillable,
        // Utilisation against a 40h week of billable work.
        utilisationPct: Math.round((weekBillable / (40 * 60)) * 1000) / 10,
      },
      unbilled: {
        minutes: sum(unbilled),
        amount: Math.round(unbilled.reduce((s, e) => s + Number(e.amount), 0) * 100) / 100,
        entries: unbilled.length,
        byMatter: Array.from(byMatter.values()).sort((a, b) => b.minutes - a.minutes).slice(0, 6),
      },
      openTimers: timers.map((t) => ({
        id: t.id,
        status: t.status,
        matter: t.matter?.code ?? null,
        narrative: t.narrative,
        elapsedSec: elapsedSeconds(t, now),
      })),
      trend,
    };
  });
}

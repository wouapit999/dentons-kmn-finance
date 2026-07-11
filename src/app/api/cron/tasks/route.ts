import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { notify, advanceSchedule } from "@/lib/tasks";

export const dynamic = "force-dynamic";

// GET /api/cron/tasks[?job=daily]
// Auth: `authorization: Bearer ${CRON_SECRET}` (Vercel Cron) OR a signed-in
// task:admin (manual trigger for testing). Every step is idempotent.
export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization");
  const secret = process.env.CRON_SECRET;
  let authorized = !!secret && auth === `Bearer ${secret}`;
  if (!authorized) {
    const user = await getCurrentUser();
    authorized = !!user && user.permissions.has("task:admin");
  }
  if (!authorized) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const now = new Date();
  const startOfDay = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const result = { reminders: 0, overdue: 0, recurred: 0, digests: 0 };

  // 1) Due reminders -> notification, mark sent.
  const dueReminders = await prisma.taskReminder.findMany({
    where: { remindAt: { lte: now }, sentAt: null },
    include: {
      task: { include: { assignments: true }, },
    },
    take: 200,
  });
  for (const r of dueReminders) {
    const t = r.task;
    if (!t.deletedAt && !["COMPLETED", "ARCHIVED"].includes(t.status)) {
      const targets = Array.from(
        new Set([r.createdBy, t.createdById, ...t.assignments.map((a) => a.userId)]),
      );
      await notify(t.companyId, targets, "TASK_DUE", `Reminder: ${t.title}`, `/tasks/${t.id}`);
      result.reminders += 1;
    }
    await prisma.taskReminder.update({ where: { id: r.id }, data: { sentAt: now } });
  }

  // 2) Overdue sweep — one notification per assignee per task per day.
  const overdue = await prisma.task.findMany({
    where: {
      deletedAt: null,
      dueDate: { lt: now },
      status: { notIn: ["COMPLETED", "ARCHIVED"] },
    },
    include: { assignments: true },
    take: 500,
  });
  for (const t of overdue) {
    const targets = Array.from(new Set([t.createdById, ...t.assignments.map((a) => a.userId)]));
    for (const userId of targets) {
      const already = await prisma.notification.findFirst({
        where: {
          userId,
          type: "TASK_OVERDUE",
          linkPath: `/tasks/${t.id}`,
          createdAt: { gte: startOfDay },
        },
        select: { id: true },
      });
      if (!already) {
        await notify(t.companyId, [userId], "TASK_OVERDUE", `Overdue: ${t.title}`, `/tasks/${t.id}`);
        result.overdue += 1;
      }
    }
  }

  // 3) Recurrence — generate due instances and advance the schedule.
  const rules = await prisma.recurringTaskRule.findMany({
    where: { active: true, nextRunAt: { lte: now } },
    take: 100,
  });
  for (const rule of rules) {
    if (rule.endsAt && rule.endsAt < now) {
      await prisma.recurringTaskRule.update({ where: { id: rule.id }, data: { active: false } });
      continue;
    }
    const assigneeIds: string[] = JSON.parse(rule.assigneeIds || "[]");
    const due = new Date(rule.nextRunAt.getTime() + rule.dueOffsetDays * 86_400_000);
    const task = await prisma.task.create({
      data: {
        companyId: rule.companyId,
        title: rule.title,
        description: rule.description,
        categoryId: rule.categoryId,
        priority: rule.priority,
        status: assigneeIds.length ? "ASSIGNED" : "DRAFT",
        visibility: rule.visibility,
        matterId: rule.matterId,
        clientId: rule.clientId,
        dueDate: due,
        recurringRuleId: rule.id,
        createdById: rule.createdById,
        assignments: {
          create: assigneeIds.map((userId) => ({ userId, assignedById: rule.createdById })),
        },
      },
    });
    await notify(rule.companyId, assigneeIds, "TASK_ASSIGNED", `Recurring task: ${task.title}`, `/tasks/${task.id}`);
    const next = advanceSchedule(rule.nextRunAt, rule.frequency, rule.interval, rule.dayOfMonth);
    await prisma.recurringTaskRule.update({
      where: { id: rule.id },
      data: { nextRunAt: next, active: rule.endsAt ? next <= rule.endsAt : true },
    });
    result.recurred += 1;
  }

  // 4) Daily digest (?job=daily) — one summary per user with open tasks.
  if (req.nextUrl.searchParams.get("job") === "daily") {
    const open = await prisma.task.findMany({
      where: { deletedAt: null, status: { notIn: ["COMPLETED", "ARCHIVED"] } },
      include: { assignments: true },
    });
    const perUser = new Map<string, { companyId: string; open: number; overdue: number; dueToday: number }>();
    const endOfDay = new Date(startOfDay.getTime() + 86_400_000);
    for (const t of open) {
      for (const a of t.assignments) {
        const s = perUser.get(a.userId) ?? { companyId: t.companyId, open: 0, overdue: 0, dueToday: 0 };
        s.open += 1;
        if (t.dueDate && t.dueDate < now) s.overdue += 1;
        else if (t.dueDate && t.dueDate >= startOfDay && t.dueDate < endOfDay) s.dueToday += 1;
        perUser.set(a.userId, s);
      }
    }
    for (const [userId, s] of perUser) {
      const already = await prisma.notification.findFirst({
        where: { userId, type: "DAILY_SUMMARY", createdAt: { gte: startOfDay } },
        select: { id: true },
      });
      if (already) continue;
      await notify(
        s.companyId,
        [userId],
        "DAILY_SUMMARY",
        `Tasks today: ${s.dueToday} due, ${s.overdue} overdue, ${s.open} open`,
        "/tasks",
      );
      result.digests += 1;
    }
  }

  return NextResponse.json({ ok: true, ...result });
}

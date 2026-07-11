// Shared helpers for the Tasks module: visibility filtering, status-transition
// guard, dependency cycle detection, and in-app notifications.
import "server-only";
import { prisma } from "./prisma";
import { AuthError, type CurrentUser } from "./auth";
import { TASK_TRANSITIONS } from "./constants";

/**
 * Visibility filter applied in the WHERE clause of every task query.
 * PUBLIC → everyone in the company; PRIVATE → creator/assignee/shared;
 * MATTER → anyone holding matter:read; task:admin sees everything.
 */
export function taskVisibilityWhere(user: CurrentUser): Record<string, unknown> {
  if (user.permissions.has("task:admin")) return {};
  const or: Record<string, unknown>[] = [
    { visibility: "PUBLIC" },
    { createdById: user.id },
    { assignments: { some: { userId: user.id } } },
    { shares: { some: { userId: user.id } } },
  ];
  if (user.permissions.has("matter:read")) or.push({ visibility: "MATTER" });
  return { OR: or };
}

export function assertTransition(from: string, to: string): void {
  if (from === to) return;
  if (!(TASK_TRANSITIONS[from] ?? []).includes(to)) {
    throw new AuthError(422, `illegal_transition:${from}->${to}`);
  }
}

/** Load a task the user can see, or 404. */
export async function loadVisibleTask(user: CurrentUser, id: string) {
  const task = await prisma.task.findFirst({
    where: { id, companyId: user.companyId, deletedAt: null, ...taskVisibilityWhere(user) },
    include: { assignments: true, category: true },
  });
  if (!task) throw new AuthError(404, "not_found");
  return task;
}

/** Creator, assignee, or task:admin. */
export function canModify(
  user: CurrentUser,
  task: { createdById: string; assignments: { userId: string }[] },
): boolean {
  return (
    user.permissions.has("task:admin") ||
    task.createdById === user.id ||
    task.assignments.some((a) => a.userId === user.id)
  );
}

export function assertCanModify(
  user: CurrentUser,
  task: { createdById: string; assignments: { userId: string }[] },
): void {
  if (!canModify(user, task)) throw new AuthError(403, "not_creator_or_assignee");
}

/**
 * Reject a dependency edge task -> dependsOn if it would create a cycle,
 * i.e. if `taskId` is reachable from `dependsOnId` via existing edges.
 */
export async function assertNoCycle(taskId: string, dependsOnId: string): Promise<void> {
  if (taskId === dependsOnId) throw new AuthError(422, "dependency_cycle");
  const visited = new Set<string>();
  let frontier = [dependsOnId];
  while (frontier.length) {
    const edges = await prisma.taskDependency.findMany({
      where: { taskId: { in: frontier } },
      select: { dependsOnId: true },
    });
    const next: string[] = [];
    for (const e of edges) {
      if (e.dependsOnId === taskId) throw new AuthError(422, "dependency_cycle");
      if (!visited.has(e.dependsOnId)) {
        visited.add(e.dependsOnId);
        next.push(e.dependsOnId);
      }
    }
    frontier = next;
  }
}

/** Create in-app notification rows (email/SMS hooks degrade silently). */
export async function notify(
  companyId: string,
  userIds: string[],
  type: string,
  title: string,
  linkPath?: string,
  body?: string,
): Promise<void> {
  const unique = Array.from(new Set(userIds)).filter(Boolean);
  if (!unique.length) return;
  await prisma.notification.createMany({
    data: unique.map((userId) => ({
      companyId,
      userId,
      type,
      title,
      body: body ?? null,
      linkPath: linkPath ?? null,
    })),
  });
}

/** Advance a recurring rule's nextRunAt by one schedule step. */
export function advanceSchedule(
  from: Date,
  frequency: string,
  interval: number,
  dayOfMonth?: number | null,
): Date {
  const d = new Date(from);
  switch (frequency) {
    case "DAILY":
      d.setUTCDate(d.getUTCDate() + interval);
      break;
    case "WEEKLY":
      d.setUTCDate(d.getUTCDate() + 7 * interval);
      break;
    case "MONTHLY": {
      const targetDay = dayOfMonth ?? d.getUTCDate();
      d.setUTCDate(1);
      d.setUTCMonth(d.getUTCMonth() + interval);
      const daysInMonth = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
      d.setUTCDate(Math.min(targetDay, daysInMonth));
      break;
    }
    case "YEARLY":
      d.setUTCFullYear(d.getUTCFullYear() + interval);
      break;
  }
  return d;
}

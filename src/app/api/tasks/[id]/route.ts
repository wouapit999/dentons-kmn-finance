import { NextRequest } from "next/server";
import { handle } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { requireUser, AuthError } from "@/lib/auth";
import { updateTaskSchema } from "@/lib/validation";
import {
  taskVisibilityWhere,
  assertTransition,
  assertCanModify,
  canModify,
} from "@/lib/tasks";
import { writeAudit } from "@/lib/audit";

export const dynamic = "force-dynamic";

// GET /api/tasks/:id — full detail incl. matter context, subtasks, deps,
// comments, attachments (meta only), reminders and the audit tail.
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  return handle(async () => {
    const user = await requireUser();
    const t = await prisma.task.findFirst({
      where: {
        id: params.id,
        companyId: user.companyId,
        deletedAt: null,
        ...taskVisibilityWhere(user),
      },
      include: {
        category: { select: { key: true, name: true, isCourtDeadline: true } },
        matter: {
          select: {
            id: true,
            code: true,
            name: true,
            client: { select: { name: true } },
            responsiblePartner: { select: { fullName: true } },
          },
        },
        client: { select: { id: true, name: true } },
        parent: { select: { id: true, title: true } },
        subtasks: {
          where: { deletedAt: null },
          select: { id: true, title: true, status: true, priority: true, dueDate: true },
          orderBy: { createdAt: "asc" },
        },
        assignments: { include: { user: { select: { id: true, fullName: true } } } },
        blockedBy: {
          include: { dependsOn: { select: { id: true, title: true, status: true } } },
        },
        comments: {
          include: { author: { select: { fullName: true } } },
          orderBy: { createdAt: "desc" },
          take: 100,
        },
        attachments: {
          select: { id: true, filename: true, mime: true, sizeBytes: true, createdAt: true },
          orderBy: { createdAt: "desc" },
        },
        reminders: { orderBy: { remindAt: "asc" } },
      },
    });
    if (!t) throw new AuthError(404, "not_found");

    const audit = await prisma.auditLog.findMany({
      where: { companyId: user.companyId, entityType: "Task", entityId: t.id },
      orderBy: { createdAt: "desc" },
      take: 25,
      include: { actor: { select: { fullName: true } } },
    });

    const now = Date.now();
    return {
      id: t.id,
      title: t.title,
      description: t.description,
      priority: t.priority,
      status: t.status,
      visibility: t.visibility,
      category: t.category,
      // Rule: matter-linked tasks always carry matter number, client, partner.
      matter: t.matter
        ? {
            id: t.matter.id,
            code: t.matter.code,
            name: t.matter.name,
            client: t.matter.client.name,
            responsiblePartner: t.matter.responsiblePartner?.fullName ?? null,
          }
        : null,
      client: t.client,
      parent: t.parent,
      dueDate: t.dueDate,
      overdue:
        !!t.dueDate && t.dueDate.getTime() < now && !["COMPLETED", "ARCHIVED"].includes(t.status),
      billable: t.billable,
      estimatedMin: t.estimatedMin,
      loggedMin: t.loggedMin,
      timeEntryId: t.timeEntryId,
      completedAt: t.completedAt,
      createdById: t.createdById,
      canModify: canModify(user, t),
      subtasks: t.subtasks,
      assignees: t.assignments.map((a) => ({ id: a.user.id, name: a.user.fullName })),
      dependencies: t.blockedBy.map((d) => d.dependsOn),
      comments: t.comments.map((c) => ({
        id: c.id,
        author: c.author.fullName,
        body: c.body,
        createdAt: c.createdAt,
      })),
      attachments: t.attachments,
      reminders: t.reminders.map((r) => ({
        id: r.id,
        remindAt: r.remindAt,
        channel: r.channel,
        sent: !!r.sentAt,
      })),
      activity: audit.map((a) => ({
        action: a.action,
        actor: a.actor?.fullName ?? "system",
        at: a.createdAt,
      })),
    };
  });
}

// PATCH /api/tasks/:id — field updates + guarded status transitions.
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  return handle(async () => {
    const user = await requireUser();
    const input = updateTaskSchema.parse(await req.json());

    const task = await prisma.task.findFirst({
      where: {
        id: params.id,
        companyId: user.companyId,
        deletedAt: null,
        ...taskVisibilityWhere(user),
      },
      include: { assignments: true, category: true },
    });
    if (!task) throw new AuthError(404, "not_found");
    assertCanModify(user, task);

    if (input.status) {
      assertTransition(task.status, input.status);
      // COMPLETED must go through /complete so its guards can't be skipped.
      if (input.status === "COMPLETED") throw new AuthError(422, "use_complete_endpoint");
    }
    // Court-deadline tasks stay CRITICAL.
    const priority = task.category?.isCourtDeadline ? "CRITICAL" : input.priority;

    const before = { status: task.status, priority: task.priority, dueDate: task.dueDate };
    await prisma.task.update({
      where: { id: task.id },
      data: {
        title: input.title,
        description: input.description,
        priority,
        visibility: input.visibility,
        status: input.status,
        dueDate:
          input.dueDate === undefined
            ? undefined
            : input.dueDate === null || input.dueDate === ""
              ? null
              : new Date(input.dueDate),
        billable: input.billable,
        estimatedMin: input.estimatedMin === undefined ? undefined : input.estimatedMin,
        version: { increment: 1 },
      },
    });

    await writeAudit({
      companyId: user.companyId,
      actorId: user.id,
      action: input.status ? "TASK_STATUS" : "TASK_UPDATED",
      entityType: "Task",
      entityId: task.id,
      before,
      after: input,
    });
    return { ok: true };
  });
}

// DELETE /api/tasks/:id — soft delete (creator or task:admin only).
export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  return handle(async () => {
    const user = await requireUser();
    const task = await prisma.task.findFirst({
      where: { id: params.id, companyId: user.companyId, deletedAt: null },
    });
    if (!task) throw new AuthError(404, "not_found");
    if (task.createdById !== user.id && !user.permissions.has("task:admin")) {
      throw new AuthError(403, "not_creator");
    }
    await prisma.task.update({
      where: { id: task.id },
      data: { deletedAt: new Date(), status: "ARCHIVED" },
    });
    await writeAudit({
      companyId: user.companyId,
      actorId: user.id,
      action: "TASK_DELETED",
      entityType: "Task",
      entityId: task.id,
      before: { title: task.title },
    });
    return { ok: true };
  });
}

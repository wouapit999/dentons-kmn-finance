import { NextRequest } from "next/server";
import { handle } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { requireUser, AuthError } from "@/lib/auth";
import { createTaskSchema } from "@/lib/validation";
import { taskVisibilityWhere, notify, assertNoCycle } from "@/lib/tasks";
import { writeAudit } from "@/lib/audit";

export const dynamic = "force-dynamic";

// GET /api/tasks — list visible tasks with filters.
// Filters: assignee=me|<id>, matterId, clientId, status, priority, categoryKey,
// overdue=1, q (title search), parentId (defaults to top-level only).
export async function GET(req: NextRequest) {
  return handle(async () => {
    const user = await requireUser();
    const p = req.nextUrl.searchParams;

    const where: Record<string, unknown> = {
      companyId: user.companyId,
      deletedAt: null,
      ...taskVisibilityWhere(user),
    };
    if (p.get("parentId")) where.parentId = p.get("parentId");
    else where.parentId = null; // dashboard shows top-level; subtasks live in detail
    if (p.get("status")) where.status = p.get("status");
    if (p.get("priority")) where.priority = p.get("priority");
    if (p.get("matterId")) where.matterId = p.get("matterId");
    if (p.get("clientId")) where.clientId = p.get("clientId");
    if (p.get("categoryKey")) where.category = { key: p.get("categoryKey") };
    if (p.get("q")) where.title = { contains: p.get("q") };
    const assignee = p.get("assignee");
    if (assignee) {
      where.assignments = { some: { userId: assignee === "me" ? user.id : assignee } };
    }
    if (p.get("overdue") === "1") {
      where.dueDate = { lt: new Date() };
      where.status = { notIn: ["COMPLETED", "ARCHIVED"] };
    }

    const tasks = await prisma.task.findMany({
      where,
      orderBy: [{ dueDate: "asc" }, { createdAt: "desc" }],
      take: 300,
      include: {
        category: { select: { key: true, name: true } },
        matter: { select: { code: true } },
        client: { select: { name: true } },
        assignments: { include: { user: { select: { id: true, fullName: true } } } },
        _count: { select: { subtasks: true, comments: true } },
      },
    });

    const now = Date.now();
    return tasks.map((t) => ({
      id: t.id,
      title: t.title,
      priority: t.priority,
      status: t.status,
      visibility: t.visibility,
      category: t.category?.name ?? null,
      matter: t.matter?.code ?? null,
      client: t.client?.name ?? null,
      dueDate: t.dueDate,
      overdue:
        !!t.dueDate && t.dueDate.getTime() < now && !["COMPLETED", "ARCHIVED"].includes(t.status),
      assignees: t.assignments.map((a) => a.user.fullName),
      subtasks: t._count.subtasks,
      comments: t._count.comments,
      createdById: t.createdById,
      completedAt: t.completedAt,
    }));
  });
}

// POST /api/tasks — anyone can create. Court-deadline categories force CRITICAL.
export async function POST(req: NextRequest) {
  return handle(async () => {
    const user = await requireUser();
    const input = createTaskSchema.parse(await req.json());

    const category = input.categoryKey
      ? await prisma.taskCategory.findFirst({
          where: { companyId: user.companyId, key: input.categoryKey },
        })
      : null;
    if (input.categoryKey && !category) throw new AuthError(422, "invalid_category");

    if (input.matterId) {
      const matter = await prisma.matter.findFirst({
        where: { id: input.matterId, companyId: user.companyId },
      });
      if (!matter) throw new AuthError(422, "invalid_matter");
    }
    if (input.clientId) {
      const client = await prisma.client.findFirst({
        where: { id: input.clientId, companyId: user.companyId, deletedAt: null },
      });
      if (!client) throw new AuthError(422, "invalid_client");
    }
    if (input.parentId) {
      const parent = await prisma.task.findFirst({
        where: { id: input.parentId, companyId: user.companyId, deletedAt: null },
      });
      if (!parent) throw new AuthError(422, "invalid_parent");
    }
    if (input.assigneeIds.length) {
      const count = await prisma.user.count({
        where: { id: { in: input.assigneeIds }, companyId: user.companyId, deletedAt: null },
      });
      if (count !== input.assigneeIds.length) throw new AuthError(422, "invalid_assignee");
    }

    // Business rule: court deadlines are always CRITICAL.
    const priority = category?.isCourtDeadline ? "CRITICAL" : input.priority;

    const task = await prisma.task.create({
      data: {
        companyId: user.companyId,
        title: input.title,
        description: input.description || null,
        categoryId: category?.id ?? null,
        priority,
        status: input.assigneeIds.length ? "ASSIGNED" : "DRAFT",
        visibility: input.visibility,
        matterId: input.matterId || null,
        clientId: input.clientId || null,
        parentId: input.parentId || null,
        dueDate: input.dueDate ? new Date(input.dueDate) : null,
        billable: input.billable ?? category?.isBillable ?? false,
        estimatedMin: input.estimatedMin ?? null,
        createdById: user.id,
        assignments: {
          create: input.assigneeIds.map((userId) => ({ userId, assignedById: user.id })),
        },
      },
    });

    for (const depId of input.dependsOnIds) {
      const dep = await prisma.task.findFirst({
        where: { id: depId, companyId: user.companyId, deletedAt: null },
      });
      if (!dep) throw new AuthError(422, "invalid_dependency");
      await assertNoCycle(task.id, depId);
      await prisma.taskDependency.create({ data: { taskId: task.id, dependsOnId: depId } });
    }

    await notify(
      user.companyId,
      input.assigneeIds.filter((id) => id !== user.id),
      "TASK_ASSIGNED",
      `New task: ${task.title}`,
      `/tasks/${task.id}`,
    );
    await writeAudit({
      companyId: user.companyId,
      actorId: user.id,
      action: "TASK_CREATED",
      entityType: "Task",
      entityId: task.id,
      after: { title: task.title, priority: task.priority, status: task.status },
    });

    return { id: task.id, priority: task.priority, status: task.status };
  });
}

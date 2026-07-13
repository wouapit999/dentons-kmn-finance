// Pinto's "co-working" tools. These let Pinto ACT in the app on the signed-in
// user's behalf — but only for collaboration/task work, and always under the
// user's own identity and permissions (Pinto can never do more than the user).
//
// HARD EXCLUSIONS (no tool exists for these, by design):
//   • Financial engagement — invoices, payments/receipts, trust, payroll, GL /
//     journals, AP / bills, budgets, cash, bank, procurement, fixed assets.
//   • IT / administration — creating or editing users & roles, security /
//     password administration, AI settings.
// If asked to do those, Pinto explains it can't and points to the right person.
import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { prisma } from "./prisma";
import type { CurrentUser } from "./auth";
import { taskVisibilityWhere, canModify, notify } from "./tasks";
import { writeAudit } from "./audit";

export interface ToolContext {
  user: CurrentUser;
}

// Tool schemas advertised to the model.
export const PINTO_TOOLS: Anthropic.Tool[] = [
  {
    name: "find_colleague",
    description:
      "Search the firm directory for active colleagues by name or email. Use to resolve who to assign/delegate a task to before calling create_task or delegate_task.",
    input_schema: {
      type: "object",
      properties: { query: { type: "string", description: "Part of a name or email" } },
      required: ["query"],
    },
  },
  {
    name: "list_my_tasks",
    description: "List the signed-in user's own tasks (created by or assigned to them). Optionally filter by status.",
    input_schema: {
      type: "object",
      properties: {
        status: {
          type: "string",
          enum: ["OPEN", "DRAFT", "ASSIGNED", "IN_PROGRESS", "WAITING", "COMPLETED"],
          description: "OPEN = anything not completed/archived (default).",
        },
      },
    },
  },
  {
    name: "create_task",
    description:
      "Create a task in the firm task system. Anyone may create tasks. Optionally assign colleagues (delegate) by their email or exact name. Court-deadline categories are forced to CRITICAL priority.",
    input_schema: {
      type: "object",
      properties: {
        title: { type: "string" },
        description: { type: "string" },
        priority: { type: "string", enum: ["LOW", "MEDIUM", "HIGH", "CRITICAL"] },
        dueDate: { type: "string", description: "ISO date, e.g. 2026-08-01" },
        assignees: {
          type: "array",
          items: { type: "string" },
          description: "Emails or exact names of colleagues to assign. Resolve with find_colleague first if unsure.",
        },
        categoryKey: { type: "string" },
        matterCode: { type: "string", description: "Link to a matter by its code." },
        clientName: { type: "string", description: "Link to a client by name." },
        visibility: { type: "string", enum: ["PRIVATE", "MATTER", "PUBLIC"] },
      },
      required: ["title"],
    },
  },
  {
    name: "delegate_task",
    description:
      "Delegate/assign an existing task to one or more colleagues (added to any current assignees). You must be the task's creator or an assignee (or hold task:admin).",
    input_schema: {
      type: "object",
      properties: {
        task: { type: "string", description: "Task id or a distinctive part of its title." },
        assignees: { type: "array", items: { type: "string" }, description: "Emails or exact names." },
      },
      required: ["task", "assignees"],
    },
  },
  {
    name: "comment_on_task",
    description: "Post a comment on a task the user can see. Notifies the creator and assignees.",
    input_schema: {
      type: "object",
      properties: {
        task: { type: "string", description: "Task id or a distinctive part of its title." },
        body: { type: "string" },
      },
      required: ["task", "body"],
    },
  },
];

// Resolve a list of email-or-name strings to active user rows in the company.
async function resolveUsers(ctx: ToolContext, list: string[]) {
  const resolved: { id: string; fullName: string }[] = [];
  const unresolved: string[] = [];
  for (const raw of list) {
    const q = raw.trim();
    if (!q) continue;
    const u = await prisma.user.findFirst({
      where: {
        companyId: ctx.user.companyId,
        deletedAt: null,
        status: { not: "DISABLED" },
        OR: [{ email: { equals: q } }, { fullName: { equals: q } }, { fullName: { contains: q } }],
      },
      select: { id: true, fullName: true },
    });
    if (u) resolved.push(u);
    else unresolved.push(q);
  }
  // de-dup
  const seen = new Set<string>();
  return { resolved: resolved.filter((u) => (seen.has(u.id) ? false : seen.add(u.id))), unresolved };
}

async function findTask(ctx: ToolContext, query: string) {
  return prisma.task.findFirst({
    where: {
      companyId: ctx.user.companyId,
      deletedAt: null,
      ...taskVisibilityWhere(ctx.user),
      OR: [{ id: query }, { title: { contains: query } }],
    },
    include: { assignments: true },
    orderBy: { createdAt: "desc" },
  });
}

// Execute one tool call. Always returns a JSON-serialisable object; never throws
// (errors are returned as { error } so the model can recover and explain).
export async function runPintoTool(
  name: string,
  input: Record<string, unknown>,
  ctx: ToolContext,
): Promise<unknown> {
  try {
    switch (name) {
      case "find_colleague": {
        const q = String(input.query ?? "").trim();
        if (!q) return { error: "query required" };
        const users = await prisma.user.findMany({
          where: {
            companyId: ctx.user.companyId,
            deletedAt: null,
            status: { not: "DISABLED" },
            OR: [{ fullName: { contains: q } }, { email: { contains: q } }],
          },
          select: { fullName: true, email: true },
          take: 8,
        });
        return { matches: users };
      }

      case "list_my_tasks": {
        const status = String(input.status ?? "OPEN");
        const where: Record<string, unknown> = {
          companyId: ctx.user.companyId,
          deletedAt: null,
          OR: [{ createdById: ctx.user.id }, { assignments: { some: { userId: ctx.user.id } } }],
        };
        if (status === "OPEN") where.status = { notIn: ["COMPLETED", "ARCHIVED"] };
        else if (status) where.status = status;
        const tasks = await prisma.task.findMany({
          where,
          select: { id: true, title: true, priority: true, status: true, dueDate: true },
          orderBy: [{ dueDate: "asc" }, { createdAt: "desc" }],
          take: 25,
        });
        return { count: tasks.length, tasks };
      }

      case "create_task": {
        const title = String(input.title ?? "").trim();
        if (!title) return { error: "title required" };

        const category = input.categoryKey
          ? await prisma.taskCategory.findFirst({
              where: { companyId: ctx.user.companyId, key: String(input.categoryKey) },
            })
          : null;
        let matterId: string | null = null;
        if (input.matterCode) {
          const m = await prisma.matter.findFirst({
            where: { companyId: ctx.user.companyId, code: String(input.matterCode) },
            select: { id: true },
          });
          matterId = m?.id ?? null;
        }
        let clientId: string | null = null;
        if (input.clientName) {
          const c = await prisma.client.findFirst({
            where: { companyId: ctx.user.companyId, deletedAt: null, name: { contains: String(input.clientName) } },
            select: { id: true },
          });
          clientId = c?.id ?? null;
        }

        const assigneeList = Array.isArray(input.assignees) ? (input.assignees as string[]) : [];
        const { resolved, unresolved } = await resolveUsers(ctx, assigneeList);

        const priority = category?.isCourtDeadline
          ? "CRITICAL"
          : ["LOW", "MEDIUM", "HIGH", "CRITICAL"].includes(String(input.priority))
            ? String(input.priority)
            : "MEDIUM";
        const visibility = ["PRIVATE", "MATTER", "PUBLIC"].includes(String(input.visibility))
          ? String(input.visibility)
          : "PUBLIC";
        const due = input.dueDate ? new Date(String(input.dueDate)) : null;

        const task = await prisma.task.create({
          data: {
            companyId: ctx.user.companyId,
            title,
            description: input.description ? String(input.description) : null,
            categoryId: category?.id ?? null,
            priority,
            status: resolved.length ? "ASSIGNED" : "DRAFT",
            visibility,
            matterId,
            clientId,
            dueDate: due && !isNaN(due.getTime()) ? due : null,
            billable: category?.isBillable ?? false,
            createdById: ctx.user.id,
            assignments: { create: resolved.map((u) => ({ userId: u.id, assignedById: ctx.user.id })) },
          },
        });
        await notify(
          ctx.user.companyId,
          resolved.map((u) => u.id).filter((id) => id !== ctx.user.id),
          "TASK_ASSIGNED",
          `New task: ${task.title}`,
          `/tasks/${task.id}`,
        );
        await writeAudit({
          companyId: ctx.user.companyId,
          actorId: ctx.user.id,
          action: "TASK_CREATED",
          entityType: "Task",
          entityId: task.id,
          after: { title, priority, via: "pinto" },
        });
        return {
          ok: true,
          taskId: task.id,
          priority,
          assigned: resolved.map((u) => u.fullName),
          unresolvedAssignees: unresolved,
          link: `/tasks/${task.id}`,
        };
      }

      case "delegate_task": {
        const task = await findTask(ctx, String(input.task ?? ""));
        if (!task) return { error: "task not found or not visible to you" };
        if (!canModify(ctx.user, task))
          return { error: "you can only delegate tasks you created or are assigned to" };
        const list = Array.isArray(input.assignees) ? (input.assignees as string[]) : [];
        const { resolved, unresolved } = await resolveUsers(ctx, list);
        if (!resolved.length) return { error: "no colleague matched", unresolvedAssignees: unresolved };

        const existing = new Set(task.assignments.map((a) => a.userId));
        const toAdd = resolved.filter((u) => !existing.has(u.id));
        await prisma.$transaction(async (tx) => {
          if (toAdd.length) {
            await tx.taskAssignment.createMany({
              data: toAdd.map((u) => ({ taskId: task.id, userId: u.id, assignedById: ctx.user.id })),
            });
          }
          if (task.status === "DRAFT" && (existing.size || toAdd.length)) {
            await tx.task.update({ where: { id: task.id }, data: { status: "ASSIGNED" } });
          }
        });
        await notify(
          ctx.user.companyId,
          toAdd.map((u) => u.id).filter((id) => id !== ctx.user.id),
          "TASK_ASSIGNED",
          `You were assigned: ${task.title}`,
          `/tasks/${task.id}`,
        );
        await writeAudit({
          companyId: ctx.user.companyId,
          actorId: ctx.user.id,
          action: "TASK_ASSIGNED",
          entityType: "Task",
          entityId: task.id,
          after: { added: toAdd.map((u) => u.fullName), via: "pinto" },
        });
        return {
          ok: true,
          taskId: task.id,
          title: task.title,
          delegatedTo: toAdd.map((u) => u.fullName),
          unresolvedAssignees: unresolved,
          link: `/tasks/${task.id}`,
        };
      }

      case "comment_on_task": {
        const task = await findTask(ctx, String(input.task ?? ""));
        if (!task) return { error: "task not found or not visible to you" };
        const body = String(input.body ?? "").trim();
        if (!body) return { error: "body required" };
        const comment = await prisma.taskComment.create({
          data: { taskId: task.id, authorId: ctx.user.id, body },
        });
        await notify(
          ctx.user.companyId,
          [task.createdById, ...task.assignments.map((a) => a.userId)].filter((id) => id !== ctx.user.id),
          "TASK_COMMENT",
          `New comment on: ${task.title}`,
          `/tasks/${task.id}`,
          body.slice(0, 140),
        );
        await writeAudit({
          companyId: ctx.user.companyId,
          actorId: ctx.user.id,
          action: "TASK_COMMENT",
          entityType: "Task",
          entityId: task.id,
          after: { via: "pinto" },
        });
        return { ok: true, taskId: task.id, commentId: comment.id, link: `/tasks/${task.id}` };
      }

      default:
        return { error: `unknown tool ${name}` };
    }
  } catch (e) {
    return { error: (e as { message?: string })?.message ?? "tool failed" };
  }
}

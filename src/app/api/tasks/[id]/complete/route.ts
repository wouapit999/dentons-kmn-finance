import { NextRequest } from "next/server";
import { handle } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { requireUser, AuthError } from "@/lib/auth";
import { loadVisibleTask, assertCanModify, assertTransition, notify } from "@/lib/tasks";
import { writeAudit } from "@/lib/audit";

export const dynamic = "force-dynamic";

// POST /api/tasks/:id/complete — all completion guards in one place:
//  - only creator/assignee/task:admin
//  - legal transition from the current status
//  - all dependencies COMPLETED
//  - all subtasks COMPLETED/ARCHIVED
//  - billable + matter + loggedMin>0 → creates a DRAFT TimeEntry (billing sync)
export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  return handle(async () => {
    const user = await requireUser();
    const task = await loadVisibleTask(user, params.id);
    assertCanModify(user, task);
    assertTransition(task.status, "COMPLETED");

    const blockers = await prisma.taskDependency.findMany({
      where: { taskId: task.id, dependsOn: { status: { not: "COMPLETED" }, deletedAt: null } },
      include: { dependsOn: { select: { id: true, title: true, status: true } } },
    });
    if (blockers.length) {
      throw new AuthError(422, "blocked_by_dependencies");
    }

    const openSubtasks = await prisma.task.count({
      where: {
        parentId: task.id,
        deletedAt: null,
        status: { notIn: ["COMPLETED", "ARCHIVED"] },
      },
    });
    if (openSubtasks > 0) throw new AuthError(422, "open_subtasks");

    let timeEntryId: string | null = null;
    await prisma.$transaction(async (tx) => {
      // Billing sync: completed billable matter work becomes a DRAFT time entry
      // that flows through the existing unbilled -> invoice pipeline.
      if (task.billable && task.matterId && task.loggedMin > 0 && !task.timeEntryId) {
        const te = await tx.timeEntry.create({
          data: {
            companyId: user.companyId,
            matterId: task.matterId,
            lawyerId: user.id,
            date: new Date(),
            minutes: task.loggedMin,
            billable: true,
            rate: 0,
            amount: 0,
            currency: "XAF",
            narrative: task.title,
            taskId: task.id,
            createdById: user.id,
          },
        });
        timeEntryId = te.id;
      }
      await tx.task.update({
        where: { id: task.id },
        data: {
          status: "COMPLETED",
          completedAt: new Date(),
          completedById: user.id,
          timeEntryId: timeEntryId ?? undefined,
          version: { increment: 1 },
        },
      });
    });

    await notify(
      user.companyId,
      [task.createdById, ...task.assignments.map((a) => a.userId)].filter((id) => id !== user.id),
      "TASK_COMPLETED",
      `Completed: ${task.title}`,
      `/tasks/${task.id}`,
    );
    await writeAudit({
      companyId: user.companyId,
      actorId: user.id,
      action: "TASK_COMPLETED",
      entityType: "Task",
      entityId: task.id,
      after: { timeEntryId, loggedMin: task.loggedMin },
    });
    return { ok: true, timeEntryId };
  });
}

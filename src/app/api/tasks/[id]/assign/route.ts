import { NextRequest } from "next/server";
import { handle } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { requireUser, AuthError } from "@/lib/auth";
import { assignTaskSchema } from "@/lib/validation";
import { loadVisibleTask, assertCanModify, notify } from "@/lib/tasks";
import { writeAudit } from "@/lib/audit";

export const dynamic = "force-dynamic";

// POST /api/tasks/:id/assign — replace the assignment set; notifies new assignees.
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  return handle(async () => {
    const user = await requireUser();
    const { userIds } = assignTaskSchema.parse(await req.json());
    const task = await loadVisibleTask(user, params.id);
    assertCanModify(user, task);

    const valid = await prisma.user.count({
      where: { id: { in: userIds }, companyId: user.companyId, deletedAt: null },
    });
    if (valid !== userIds.length) throw new AuthError(422, "invalid_assignee");

    const previous = new Set(task.assignments.map((a) => a.userId));
    await prisma.$transaction(async (tx) => {
      await tx.taskAssignment.deleteMany({ where: { taskId: task.id } });
      await tx.taskAssignment.createMany({
        data: userIds.map((userId) => ({ taskId: task.id, userId, assignedById: user.id })),
      });
      if (task.status === "DRAFT") {
        await tx.task.update({ where: { id: task.id }, data: { status: "ASSIGNED" } });
      }
    });

    const added = userIds.filter((id) => !previous.has(id) && id !== user.id);
    await notify(user.companyId, added, "TASK_ASSIGNED", `You were assigned: ${task.title}`, `/tasks/${task.id}`);
    await writeAudit({
      companyId: user.companyId,
      actorId: user.id,
      action: "TASK_ASSIGNED",
      entityType: "Task",
      entityId: task.id,
      before: { assignees: Array.from(previous) },
      after: { assignees: userIds },
    });
    return { ok: true };
  });
}

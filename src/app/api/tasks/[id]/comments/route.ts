import { NextRequest } from "next/server";
import { handle } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { taskCommentSchema } from "@/lib/validation";
import { loadVisibleTask, notify } from "@/lib/tasks";
import { writeAudit } from "@/lib/audit";

export const dynamic = "force-dynamic";

// POST /api/tasks/:id/comments — anyone who can SEE the task can comment.
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  return handle(async () => {
    const user = await requireUser();
    const { body } = taskCommentSchema.parse(await req.json());
    const task = await loadVisibleTask(user, params.id);

    const comment = await prisma.taskComment.create({
      data: { taskId: task.id, authorId: user.id, body },
    });
    await notify(
      user.companyId,
      [task.createdById, ...task.assignments.map((a) => a.userId)].filter((id) => id !== user.id),
      "TASK_COMMENT",
      `New comment on: ${task.title}`,
      `/tasks/${task.id}`,
      body.slice(0, 140),
    );
    await writeAudit({
      companyId: user.companyId,
      actorId: user.id,
      action: "TASK_COMMENT",
      entityType: "Task",
      entityId: task.id,
    });
    return { id: comment.id };
  });
}

import { NextRequest } from "next/server";
import { handle } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { taskLogTimeSchema } from "@/lib/validation";
import { loadVisibleTask, assertCanModify } from "@/lib/tasks";
import { writeAudit } from "@/lib/audit";

export const dynamic = "force-dynamic";

// POST /api/tasks/:id/log-time — accumulate minutes on the task.
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  return handle(async () => {
    const user = await requireUser();
    const { minutes } = taskLogTimeSchema.parse(await req.json());
    const task = await loadVisibleTask(user, params.id);
    assertCanModify(user, task);

    const updated = await prisma.task.update({
      where: { id: task.id },
      data: { loggedMin: { increment: minutes } },
    });
    await writeAudit({
      companyId: user.companyId,
      actorId: user.id,
      action: "TASK_TIME_LOGGED",
      entityType: "Task",
      entityId: task.id,
      after: { minutes, total: updated.loggedMin },
    });
    return { loggedMin: updated.loggedMin };
  });
}

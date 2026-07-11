import { NextRequest } from "next/server";
import { handle } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { requireUser, AuthError } from "@/lib/auth";
import { taskDependencySchema } from "@/lib/validation";
import { loadVisibleTask, assertCanModify, assertNoCycle } from "@/lib/tasks";
import { writeAudit } from "@/lib/audit";

export const dynamic = "force-dynamic";

// POST /api/tasks/:id/dependencies — this task depends on another (cycle-checked).
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  return handle(async () => {
    const user = await requireUser();
    const { dependsOnId } = taskDependencySchema.parse(await req.json());
    const task = await loadVisibleTask(user, params.id);
    assertCanModify(user, task);

    const dep = await prisma.task.findFirst({
      where: { id: dependsOnId, companyId: user.companyId, deletedAt: null },
    });
    if (!dep) throw new AuthError(422, "invalid_dependency");

    await assertNoCycle(task.id, dependsOnId);
    await prisma.taskDependency.upsert({
      where: { taskId_dependsOnId: { taskId: task.id, dependsOnId } },
      update: {},
      create: { taskId: task.id, dependsOnId },
    });
    await writeAudit({
      companyId: user.companyId,
      actorId: user.id,
      action: "TASK_DEPENDENCY_ADDED",
      entityType: "Task",
      entityId: task.id,
      after: { dependsOn: dep.title },
    });
    return { ok: true };
  });
}

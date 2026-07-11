import { NextRequest } from "next/server";
import { handle } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { loadVisibleTask, assertCanModify, assertTransition } from "@/lib/tasks";
import { writeAudit } from "@/lib/audit";

export const dynamic = "force-dynamic";

// POST /api/tasks/:id/archive
export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  return handle(async () => {
    const user = await requireUser();
    const task = await loadVisibleTask(user, params.id);
    assertCanModify(user, task);
    assertTransition(task.status, "ARCHIVED");

    await prisma.task.update({
      where: { id: task.id },
      data: { status: "ARCHIVED", version: { increment: 1 } },
    });
    await writeAudit({
      companyId: user.companyId,
      actorId: user.id,
      action: "TASK_ARCHIVED",
      entityType: "Task",
      entityId: task.id,
    });
    return { ok: true };
  });
}

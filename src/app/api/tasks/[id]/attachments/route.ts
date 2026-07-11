import { NextRequest } from "next/server";
import { handle } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { requireUser, AuthError } from "@/lib/auth";
import { taskAttachmentSchema } from "@/lib/validation";
import { loadVisibleTask } from "@/lib/tasks";
import { writeAudit } from "@/lib/audit";

export const dynamic = "force-dynamic";

// POST /api/tasks/:id/attachments — small files inline (base64, ~2 MB cap).
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  return handle(async () => {
    const user = await requireUser();
    const input = taskAttachmentSchema.parse(await req.json());
    const task = await loadVisibleTask(user, params.id);

    const sizeBytes = Math.floor(input.base64.length * 0.75);
    if (sizeBytes > 2 * 1024 * 1024) throw new AuthError(422, "file_too_large");

    const att = await prisma.taskAttachment.create({
      data: {
        taskId: task.id,
        filename: input.filename,
        mime: input.mime,
        sizeBytes,
        data: input.base64,
        uploadedBy: user.id,
      },
    });
    await writeAudit({
      companyId: user.companyId,
      actorId: user.id,
      action: "TASK_ATTACHMENT",
      entityType: "Task",
      entityId: task.id,
      after: { filename: input.filename, sizeBytes },
    });
    return { id: att.id };
  });
}

import { NextRequest } from "next/server";
import { handle } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { taskReminderSchema } from "@/lib/validation";
import { loadVisibleTask } from "@/lib/tasks";

export const dynamic = "force-dynamic";

// POST /api/tasks/:id/reminders — schedule a reminder (cron delivers it).
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  return handle(async () => {
    const user = await requireUser();
    const input = taskReminderSchema.parse(await req.json());
    const task = await loadVisibleTask(user, params.id);
    const reminder = await prisma.taskReminder.create({
      data: {
        taskId: task.id,
        remindAt: new Date(input.remindAt),
        channel: input.channel,
        createdBy: user.id,
      },
    });
    return { id: reminder.id };
  });
}

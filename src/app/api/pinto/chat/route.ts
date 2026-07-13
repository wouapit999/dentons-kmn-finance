import { NextRequest } from "next/server";
import { z } from "zod";
import { handle } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { resolveAiConfig } from "@/lib/settings";
import { chatPinto, pintoConfigured } from "@/lib/pinto";

export const dynamic = "force-dynamic";

const schema = z.object({
  messages: z
    .array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().min(1).max(4000) }))
    .min(1)
    .max(30),
});

// POST /api/pinto/chat — talk to Pinto, the in-app help assistant. Available to
// every authenticated user; uses the company's configured Anthropic key.
export async function POST(req: NextRequest) {
  return handle(async () => {
    const user = await requireUser();
    const { messages } = schema.parse(await req.json());

    const cfg = await resolveAiConfig(user.companyId);
    if (!pintoConfigured(cfg)) {
      return {
        configured: false,
        reply:
          "Hi, I'm Pinto! I'm not switched on yet — please ask your IT Administrator to add the Anthropic API key under AI Assistant → AI Settings. Once that's done I can help you use the app.",
      };
    }

    // A small live snapshot so Pinto can help with the user's actual day.
    const now = new Date();
    const [openTasks, overdueTasks, unread] = await Promise.all([
      prisma.task.count({
        where: {
          companyId: user.companyId,
          deletedAt: null,
          status: { notIn: ["COMPLETED", "ARCHIVED"] },
          assignments: { some: { userId: user.id } },
        },
      }),
      prisma.task.count({
        where: {
          companyId: user.companyId,
          deletedAt: null,
          status: { notIn: ["COMPLETED", "ARCHIVED"] },
          dueDate: { lt: now },
          assignments: { some: { userId: user.id } },
        },
      }),
      prisma.notification.count({ where: { userId: user.id, readAt: null } }),
    ]);

    try {
      const reply = await chatPinto(cfg, messages, user, {
        openTasks,
        overdueTasks,
        unreadNotifications: unread,
      });
      return { configured: true, reply };
    } catch (e) {
      // Surface the provider error (invalid key, model not found, no credits…)
      // as a chat reply instead of a blank 500.
      const detail = (e as { message?: string })?.message ?? "unknown error";
      return { configured: true, reply: `Pinto couldn't reach the AI service: ${detail}` };
    }
  });
}

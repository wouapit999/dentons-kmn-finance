import { handle } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

// GET /api/notifications — my inbox (unread first), plus unread count.
export async function GET() {
  return handle(async () => {
    const user = await requireUser();
    const [items, unread] = await Promise.all([
      prisma.notification.findMany({
        where: { userId: user.id },
        orderBy: [{ readAt: "asc" }, { createdAt: "desc" }],
        take: 20,
      }),
      prisma.notification.count({ where: { userId: user.id, readAt: null } }),
    ]);
    return {
      unread,
      items: items.map((n) => ({
        id: n.id,
        type: n.type,
        title: n.title,
        body: n.body,
        linkPath: n.linkPath,
        read: !!n.readAt,
        createdAt: n.createdAt,
      })),
    };
  });
}

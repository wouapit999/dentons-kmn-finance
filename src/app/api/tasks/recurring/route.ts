import { NextRequest } from "next/server";
import { handle } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { requireUser, AuthError } from "@/lib/auth";
import { recurringRuleSchema } from "@/lib/validation";
import { writeAudit } from "@/lib/audit";

export const dynamic = "force-dynamic";

// GET /api/tasks/recurring — list rules (creator's own, or all for task:admin).
export async function GET() {
  return handle(async () => {
    const user = await requireUser();
    const where: Record<string, unknown> = { companyId: user.companyId };
    if (!user.permissions.has("task:admin")) where.createdById = user.id;
    const rules = await prisma.recurringTaskRule.findMany({
      where,
      orderBy: { createdAt: "desc" },
    });
    return rules.map((r) => ({
      id: r.id,
      title: r.title,
      frequency: r.frequency,
      interval: r.interval,
      nextRunAt: r.nextRunAt,
      active: r.active,
    }));
  });
}

// POST /api/tasks/recurring — create a rule; cron generates instances.
export async function POST(req: NextRequest) {
  return handle(async () => {
    const user = await requireUser();
    const input = recurringRuleSchema.parse(await req.json());

    const category = input.categoryKey
      ? await prisma.taskCategory.findFirst({
          where: { companyId: user.companyId, key: input.categoryKey },
        })
      : null;
    if (input.categoryKey && !category) throw new AuthError(422, "invalid_category");

    const rule = await prisma.recurringTaskRule.create({
      data: {
        companyId: user.companyId,
        title: input.title,
        description: input.description || null,
        categoryId: category?.id ?? null,
        priority: category?.isCourtDeadline ? "CRITICAL" : input.priority,
        matterId: input.matterId || null,
        clientId: input.clientId || null,
        assigneeIds: JSON.stringify(input.assigneeIds),
        visibility: input.visibility,
        frequency: input.frequency,
        interval: input.interval,
        dayOfWeek: input.dayOfWeek ?? null,
        dayOfMonth: input.dayOfMonth ?? null,
        dueOffsetDays: input.dueOffsetDays,
        nextRunAt: input.startsAt ? new Date(input.startsAt) : new Date(),
        endsAt: input.endsAt ? new Date(input.endsAt) : null,
        createdById: user.id,
      },
    });
    await writeAudit({
      companyId: user.companyId,
      actorId: user.id,
      action: "TASK_RULE_CREATED",
      entityType: "RecurringTaskRule",
      entityId: rule.id,
      after: { title: rule.title, frequency: rule.frequency },
    });
    return { id: rule.id, nextRunAt: rule.nextRunAt };
  });
}

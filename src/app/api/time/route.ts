import { NextRequest } from "next/server";
import { handle } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { requirePermission, AuthError } from "@/lib/auth";
import { createTimeEntrySchema } from "@/lib/validation";
import { writeAudit } from "@/lib/audit";

export const dynamic = "force-dynamic";

// GET /api/time — recent time entries + billable-hours summary.
export async function GET() {
  return handle(async () => {
    const user = await requirePermission("time:read");
    const entries = await prisma.timeEntry.findMany({
      where: { companyId: user.companyId },
      orderBy: { date: "desc" },
      take: 200,
      include: {
        matter: { select: { code: true, name: true } },
        lawyer: { select: { fullName: true } },
      },
    });

    let billableMinutes = 0;
    let billableAmount = 0;
    for (const e of entries) {
      if (e.billable) {
        billableMinutes += e.minutes;
        billableAmount += Number(e.amount);
      }
    }

    return {
      summary: {
        billableHours: Math.round((billableMinutes / 60) * 100) / 100,
        billableAmount,
        count: entries.length,
      },
      entries: entries.map((e) => ({
        id: e.id,
        date: e.date,
        matter: `${e.matter.code} — ${e.matter.name}`,
        lawyer: e.lawyer.fullName,
        minutes: e.minutes,
        hours: Math.round((e.minutes / 60) * 100) / 100,
        billable: e.billable,
        rate: e.rate.toString(),
        amount: e.amount.toString(),
        currency: e.currency,
        narrative: e.narrative,
        status: e.status,
      })),
    };
  });
}

// POST /api/time — log time. Amount is computed server-side (minutes/60 * rate).
export async function POST(req: NextRequest) {
  return handle(async () => {
    const user = await requirePermission("time:log");
    const input = createTimeEntrySchema.parse(await req.json());

    const matter = await prisma.matter.findFirst({
      where: { id: input.matterId, companyId: user.companyId },
    });
    if (!matter) throw new AuthError(422, "invalid_matter");
    if (matter.status === "CLOSED") throw new AuthError(422, "matter_closed");

    const lawyerId = input.lawyerId || user.id;
    const lawyer = await prisma.user.findFirst({
      where: { id: lawyerId, companyId: user.companyId },
    });
    if (!lawyer) throw new AuthError(422, "invalid_lawyer");

    const amount = Math.round((input.minutes / 60) * input.rate * 100) / 100;

    const created = await prisma.timeEntry.create({
      data: {
        companyId: user.companyId,
        matterId: matter.id,
        lawyerId,
        date: new Date(input.date),
        minutes: input.minutes,
        billable: input.billable,
        rate: input.rate,
        amount,
        currency: input.currency,
        narrative: input.narrative || null,
        createdById: user.id,
      },
    });
    await writeAudit({
      companyId: user.companyId,
      actorId: user.id,
      action: "TIME_LOGGED",
      entityType: "TimeEntry",
      entityId: created.id,
      after: { matter: matter.code, minutes: input.minutes, amount },
    });
    return { id: created.id, amount };
  });
}

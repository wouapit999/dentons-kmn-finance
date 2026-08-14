/*
 * Dentons KMN ERP
 * Copyright (c) 2026 Bouquet Innovation SA. All rights reserved.
 * Proprietary and confidential. Unauthorised copying, distribution, modification,
 * or use of this file, via any medium, is strictly prohibited.
 */
import { NextRequest } from "next/server";
import { handle } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { requirePermission, AuthError } from "@/lib/auth";
import { quickTimeSchema } from "@/lib/validation";
import { writeAudit } from "@/lib/audit";

export const dynamic = "force-dynamic";

// POST /api/time/quick — capture a short duration in one call.
// Used by the in-app "quick capture" buttons (6/12/30 min) and it is the same
// contract an Outlook or mobile add-in posts to (source: OUTLOOK | MOBILE).
export async function POST(req: NextRequest) {
  return handle(async () => {
    const user = await requirePermission("time:log");
    const input = quickTimeSchema.parse(await req.json());

    const matter = await prisma.matter.findFirst({
      where: { id: input.matterId, companyId: user.companyId },
      select: { id: true, status: true, currency: true },
    });
    if (!matter) throw new AuthError(422, "invalid_matter");
    if (matter.status === "CLOSED") throw new AuthError(422, "matter_closed");

    const rate = input.rate ?? 0;
    const amount = Math.round((input.minutes / 60) * rate * 100) / 100;
    const date = input.date ? new Date(input.date) : new Date();

    const entry = await prisma.timeEntry.create({
      data: {
        companyId: user.companyId,
        matterId: matter.id,
        lawyerId: user.id,
        date: isNaN(date.getTime()) ? new Date() : date,
        minutes: input.minutes,
        billable: input.billable,
        rate,
        amount,
        currency: matter.currency,
        narrative: input.narrative || null,
        status: "DRAFT",
        source: input.source,
        createdById: user.id,
      },
    });

    await writeAudit({
      companyId: user.companyId,
      actorId: user.id,
      action: "TIME_QUICK_CAPTURED",
      entityType: "TimeEntry",
      entityId: entry.id,
      after: { minutes: input.minutes, source: input.source, matterId: matter.id },
    });
    return { id: entry.id, minutes: entry.minutes, source: entry.source };
  });
}

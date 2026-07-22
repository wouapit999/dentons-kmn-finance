import { NextRequest } from "next/server";
import { z } from "zod";
import { handle } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { requirePermission, AuthError } from "@/lib/auth";
import { writeAudit } from "@/lib/audit";

export const dynamic = "force-dynamic";

const patchSchema = z.object({ status: z.enum(["OPEN", "ON_HOLD", "CLOSED"]) });

// PATCH /api/matters/:id — change matter status (open / on hold / closed).
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  return handle(async () => {
    const user = await requirePermission("matter:manage");
    const { status } = patchSchema.parse(await req.json());
    const matter = await prisma.matter.findFirst({
      where: { id: params.id, companyId: user.companyId },
    });
    if (!matter) throw new AuthError(404, "not_found");

    const updated = await prisma.matter.update({
      where: { id: matter.id },
      data: { status },
    });
    await writeAudit({
      companyId: user.companyId,
      actorId: user.id,
      action: "MATTER_STATUS_CHANGED",
      entityType: "Matter",
      entityId: matter.id,
      before: { status: matter.status },
      after: { status: updated.status },
    });
    return { id: updated.id, status: updated.status };
  });
}

// DELETE /api/matters/:id — remove a matter opened in error. Refused once the
// matter carries any history (time, disbursements, invoices, tasks): legal and
// accounting records are never destroyed — close those instead.
export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  return handle(async () => {
    const user = await requirePermission("matter:manage");
    const matter = await prisma.matter.findFirst({
      where: { id: params.id, companyId: user.companyId },
      include: {
        _count: { select: { timeEntries: true, disbursements: true, invoices: true, tasks: true } },
      },
    });
    if (!matter) throw new AuthError(404, "not_found");

    const c = matter._count;
    if (c.timeEntries || c.disbursements || c.invoices || c.tasks) {
      throw new AuthError(409, "matter_has_activity");
    }

    await prisma.matter.delete({ where: { id: matter.id } });
    await writeAudit({
      companyId: user.companyId,
      actorId: user.id,
      action: "MATTER_DELETED",
      entityType: "Matter",
      entityId: matter.id,
      before: { code: matter.code, name: matter.name },
    });
    return { ok: true };
  });
}

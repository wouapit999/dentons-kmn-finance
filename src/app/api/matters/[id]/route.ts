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
import { updateMatterSchema } from "@/lib/validation";
import { matterDetailData, assertMainLawyer } from "@/lib/matters";
import { writeAudit } from "@/lib/audit";

export const dynamic = "force-dynamic";

// GET /api/matters/:id — full matter summary (litigation details + linked names),
// plus the clientId so the UI can drill through to the client's attached files.
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  return handle(async () => {
    const user = await requirePermission("matter:read");
    const m = await prisma.matter.findFirst({
      where: { id: params.id, companyId: user.companyId },
      include: {
        client: { select: { id: true, name: true, type: true } },
        practiceArea: { select: { name: true } },
        responsiblePartner: { select: { fullName: true } },
        mainLawyer: { select: { id: true, fullName: true, position: true } },
        office: { select: { name: true } },
        entity: { select: { code: true, name: true } },
      },
    });
    if (!m) throw new AuthError(404, "not_found");
    return {
      id: m.id,
      code: m.code,
      name: m.name,
      status: m.status,
      currency: m.currency,
      clientId: m.client.id,
      client: m.client.name,
      clientType: m.client.type,
      practiceArea: m.practiceArea?.name ?? null,
      partner: m.responsiblePartner?.fullName ?? null,
      nature: m.nature,
      adversary: m.adversary,
      mainLawyerId: m.mainLawyerId,
      mainLawyer: m.mainLawyer?.fullName ?? null,
      mainLawyerPosition: m.mainLawyer?.position ?? null,
      courtType: m.courtType,
      courtLocation: m.courtLocation,
      audienceAt: m.audienceAt,
      notes: m.notes,
      office: m.office?.name ?? null,
      entity: m.entity ? `${m.entity.code} — ${m.entity.name}` : null,
      openedAt: m.openedAt,
    };
  });
}

// PATCH /api/matters/:id — update status and/or the litigation & summary details.
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  return handle(async () => {
    const user = await requirePermission("matter:manage");
    const input = updateMatterSchema.parse(await req.json());
    const matter = await prisma.matter.findFirst({
      where: { id: params.id, companyId: user.companyId },
    });
    if (!matter) throw new AuthError(404, "not_found");
    await assertMainLawyer(user.companyId, input.mainLawyerId || undefined);

    const data: Record<string, unknown> = { ...matterDetailData(input) };
    if (input.status !== undefined) data.status = input.status;
    if (input.name !== undefined) data.name = input.name;
    if (input.practiceAreaId !== undefined) data.practiceAreaId = input.practiceAreaId || null;
    if (input.responsiblePartnerId !== undefined) data.responsiblePartnerId = input.responsiblePartnerId || null;

    const updated = await prisma.matter.update({ where: { id: matter.id }, data });
    await writeAudit({
      companyId: user.companyId,
      actorId: user.id,
      action: input.status && input.status !== matter.status ? "MATTER_STATUS_CHANGED" : "MATTER_UPDATED",
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

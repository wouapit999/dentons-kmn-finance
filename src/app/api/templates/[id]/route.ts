/*
 * Dentons KMN ERP
 * Copyright (c) 2026 Bouquet Innovation SA. All rights reserved.
 * Proprietary and confidential. Unauthorised copying, distribution, modification,
 * or use of this file, via any medium, is strictly prohibited.
 */
import { NextRequest } from "next/server";
import { handle } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { requirePermission, requireUser, AuthError } from "@/lib/auth";
import { legalTemplateSchema } from "@/lib/validation";
import { writeAudit } from "@/lib/audit";

export const dynamic = "force-dynamic";

// GET /api/templates/:id — full template body.
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  return handle(async () => {
    const user = await requireUser();
    const tpl = await prisma.legalTemplate.findFirst({
      where: { id: params.id, companyId: user.companyId },
    });
    if (!tpl) throw new AuthError(404, "not_found");
    return tpl;
  });
}

// PUT /api/templates/:id — update a template (client:manage).
export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  return handle(async () => {
    const user = await requirePermission("client:manage");
    const input = legalTemplateSchema.parse(await req.json());
    const tpl = await prisma.legalTemplate.findFirst({
      where: { id: params.id, companyId: user.companyId },
      select: { id: true },
    });
    if (!tpl) throw new AuthError(404, "not_found");
    await prisma.legalTemplate.update({ where: { id: tpl.id }, data: { ...input, updatedBy: user.id } });
    await writeAudit({
      companyId: user.companyId, actorId: user.id, action: "TEMPLATE_UPDATED",
      entityType: "LegalTemplate", entityId: tpl.id, after: { name: input.name },
    });
    return { ok: true };
  });
}

// DELETE /api/templates/:id — remove a template (client:manage).
export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  return handle(async () => {
    const user = await requirePermission("client:manage");
    const tpl = await prisma.legalTemplate.findFirst({
      where: { id: params.id, companyId: user.companyId },
      select: { id: true, name: true },
    });
    if (!tpl) throw new AuthError(404, "not_found");
    await prisma.legalTemplate.delete({ where: { id: tpl.id } });
    await writeAudit({
      companyId: user.companyId, actorId: user.id, action: "TEMPLATE_DELETED",
      entityType: "LegalTemplate", entityId: tpl.id, before: { name: tpl.name },
    });
    return { ok: true };
  });
}

/*
 * Dentons KMN ERP
 * Copyright (c) 2026 Bouquet Innovation SA. All rights reserved.
 * Proprietary and confidential. Unauthorised copying, distribution, modification,
 * or use of this file, via any medium, is strictly prohibited.
 */
import { NextRequest } from "next/server";
import { handle } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { requirePermission, requireUser } from "@/lib/auth";
import { legalTemplateSchema } from "@/lib/validation";
import { writeAudit } from "@/lib/audit";

export const dynamic = "force-dynamic";

// GET /api/templates — list the firm's legal templates (any signed-in user).
export async function GET() {
  return handle(async () => {
    const user = await requireUser();
    const templates = await prisma.legalTemplate.findMany({
      where: { companyId: user.companyId },
      orderBy: [{ category: "asc" }, { name: "asc" }],
      select: { id: true, name: true, category: true, language: true, updatedAt: true },
    });
    return templates;
  });
}

// POST /api/templates — create a template (client:manage).
export async function POST(req: NextRequest) {
  return handle(async () => {
    const user = await requirePermission("client:manage");
    const input = legalTemplateSchema.parse(await req.json());
    const created = await prisma.legalTemplate.create({
      data: { companyId: user.companyId, ...input, updatedBy: user.id },
    });
    await writeAudit({
      companyId: user.companyId, actorId: user.id, action: "TEMPLATE_CREATED",
      entityType: "LegalTemplate", entityId: created.id, after: { name: input.name },
    });
    return { id: created.id };
  });
}

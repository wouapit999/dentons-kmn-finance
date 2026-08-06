/*
 * Dentons KMN ERP
 * Copyright (c) 2026 Bouquet Innovation SA. All rights reserved.
 * Proprietary and confidential. Unauthorised copying, distribution, modification,
 * or use of this file, via any medium, is strictly prohibited.
 */
import { handle } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/auth";

export const dynamic = "force-dynamic";

// GET /api/audit — most recent audit events for the company.
export async function GET() {
  return handle(async () => {
    const admin = await requirePermission("audit:read");
    const logs = await prisma.auditLog.findMany({
      where: { companyId: admin.companyId },
      orderBy: { createdAt: "desc" },
      take: 200,
      include: { actor: { select: { fullName: true, email: true } } },
    });
    return logs.map((l) => ({
      id: l.id,
      createdAt: l.createdAt,
      actor: l.actor ? l.actor.fullName : "system",
      action: l.action,
      entityType: l.entityType,
      entityId: l.entityId,
    }));
  });
}

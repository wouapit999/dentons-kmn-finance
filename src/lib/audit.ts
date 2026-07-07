// Append-only audit logging. Every material change records actor, action,
// entity, before/after, and request context. Rows are never updated/deleted.
import { headers } from "next/headers";
import { prisma } from "./prisma";

export async function writeAudit(params: {
  companyId: string;
  actorId?: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  before?: unknown;
  after?: unknown;
}): Promise<void> {
  const h = headers();
  await prisma.auditLog.create({
    data: {
      companyId: params.companyId,
      actorId: params.actorId ?? null,
      action: params.action,
      entityType: params.entityType,
      entityId: params.entityId ?? null,
      before: params.before ? JSON.stringify(params.before) : null,
      after: params.after ? JSON.stringify(params.after) : null,
      ip: h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
      userAgent: h.get("user-agent") ?? null,
    },
  });
}

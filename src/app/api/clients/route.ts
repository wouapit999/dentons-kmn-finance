import { NextRequest } from "next/server";
import { handle } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/auth";
import { createClientSchema } from "@/lib/validation";
import { writeAudit } from "@/lib/audit";

export const dynamic = "force-dynamic";

// GET /api/clients — list clients with matter counts.
export async function GET() {
  return handle(async () => {
    const user = await requirePermission("client:read");
    const clients = await prisma.client.findMany({
      where: { companyId: user.companyId, deletedAt: null },
      orderBy: { createdAt: "desc" },
      include: { _count: { select: { matters: true } } },
    });
    return clients.map((c) => ({
      id: c.id,
      type: c.type,
      name: c.name,
      email: c.email,
      taxId: c.taxId,
      kycStatus: c.kycStatus,
      amlRisk: c.amlRisk,
      conflictStatus: c.conflictStatus,
      status: c.status,
      matters: c._count.matters,
    }));
  });
}

// POST /api/clients — onboard a new client (PENDING KYC, conflict NOT_RUN).
export async function POST(req: NextRequest) {
  return handle(async () => {
    const user = await requirePermission("client:manage");
    const input = createClientSchema.parse(await req.json());
    const created = await prisma.client.create({
      data: {
        companyId: user.companyId,
        type: input.type,
        name: input.name,
        email: input.email || null,
        phone: input.phone || null,
        taxId: input.taxId || null,
        amlRisk: input.amlRisk,
        createdById: user.id,
      },
    });
    await writeAudit({
      companyId: user.companyId,
      actorId: user.id,
      action: "CLIENT_CREATED",
      entityType: "Client",
      entityId: created.id,
      after: { name: created.name, type: created.type },
    });
    return { id: created.id };
  });
}

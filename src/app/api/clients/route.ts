import { NextRequest } from "next/server";
import { handle } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { requirePermission, AuthError } from "@/lib/auth";
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
      include: {
        _count: { select: { matters: true } },
        assignedLawyer: { select: { fullName: true } },
      },
    });
    return clients.map((c) => ({
      id: c.id,
      clientNo: c.clientNo,
      type: c.type,
      name: c.name,
      email: c.email,
      taxId: c.taxId,
      caseType: c.caseType,
      assignedLawyer: c.assignedLawyer?.fullName ?? null,
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

    if (input.assignedLawyerId) {
      const lawyer = await prisma.user.findFirst({
        where: { id: input.assignedLawyerId, companyId: user.companyId, deletedAt: null },
      });
      if (!lawyer) throw new AuthError(422, "invalid_lawyer");
    }

    // Unique intake reference, e.g. CL-2026-00007 (company-scoped sequence).
    const count = await prisma.client.count({ where: { companyId: user.companyId } });
    const clientNo = `CL-${new Date().getFullYear()}-${String(count + 1).padStart(5, "0")}`;

    const created = await prisma.client.create({
      data: {
        companyId: user.companyId,
        clientNo,
        type: input.type,
        name: input.name,
        email: input.email || null,
        phone: input.phone || null,
        address: input.address || null,
        idNumber: input.idNumber || null,
        taxId: input.taxId || null,
        caseType: input.caseType || null,
        assignedLawyerId: input.assignedLawyerId || null,
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
      after: { clientNo, name: created.name, type: created.type, caseType: created.caseType },
    });
    return { id: created.id, clientNo };
  });
}

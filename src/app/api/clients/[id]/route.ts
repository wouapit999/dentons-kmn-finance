import { NextRequest } from "next/server";
import { handle } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { requirePermission, AuthError } from "@/lib/auth";
import { updateClientSchema } from "@/lib/validation";
import { writeAudit } from "@/lib/audit";

export const dynamic = "force-dynamic";

// PATCH /api/clients/:id — update details / KYC status / AML risk.
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  return handle(async () => {
    const user = await requirePermission("client:manage");
    const existing = await prisma.client.findFirst({
      where: { id: params.id, companyId: user.companyId, deletedAt: null },
    });
    if (!existing) throw new AuthError(404, "not_found");

    const input = updateClientSchema.parse(await req.json());
    await prisma.client.update({
      where: { id: existing.id },
      data: {
        name: input.name,
        email: input.email,
        phone: input.phone,
        taxId: input.taxId,
        kycStatus: input.kycStatus,
        amlRisk: input.amlRisk,
        status: input.status,
      },
    });
    await writeAudit({
      companyId: user.companyId,
      actorId: user.id,
      action: "CLIENT_UPDATED",
      entityType: "Client",
      entityId: existing.id,
      before: { kycStatus: existing.kycStatus, amlRisk: existing.amlRisk },
      after: input,
    });
    return { ok: true };
  });
}

import { NextRequest } from "next/server";
import { handle } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { requirePermission, AuthError } from "@/lib/auth";
import { createMatterSchema } from "@/lib/validation";
import { writeAudit } from "@/lib/audit";

export const dynamic = "force-dynamic";

// GET /api/matters — list matters with client / practice area / partner.
export async function GET() {
  return handle(async () => {
    const user = await requirePermission("matter:read");
    const matters = await prisma.matter.findMany({
      where: { companyId: user.companyId },
      orderBy: { createdAt: "desc" },
      include: {
        client: { select: { name: true } },
        practiceArea: { select: { name: true } },
        responsiblePartner: { select: { fullName: true } },
      },
    });
    return matters.map((m) => ({
      id: m.id,
      code: m.code,
      name: m.name,
      status: m.status,
      currency: m.currency,
      client: m.client.name,
      practiceArea: m.practiceArea?.name ?? null,
      partner: m.responsiblePartner?.fullName ?? null,
      openedAt: m.openedAt,
    }));
  });
}

// POST /api/matters — open a matter.
// Compliance gate: client must be KYC-VERIFIED and not conflict-BLOCKED.
export async function POST(req: NextRequest) {
  return handle(async () => {
    const user = await requirePermission("matter:manage");
    const input = createMatterSchema.parse(await req.json());

    const client = await prisma.client.findFirst({
      where: { id: input.clientId, companyId: user.companyId, deletedAt: null },
    });
    if (!client) throw new AuthError(422, "invalid_client");
    if (client.kycStatus !== "VERIFIED") throw new AuthError(422, "client_kyc_not_verified");
    if (client.conflictStatus === "BLOCKED") throw new AuthError(422, "client_conflict_blocked");

    // Matter codes are unique per company — report a clash clearly rather than
    // letting the DB constraint surface as a 500.
    const clash = await prisma.matter.findFirst({
      where: { companyId: user.companyId, code: input.code },
      select: { id: true },
    });
    if (clash) throw new AuthError(409, "matter_code_exists");

    const created = await prisma.matter.create({
      data: {
        companyId: user.companyId,
        clientId: client.id,
        code: input.code,
        name: input.name,
        practiceAreaId: input.practiceAreaId || null,
        responsiblePartnerId: input.responsiblePartnerId || null,
        currency: input.currency,
        createdById: user.id,
      },
    });
    await writeAudit({
      companyId: user.companyId,
      actorId: user.id,
      action: "MATTER_OPENED",
      entityType: "Matter",
      entityId: created.id,
      after: { code: created.code, client: client.name },
    });
    return { id: created.id, code: created.code };
  });
}

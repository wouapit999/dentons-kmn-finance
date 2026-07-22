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

    // If the caller supplied a code it must be free; otherwise the server
    // assigns the next one. Codes are unique per company.
    if (input.code) {
      const clash = await prisma.matter.findFirst({
        where: { companyId: user.companyId, code: input.code },
        select: { id: true },
      });
      if (clash) throw new AuthError(409, "matter_code_exists");
    }

    const nextCode = async () => {
      const prefix = `M-${new Date().getFullYear()}-`;
      const existing = await prisma.matter.findMany({
        where: { companyId: user.companyId, code: { startsWith: prefix } },
        select: { code: true },
      });
      const highest = existing.reduce((max, m) => {
        const n = parseInt(m.code.slice(prefix.length).replace(/\D/g, ""), 10);
        return Number.isFinite(n) && n > max ? n : max;
      }, 0);
      return `${prefix}${String(highest + 1).padStart(5, "0")}`;
    };

    const base = {
      companyId: user.companyId,
      clientId: client.id,
      name: input.name,
      practiceAreaId: input.practiceAreaId || null,
      responsiblePartnerId: input.responsiblePartnerId || null,
      currency: input.currency,
      createdById: user.id,
    };

    // Retry on the unique constraint in case two matters are opened at once.
    let created;
    for (let attempt = 0; ; attempt++) {
      const code = input.code || (await nextCode());
      try {
        created = await prisma.matter.create({ data: { ...base, code } });
        break;
      } catch (e) {
        const isDup = (e as { code?: string })?.code === "P2002";
        if (!isDup || input.code || attempt >= 4) throw e;
      }
    }
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

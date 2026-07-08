import { NextRequest } from "next/server";
import { handle } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { requirePermission, AuthError } from "@/lib/auth";
import { createTrustAccountSchema } from "@/lib/validation";
import { writeAudit } from "@/lib/audit";

export const dynamic = "force-dynamic";

// GET /api/trust — trust accounts with balances.
export async function GET() {
  return handle(async () => {
    const user = await requirePermission("trust:read");
    const accounts = await prisma.trustAccount.findMany({
      where: { companyId: user.companyId },
      orderBy: { createdAt: "desc" },
      include: { client: { select: { name: true } }, _count: { select: { entries: true } } },
    });
    return accounts.map((a) => ({
      id: a.id,
      client: a.client.name,
      currency: a.currency,
      balance: Number(a.balance),
      status: a.status,
      entries: a._count.entries,
    }));
  });
}

// POST /api/trust — open a trust account for a client.
export async function POST(req: NextRequest) {
  return handle(async () => {
    const user = await requirePermission("trust:manage");
    const input = createTrustAccountSchema.parse(await req.json());

    const client = await prisma.client.findFirst({
      where: { id: input.clientId, companyId: user.companyId, deletedAt: null },
    });
    if (!client) throw new AuthError(422, "invalid_client");

    const existing = await prisma.trustAccount.findUnique({
      where: { companyId_clientId: { companyId: user.companyId, clientId: client.id } },
    });
    if (existing) throw new AuthError(422, "trust_account_exists");

    const created = await prisma.trustAccount.create({
      data: { companyId: user.companyId, clientId: client.id, currency: input.currency },
    });
    await writeAudit({
      companyId: user.companyId,
      actorId: user.id,
      action: "TRUST_ACCOUNT_OPENED",
      entityType: "TrustAccount",
      entityId: created.id,
      after: { client: client.name },
    });
    return { id: created.id };
  });
}

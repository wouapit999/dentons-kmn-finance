import { handle } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { requirePermission, AuthError } from "@/lib/auth";
import { writeAudit } from "@/lib/audit";

export const dynamic = "force-dynamic";

// POST /api/clients/:id/conflict-check
// A basic conflict check: look for other clients or matters whose names overlap
// with this client's name. Real firms plug in richer matching, but this records
// a real, auditable check and sets the client's conflict status.
export async function POST(_req: Request, { params }: { params: { id: string } }) {
  return handle(async () => {
    const user = await requirePermission("client:manage");
    const client = await prisma.client.findFirst({
      where: { id: params.id, companyId: user.companyId, deletedAt: null },
    });
    if (!client) throw new AuthError(404, "not_found");

    const tokens = client.name
      .toLowerCase()
      .split(/\s+/)
      .filter((w) => w.length >= 3);

    const [otherClients, matters] = await Promise.all([
      prisma.client.findMany({
        where: { companyId: user.companyId, deletedAt: null, id: { not: client.id } },
        select: { name: true },
      }),
      prisma.matter.findMany({
        where: { companyId: user.companyId, clientId: { not: client.id } },
        select: { name: true, client: { select: { name: true } } },
      }),
    ]);

    const candidates = [
      ...otherClients.map((c) => c.name),
      ...matters.map((m) => `${m.name} (${m.client.name})`),
    ];
    const matches = candidates.filter((n) => {
      const hay = n.toLowerCase();
      return tokens.some((tk) => hay.includes(tk));
    });

    const status = matches.length > 0 ? "POTENTIAL" : "CLEAR";

    await prisma.$transaction([
      prisma.conflictCheck.create({
        data: {
          companyId: user.companyId,
          clientId: client.id,
          status,
          matches: matches.length ? JSON.stringify(matches.slice(0, 20)) : null,
          checkedById: user.id,
        },
      }),
      prisma.client.update({
        where: { id: client.id },
        data: { conflictStatus: status },
      }),
    ]);

    await writeAudit({
      companyId: user.companyId,
      actorId: user.id,
      action: "CONFLICT_CHECK_RUN",
      entityType: "Client",
      entityId: client.id,
      after: { status, matchCount: matches.length },
    });

    return { status, matches: matches.slice(0, 20) };
  });
}

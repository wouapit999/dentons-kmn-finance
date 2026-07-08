import { NextRequest } from "next/server";
import { handle } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { requirePermission, AuthError } from "@/lib/auth";
import { createDisbursementSchema } from "@/lib/validation";
import { writeAudit } from "@/lib/audit";

export const dynamic = "force-dynamic";

// GET /api/disbursements — recent disbursements + billable total.
export async function GET() {
  return handle(async () => {
    const user = await requirePermission("disbursement:read");
    const rows = await prisma.disbursement.findMany({
      where: { companyId: user.companyId },
      orderBy: { date: "desc" },
      take: 200,
      include: { matter: { select: { code: true, name: true } } },
    });

    let billableTotal = 0;
    for (const d of rows) if (d.billable) billableTotal += Number(d.amount);

    return {
      summary: { billableTotal, count: rows.length },
      rows: rows.map((d) => ({
        id: d.id,
        date: d.date,
        matter: `${d.matter.code} — ${d.matter.name}`,
        description: d.description,
        amount: d.amount.toString(),
        currency: d.currency,
        billable: d.billable,
        vendorName: d.vendorName,
        status: d.status,
      })),
    };
  });
}

// POST /api/disbursements — record a matter cost.
export async function POST(req: NextRequest) {
  return handle(async () => {
    const user = await requirePermission("disbursement:log");
    const input = createDisbursementSchema.parse(await req.json());

    const matter = await prisma.matter.findFirst({
      where: { id: input.matterId, companyId: user.companyId },
    });
    if (!matter) throw new AuthError(422, "invalid_matter");
    if (matter.status === "CLOSED") throw new AuthError(422, "matter_closed");

    const created = await prisma.disbursement.create({
      data: {
        companyId: user.companyId,
        matterId: matter.id,
        date: new Date(input.date),
        description: input.description,
        amount: input.amount,
        currency: input.currency,
        billable: input.billable,
        vendorName: input.vendorName || null,
        createdById: user.id,
      },
    });
    await writeAudit({
      companyId: user.companyId,
      actorId: user.id,
      action: "DISBURSEMENT_RECORDED",
      entityType: "Disbursement",
      entityId: created.id,
      after: { matter: matter.code, amount: input.amount },
    });
    return { id: created.id };
  });
}

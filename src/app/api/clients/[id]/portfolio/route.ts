import { NextRequest } from "next/server";
import { handle } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { requirePermission, AuthError } from "@/lib/auth";

export const dynamic = "force-dynamic";

const round = (n: number) => Math.round(n * 100) / 100;

// GET /api/clients/:id/portfolio — the client's financial picture: billing
// totals, outstanding, unbilled work (billing feed) and matters + trust.
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  return handle(async () => {
    const user = await requirePermission("client:read");
    const client = await prisma.client.findFirst({
      where: { id: params.id, companyId: user.companyId, deletedAt: null },
    });
    if (!client) throw new AuthError(404, "not_found");

    const [invoices, matters, trust, unbilledTime, unbilledDisb] = await Promise.all([
      prisma.invoice.findMany({
        where: { companyId: user.companyId, clientId: client.id },
        select: { number: true, status: true, total: true, amountPaid: true, dueDate: true },
        orderBy: { createdAt: "desc" },
      }),
      prisma.matter.findMany({
        where: { companyId: user.companyId, clientId: client.id },
        select: {
          id: true, code: true, name: true, status: true,
          practiceArea: { select: { name: true } },
          responsiblePartner: { select: { fullName: true } },
        },
      }),
      prisma.trustAccount.findFirst({
        where: { companyId: user.companyId, clientId: client.id },
        select: { balance: true, currency: true },
      }),
      prisma.timeEntry.aggregate({
        where: {
          companyId: user.companyId,
          billable: true,
          status: "DRAFT",
          invoiceId: null,
          matter: { clientId: client.id },
        },
        _sum: { amount: true, minutes: true },
      }),
      prisma.disbursement.aggregate({
        where: {
          companyId: user.companyId,
          billable: true,
          status: "DRAFT",
          invoiceId: null,
          matter: { clientId: client.id },
        },
        _sum: { amount: true },
      }),
    ]);

    const billed = invoices
      .filter((i) => i.status !== "DRAFT")
      .reduce((s, i) => s + Number(i.total), 0);
    const paid = invoices.reduce((s, i) => s + Number(i.amountPaid), 0);
    const now = Date.now();
    const overdue = invoices
      .filter((i) => ["POSTED", "PART_PAID"].includes(i.status) && i.dueDate.getTime() < now)
      .reduce((s, i) => s + Number(i.total) - Number(i.amountPaid), 0);

    return {
      client: {
        id: client.id,
        name: client.name,
        type: client.type,
        email: client.email,
        taxId: client.taxId,
        kycStatus: client.kycStatus,
        amlRisk: client.amlRisk,
        conflictStatus: client.conflictStatus,
        status: client.status,
      },
      billing: {
        invoiceCount: invoices.length,
        billed: round(billed),
        paid: round(paid),
        outstanding: round(billed - paid),
        overdue: round(overdue),
        unbilledFees: round(Number(unbilledTime._sum.amount ?? 0)),
        unbilledHours: round(Number(unbilledTime._sum.minutes ?? 0) / 60),
        unbilledDisbursements: round(Number(unbilledDisb._sum.amount ?? 0)),
      },
      trustBalance: trust ? Number(trust.balance) : null,
      matters: matters.map((m) => ({
        id: m.id,
        code: m.code,
        name: m.name,
        status: m.status,
        practiceArea: m.practiceArea?.name ?? null,
        partner: m.responsiblePartner?.fullName ?? null,
      })),
      invoices: invoices.slice(0, 20).map((i) => ({
        number: i.number,
        status: i.status,
        total: Number(i.total),
        paid: Number(i.amountPaid),
      })),
    };
  });
}

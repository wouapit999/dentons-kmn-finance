import { handle } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { requirePermission, AuthError } from "@/lib/auth";

export const dynamic = "force-dynamic";

// GET /api/trust/:id — trust account with its ledger + this client's open invoices.
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  return handle(async () => {
    const user = await requirePermission("trust:read");
    const acct = await prisma.trustAccount.findFirst({
      where: { id: params.id, companyId: user.companyId },
      include: {
        client: { select: { id: true, name: true } },
        entries: { orderBy: { createdAt: "desc" } },
      },
    });
    if (!acct) throw new AuthError(404, "not_found");

    const invoices = await prisma.invoice.findMany({
      where: {
        companyId: user.companyId,
        clientId: acct.clientId,
        status: { in: ["POSTED", "PART_PAID"] },
      },
      select: { id: true, number: true, total: true, amountPaid: true },
    });

    return {
      id: acct.id,
      client: acct.client.name,
      currency: acct.currency,
      balance: Number(acct.balance),
      status: acct.status,
      openInvoices: invoices.map((i) => ({
        id: i.id,
        number: i.number,
        outstanding: Math.round((Number(i.total) - Number(i.amountPaid)) * 100) / 100,
      })),
      entries: acct.entries.map((e) => ({
        id: e.id,
        date: e.date,
        type: e.type,
        amount: Number(e.amount),
        runningBalance: Number(e.runningBalance),
        reference: e.reference,
      })),
    };
  });
}

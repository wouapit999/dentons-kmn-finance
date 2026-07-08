import { handle } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { requirePermission, AuthError } from "@/lib/auth";

export const dynamic = "force-dynamic";

// GET /api/invoices/:id — full invoice with lines and receipts.
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  return handle(async () => {
    const user = await requirePermission("invoice:read");
    const inv = await prisma.invoice.findFirst({
      where: { id: params.id, companyId: user.companyId },
      include: {
        client: { select: { name: true } },
        matter: { select: { code: true, name: true } },
        lines: true,
        receipts: { orderBy: { date: "desc" } },
      },
    });
    if (!inv) throw new AuthError(404, "not_found");
    return {
      id: inv.id,
      number: inv.number,
      client: inv.client.name,
      matter: inv.matter ? `${inv.matter.code} — ${inv.matter.name}` : null,
      date: inv.date,
      dueDate: inv.dueDate,
      currency: inv.currency,
      feeSubtotal: Number(inv.feeSubtotal),
      disbSubtotal: Number(inv.disbSubtotal),
      subtotal: Number(inv.subtotal),
      vatRate: Number(inv.vatRate),
      vatAmount: Number(inv.vatAmount),
      whtRate: Number(inv.whtRate),
      whtAmount: Number(inv.whtAmount),
      total: Number(inv.total),
      amountPaid: Number(inv.amountPaid),
      status: inv.status,
      posted: !!inv.postedEntryId,
      lines: inv.lines.map((l) => ({
        type: l.sourceType,
        description: l.description,
        amount: Number(l.amount),
      })),
      receipts: inv.receipts.map((r) => ({
        date: r.date,
        amount: Number(r.amount),
        method: r.method,
        reference: r.reference,
      })),
    };
  });
}

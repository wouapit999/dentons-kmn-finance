import { NextRequest } from "next/server";
import { handle } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { requirePermission, AuthError } from "@/lib/auth";
import { createInvoiceSchema } from "@/lib/validation";
import { writeAudit } from "@/lib/audit";

export const dynamic = "force-dynamic";

const round = (n: number) => Math.round(n * 100) / 100;

// GET /api/invoices — list with client, totals, status, outstanding.
export async function GET() {
  return handle(async () => {
    const user = await requirePermission("invoice:read");
    const invoices = await prisma.invoice.findMany({
      where: { companyId: user.companyId },
      orderBy: { createdAt: "desc" },
      include: { client: { select: { name: true } }, matter: { select: { code: true } } },
    });
    return invoices.map((i) => ({
      id: i.id,
      number: i.number,
      client: i.client.name,
      matter: i.matter?.code ?? null,
      date: i.date,
      dueDate: i.dueDate,
      currency: i.currency,
      subtotal: Number(i.subtotal),
      vatAmount: Number(i.vatAmount),
      whtAmount: Number(i.whtAmount),
      total: Number(i.total),
      amountPaid: Number(i.amountPaid),
      outstanding: round(Number(i.total) - Number(i.amountPaid)),
      status: i.status,
      posted: !!i.postedEntryId,
    }));
  });
}

// POST /api/invoices — build a DRAFT invoice from time/disbursements/manual lines.
export async function POST(req: NextRequest) {
  return handle(async () => {
    const user = await requirePermission("invoice:create");
    const input = createInvoiceSchema.parse(await req.json());

    const result = await prisma.$transaction(async (tx) => {
      const matter = await tx.matter.findFirst({
        where: { id: input.matterId, companyId: user.companyId },
      });
      if (!matter) throw new AuthError(422, "invalid_matter");

      const time = await tx.timeEntry.findMany({
        where: {
          id: { in: input.timeEntryIds },
          companyId: user.companyId,
          matterId: matter.id,
          status: "DRAFT",
          invoiceId: null,
        },
      });
      if (time.length !== input.timeEntryIds.length) throw new AuthError(422, "time_entry_unavailable");

      const disb = await tx.disbursement.findMany({
        where: {
          id: { in: input.disbursementIds },
          companyId: user.companyId,
          matterId: matter.id,
          status: "DRAFT",
          invoiceId: null,
        },
      });
      if (disb.length !== input.disbursementIds.length) throw new AuthError(422, "disbursement_unavailable");

      const feeSubtotal = round(
        time.reduce((s, t) => s + Number(t.amount), 0) +
          input.manualLines.reduce((s, m) => s + m.amount, 0),
      );
      const disbSubtotal = round(disb.reduce((s, d) => s + Number(d.amount), 0));
      const subtotal = round(feeSubtotal + disbSubtotal);
      // VAT applies to fees + disbursement recoveries here (configurable rate).
      const vatAmount = round(subtotal * (input.vatRate / 100));
      const whtAmount = round(feeSubtotal * (input.whtRate / 100));
      const total = round(subtotal + vatAmount - whtAmount);

      const count = await tx.invoice.count({ where: { companyId: user.companyId } });
      const number = `INV-${new Date(input.date).getFullYear()}-${String(count + 1).padStart(5, "0")}`;

      const invoice = await tx.invoice.create({
        data: {
          companyId: user.companyId,
          clientId: matter.clientId,
          matterId: matter.id,
          number,
          date: new Date(input.date),
          dueDate: new Date(input.dueDate),
          currency: input.currency,
          feeSubtotal,
          disbSubtotal,
          subtotal,
          vatRate: input.vatRate,
          vatAmount,
          whtRate: input.whtRate,
          whtAmount,
          total,
          status: "DRAFT",
          createdById: user.id,
          lines: {
            create: [
              ...time.map((t) => ({
                sourceType: "TIME",
                sourceId: t.id,
                description: t.narrative ?? "Professional fees",
                quantity: 1,
                unitAmount: Number(t.amount),
                amount: Number(t.amount),
                taxable: true,
              })),
              ...input.manualLines.map((m) => ({
                sourceType: "MANUAL",
                description: m.description,
                quantity: 1,
                unitAmount: m.amount,
                amount: m.amount,
                taxable: true,
              })),
              ...disb.map((d) => ({
                sourceType: "DISBURSEMENT",
                sourceId: d.id,
                description: d.description,
                quantity: 1,
                unitAmount: Number(d.amount),
                amount: Number(d.amount),
                taxable: true,
              })),
            ],
          },
        },
      });

      // Mark source items as billed and link them to the invoice.
      if (time.length)
        await tx.timeEntry.updateMany({
          where: { id: { in: time.map((t) => t.id) } },
          data: { status: "BILLED", invoiceId: invoice.id },
        });
      if (disb.length)
        await tx.disbursement.updateMany({
          where: { id: { in: disb.map((d) => d.id) } },
          data: { status: "BILLED", invoiceId: invoice.id },
        });

      return invoice;
    });

    await writeAudit({
      companyId: user.companyId,
      actorId: user.id,
      action: "INVOICE_CREATED",
      entityType: "Invoice",
      entityId: result.id,
      after: { number: result.number, total: Number(result.total) },
    });

    return { id: result.id, number: result.number, total: Number(result.total) };
  });
}

import { NextRequest } from "next/server";
import { handle } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { requirePermission, AuthError } from "@/lib/auth";
import { postJournal } from "@/lib/ledger";
import { createReceiptSchema } from "@/lib/validation";
import { writeAudit } from "@/lib/audit";

export const dynamic = "force-dynamic";

const round = (n: number) => Math.round(n * 100) / 100;

// POST /api/receipts — record a payment against a posted invoice and post it:
//   Dr Bank / Petty cash   amount
//   Cr Clients (AR)        amount
export async function POST(req: NextRequest) {
  return handle(async () => {
    const user = await requirePermission("payment:create");
    const input = createReceiptSchema.parse(await req.json());

    const result = await prisma.$transaction(async (tx) => {
      const inv = await tx.invoice.findFirst({
        where: { id: input.invoiceId, companyId: user.companyId },
      });
      if (!inv) throw new AuthError(404, "invoice_not_found");
      if (!inv.postedEntryId) throw new AuthError(422, "invoice_not_posted");

      const outstanding = round(Number(inv.total) - Number(inv.amountPaid));
      if (outstanding <= 0) throw new AuthError(422, "invoice_settled");
      if (input.amount > outstanding + 0.01) throw new AuthError(422, "amount_exceeds_outstanding");

      const cashAccount = input.method === "CASH" ? "571000" : "521000";
      const entry = await postJournal(tx, {
        companyId: user.companyId,
        journalCode: input.method === "CASH" ? "CSH" : "BNK",
        date: new Date(input.date),
        description: `Receipt for ${inv.number}`,
        createdById: user.id,
        currency: inv.currency,
        lines: [
          { accountCode: cashAccount, debit: input.amount, description: `Receipt ${inv.number}` },
          { accountCode: "411000", credit: input.amount, description: `Settle ${inv.number}` },
        ],
      });

      const receipt = await tx.receipt.create({
        data: {
          companyId: user.companyId,
          invoiceId: inv.id,
          clientId: inv.clientId,
          date: new Date(input.date),
          amount: input.amount,
          currency: inv.currency,
          method: input.method,
          reference: input.reference || null,
          postedEntryId: entry.id,
          createdById: user.id,
        },
      });

      const newPaid = round(Number(inv.amountPaid) + input.amount);
      const status = newPaid >= Number(inv.total) - 0.01 ? "PAID" : "PART_PAID";
      await tx.invoice.update({
        where: { id: inv.id },
        data: { amountPaid: newPaid, status },
      });

      return { receipt, invoiceNumber: inv.number, status, entryNo: entry.entryNo };
    });

    await writeAudit({
      companyId: user.companyId,
      actorId: user.id,
      action: "RECEIPT_RECORDED",
      entityType: "Receipt",
      entityId: result.receipt.id,
      after: { invoice: result.invoiceNumber, amount: input.amount, status: result.status },
    });

    return { ok: true, status: result.status, entryNo: result.entryNo };
  });
}

import { NextRequest } from "next/server";
import { handle } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { requirePermission, AuthError } from "@/lib/auth";
import { postJournal } from "@/lib/ledger";
import { payBillSchema } from "@/lib/validation";
import { writeAudit } from "@/lib/audit";

export const dynamic = "force-dynamic";

const round = (n: number) => Math.round(n * 100) / 100;

// POST /api/vendor-payments — pay a posted vendor bill:
//   Dr Suppliers (AP)   amount
//   Cr Bank / Petty cash amount
export async function POST(req: NextRequest) {
  return handle(async () => {
    const user = await requirePermission("ap:approve");
    const input = payBillSchema.parse(await req.json());

    const result = await prisma.$transaction(async (tx) => {
      const bill = await tx.vendorBill.findFirst({
        where: { id: input.billId, companyId: user.companyId },
      });
      if (!bill) throw new AuthError(404, "bill_not_found");
      if (!bill.postedEntryId) throw new AuthError(422, "bill_not_posted");

      const outstanding = round(Number(bill.total) - Number(bill.amountPaid));
      if (outstanding <= 0) throw new AuthError(422, "bill_settled");
      if (input.amount > outstanding + 0.01) throw new AuthError(422, "amount_exceeds_outstanding");

      const cashAccount = input.method === "CASH" ? "571000" : "521000";
      const entry = await postJournal(tx, {
        companyId: user.companyId,
        journalCode: input.method === "CASH" ? "CSH" : "BNK",
        date: new Date(input.date),
        description: `Payment for ${bill.number}`,
        createdById: user.id,
        currency: bill.currency,
        lines: [
          { accountCode: "401000", debit: input.amount, description: `Settle ${bill.number}` },
          { accountCode: cashAccount, credit: input.amount, description: `Pay ${bill.number}` },
        ],
      });

      const payment = await tx.vendorPayment.create({
        data: {
          companyId: user.companyId,
          billId: bill.id,
          supplierId: bill.supplierId,
          date: new Date(input.date),
          amount: input.amount,
          currency: bill.currency,
          method: input.method,
          reference: input.reference || null,
          postedEntryId: entry.id,
          createdById: user.id,
        },
      });

      const newPaid = round(Number(bill.amountPaid) + input.amount);
      const status = newPaid >= Number(bill.total) - 0.01 ? "PAID" : "PART_PAID";
      await tx.vendorBill.update({ where: { id: bill.id }, data: { amountPaid: newPaid, status } });

      return { payment, number: bill.number, status, entryNo: entry.entryNo };
    });

    await writeAudit({
      companyId: user.companyId,
      actorId: user.id,
      action: "VENDOR_PAYMENT",
      entityType: "VendorPayment",
      entityId: result.payment.id,
      after: { bill: result.number, amount: input.amount, status: result.status },
    });

    return { ok: true, status: result.status, entryNo: result.entryNo };
  });
}

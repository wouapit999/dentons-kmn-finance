import { handle } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { requirePermission, AuthError } from "@/lib/auth";
import { postJournal } from "@/lib/ledger";
import { writeAudit } from "@/lib/audit";

export const dynamic = "force-dynamic";

// POST /api/bills/:id/post — post a vendor bill to the GL:
//   Dr Expense account       subtotal
//   Dr VAT deductible (input) vatAmount
//   Cr Suppliers (AP)        total
export async function POST(_req: Request, { params }: { params: { id: string } }) {
  return handle(async () => {
    const user = await requirePermission("ap:approve");

    const posted = await prisma.$transaction(async (tx) => {
      const bill = await tx.vendorBill.findFirst({
        where: { id: params.id, companyId: user.companyId },
      });
      if (!bill) throw new AuthError(404, "not_found");
      if (bill.status !== "DRAFT" || bill.postedEntryId) throw new AuthError(422, "already_posted");

      const subtotal = Number(bill.subtotal);
      const vat = Number(bill.vatAmount);
      const total = Number(bill.total);

      const lines = [
        { accountCode: bill.expenseAccountCode, debit: subtotal, description: bill.description },
        { accountCode: "445200", debit: vat, description: "Input VAT" },
        { accountCode: "401000", credit: total, description: `AP ${bill.number}` },
      ].filter((l) => (l.debit ?? 0) > 0 || (l.credit ?? 0) > 0);

      const entry = await postJournal(tx, {
        companyId: user.companyId,
        journalCode: "PUR",
        date: bill.date,
        description: `Vendor bill ${bill.number}`,
        createdById: user.id,
        currency: bill.currency,
        lines,
      });

      await tx.vendorBill.update({
        where: { id: bill.id },
        data: { status: "POSTED", postedEntryId: entry.id },
      });
      return { bill, entryNo: entry.entryNo };
    });

    await writeAudit({
      companyId: user.companyId,
      actorId: user.id,
      action: "BILL_POSTED",
      entityType: "VendorBill",
      entityId: posted.bill.id,
      after: { number: posted.bill.number, entryNo: posted.entryNo },
    });

    return { ok: true, entryNo: posted.entryNo };
  });
}

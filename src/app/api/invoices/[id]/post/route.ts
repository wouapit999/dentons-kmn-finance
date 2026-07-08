import { handle } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { requirePermission, AuthError } from "@/lib/auth";
import { postJournal } from "@/lib/ledger";
import { writeAudit } from "@/lib/audit";

export const dynamic = "force-dynamic";

// POST /api/invoices/:id/post — post the invoice to the General Ledger.
//   Dr Clients (AR)                 total
//   Dr WHT receivable               whtAmount
//   Cr Legal fee income             feeSubtotal
//   Cr Disbursement recoveries      disbSubtotal
//   Cr VAT collected (output)       vatAmount
export async function POST(_req: Request, { params }: { params: { id: string } }) {
  return handle(async () => {
    const user = await requirePermission("invoice:approve");

    const posted = await prisma.$transaction(async (tx) => {
      const inv = await tx.invoice.findFirst({
        where: { id: params.id, companyId: user.companyId },
      });
      if (!inv) throw new AuthError(404, "not_found");
      if (inv.status !== "DRAFT" || inv.postedEntryId) throw new AuthError(422, "already_posted");

      const fee = Number(inv.feeSubtotal);
      const disb = Number(inv.disbSubtotal);
      const vat = Number(inv.vatAmount);
      const wht = Number(inv.whtAmount);
      const total = Number(inv.total);

      const lines = [
        { accountCode: "411000", debit: total, description: `AR ${inv.number}` },
        { accountCode: "449000", debit: wht, description: "WHT suffered" },
        { accountCode: "706000", credit: fee, description: "Legal fees" },
        { accountCode: "707000", credit: disb, description: "Disbursement recoveries" },
        { accountCode: "443100", credit: vat, description: "VAT collected" },
      ].filter((l) => (l.debit ?? 0) > 0 || (l.credit ?? 0) > 0);

      const entry = await postJournal(tx, {
        companyId: user.companyId,
        journalCode: "SAL",
        date: inv.date,
        description: `Invoice ${inv.number}`,
        createdById: user.id,
        currency: inv.currency,
        lines,
      });

      await tx.invoice.update({
        where: { id: inv.id },
        data: { status: "POSTED", postedEntryId: entry.id },
      });
      return { invoice: inv, entryNo: entry.entryNo };
    });

    await writeAudit({
      companyId: user.companyId,
      actorId: user.id,
      action: "INVOICE_POSTED",
      entityType: "Invoice",
      entityId: posted.invoice.id,
      after: { number: posted.invoice.number, entryNo: posted.entryNo },
    });

    return { ok: true, entryNo: posted.entryNo };
  });
}

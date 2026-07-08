import { NextRequest } from "next/server";
import { handle } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { requirePermission, AuthError } from "@/lib/auth";
import { postJournal } from "@/lib/ledger";
import { trustTxnSchema } from "@/lib/validation";
import { writeAudit } from "@/lib/audit";

export const dynamic = "force-dynamic";

const round = (n: number) => Math.round(n * 100) / 100;

// POST /api/trust/:id/transactions — DEPOSIT | PAYMENT | APPLIED.
// Trust accounts (522000) and the client-trust liability (462000) mirror each
// other, keeping client money segregated from firm money. A client's trust
// balance can never go negative.
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  return handle(async () => {
    const user = await requirePermission("trust:manage");
    const input = trustTxnSchema.parse(await req.json());
    const date = new Date(input.date);

    const result = await prisma.$transaction(async (tx) => {
      const acct = await tx.trustAccount.findFirst({
        where: { id: params.id, companyId: user.companyId },
      });
      if (!acct) throw new AuthError(404, "not_found");
      if (acct.status !== "ACTIVE") throw new AuthError(422, "account_closed");

      const balance = Number(acct.balance);
      const amount = round(input.amount);
      let newBalance = balance;
      let entryId: string | null = null;

      if (input.type === "DEPOSIT") {
        newBalance = round(balance + amount);
        const entry = await postJournal(tx, {
          companyId: user.companyId,
          journalCode: "TRU",
          date,
          description: `Trust deposit — ${acct.id.slice(0, 8)}`,
          createdById: user.id,
          currency: acct.currency,
          lines: [
            { accountCode: "522000", debit: amount, description: "Trust bank" },
            { accountCode: "462000", credit: amount, description: "Client trust liability" },
          ],
        });
        entryId = entry.id;
      } else if (input.type === "PAYMENT") {
        // Pay a third party on the client's behalf out of trust.
        if (amount > balance + 0.01) throw new AuthError(422, "insufficient_trust_funds");
        newBalance = round(balance - amount);
        const entry = await postJournal(tx, {
          companyId: user.companyId,
          journalCode: "TRU",
          date,
          description: `Trust payment — ${input.reference ?? ""}`.trim(),
          createdById: user.id,
          currency: acct.currency,
          lines: [
            { accountCode: "462000", debit: amount, description: "Client trust liability" },
            { accountCode: "522000", credit: amount, description: "Trust bank" },
          ],
        });
        entryId = entry.id;
      } else {
        // APPLIED: move trust funds to the operating account to settle a firm invoice.
        if (amount > balance + 0.01) throw new AuthError(422, "insufficient_trust_funds");
        const invoice = await tx.invoice.findFirst({
          where: { id: input.invoiceId!, companyId: user.companyId, clientId: acct.clientId },
        });
        if (!invoice) throw new AuthError(422, "invalid_invoice");
        if (!invoice.postedEntryId) throw new AuthError(422, "invoice_not_posted");
        const outstanding = round(Number(invoice.total) - Number(invoice.amountPaid));
        if (outstanding <= 0) throw new AuthError(422, "invoice_settled");
        if (amount > outstanding + 0.01) throw new AuthError(422, "amount_exceeds_outstanding");

        newBalance = round(balance - amount);
        // One balanced entry: trust liability down, AR down, operating bank up, trust bank down.
        const entry = await postJournal(tx, {
          companyId: user.companyId,
          journalCode: "TRU",
          date,
          description: `Applied trust to ${invoice.number}`,
          createdById: user.id,
          currency: acct.currency,
          lines: [
            { accountCode: "462000", debit: amount, description: "Client trust liability" },
            { accountCode: "521000", debit: amount, description: "Operating bank" },
            { accountCode: "411000", credit: amount, description: `Settle ${invoice.number}` },
            { accountCode: "522000", credit: amount, description: "Trust bank" },
          ],
        });
        entryId = entry.id;

        const newPaid = round(Number(invoice.amountPaid) + amount);
        await tx.invoice.update({
          where: { id: invoice.id },
          data: {
            amountPaid: newPaid,
            status: newPaid >= Number(invoice.total) - 0.01 ? "PAID" : "PART_PAID",
          },
        });
        await tx.receipt.create({
          data: {
            companyId: user.companyId,
            invoiceId: invoice.id,
            clientId: acct.clientId,
            date,
            amount,
            currency: acct.currency,
            method: "TRUST",
            reference: `Trust ${acct.id.slice(0, 8)}`,
            postedEntryId: entry.id,
            createdById: user.id,
          },
        });
      }

      await tx.trustAccount.update({ where: { id: acct.id }, data: { balance: newBalance } });
      const ledger = await tx.trustLedgerEntry.create({
        data: {
          companyId: user.companyId,
          trustAccountId: acct.id,
          date,
          type: input.type,
          amount,
          runningBalance: newBalance,
          reference: input.reference || null,
          matterId: input.matterId || null,
          invoiceId: input.invoiceId || null,
          postedEntryId: entryId,
          createdById: user.id,
        },
      });
      return { ledger, newBalance };
    });

    await writeAudit({
      companyId: user.companyId,
      actorId: user.id,
      action: `TRUST_${input.type}`,
      entityType: "TrustAccount",
      entityId: params.id,
      after: { amount: round(input.amount), balance: result.newBalance },
    });

    return { ok: true, balance: result.newBalance };
  });
}

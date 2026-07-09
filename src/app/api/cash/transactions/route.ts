import { NextRequest } from "next/server";
import { handle } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { requirePermission, AuthError } from "@/lib/auth";
import { postJournal } from "@/lib/ledger";
import { cashTxnSchema } from "@/lib/validation";
import { writeAudit } from "@/lib/audit";

export const dynamic = "force-dynamic";
const round = (n: number) => Math.round(n * 100) / 100;

// POST /api/cash/transactions — cash in/out. Balance can never go negative.
//   IN : Dr cash gl  / Cr counterpart
//   OUT: Dr counterpart / Cr cash gl
export async function POST(req: NextRequest) {
  return handle(async () => {
    const user = await requirePermission("cash:manage");
    const input = cashTxnSchema.parse(await req.json());
    const date = new Date(input.date);

    const result = await prisma.$transaction(async (tx) => {
      const acct = await tx.cashAccount.findFirst({ where: { id: input.cashAccountId, companyId: user.companyId } });
      if (!acct) throw new AuthError(404, "not_found");
      if (acct.status !== "ACTIVE") throw new AuthError(422, "account_closed");

      const amount = round(input.amount);
      const balance = Number(acct.balance);
      if (input.type === "OUT" && amount > balance + 0.01) throw new AuthError(422, "insufficient_cash");
      const newBalance = round(input.type === "IN" ? balance + amount : balance - amount);

      const lines =
        input.type === "IN"
          ? [
              { accountCode: acct.glAccountCode, debit: amount, description: input.description },
              { accountCode: input.counterpartAccountCode, credit: amount, description: input.description },
            ]
          : [
              { accountCode: input.counterpartAccountCode, debit: amount, description: input.description },
              { accountCode: acct.glAccountCode, credit: amount, description: input.description },
            ];

      const entry = await postJournal(tx, {
        companyId: user.companyId, journalCode: "CSH", date,
        description: `Cash ${input.type}: ${input.description}`, createdById: user.id, lines,
      });

      await tx.cashAccount.update({ where: { id: acct.id }, data: { balance: newBalance } });
      await tx.cashTransaction.create({
        data: {
          companyId: user.companyId, cashAccountId: acct.id, date, type: input.type, amount,
          description: input.description, counterpartAccountCode: input.counterpartAccountCode,
          runningBalance: newBalance, postedEntryId: entry.id, createdById: user.id,
        },
      });
      return { newBalance, entryNo: entry.entryNo };
    });

    await writeAudit({ companyId: user.companyId, actorId: user.id, action: `CASH_${input.type}`, entityType: "CashAccount", entityId: input.cashAccountId, after: { amount: round(input.amount), balance: result.newBalance } });
    return { ok: true, balance: result.newBalance, entryNo: result.entryNo };
  });
}

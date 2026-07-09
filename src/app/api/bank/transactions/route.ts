import { NextRequest } from "next/server";
import { handle } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { requirePermission, AuthError } from "@/lib/auth";
import { postJournal } from "@/lib/ledger";
import { bankTxnSchema } from "@/lib/validation";
import { writeAudit } from "@/lib/audit";

export const dynamic = "force-dynamic";
const round = (n: number) => Math.round(n * 100) / 100;
const IN_TYPES = new Set(["INTEREST", "TRANSFER_IN"]);

// POST /api/bank/transactions — bank charge / interest / transfer, posted to GL.
export async function POST(req: NextRequest) {
  return handle(async () => {
    const user = await requirePermission("bank:manage");
    const input = bankTxnSchema.parse(await req.json());
    const date = new Date(input.date);

    const result = await prisma.$transaction(async (tx) => {
      const acct = await tx.bankAccount.findFirst({ where: { id: input.bankAccountId, companyId: user.companyId } });
      if (!acct) throw new AuthError(404, "not_found");
      const amount = round(input.amount);
      const moneyIn = IN_TYPES.has(input.type);
      const lines = moneyIn
        ? [
            { accountCode: acct.glAccountCode, debit: amount, description: input.description },
            { accountCode: input.counterpartAccountCode, credit: amount, description: input.description },
          ]
        : [
            { accountCode: input.counterpartAccountCode, debit: amount, description: input.description },
            { accountCode: acct.glAccountCode, credit: amount, description: input.description },
          ];
      const entry = await postJournal(tx, {
        companyId: user.companyId, journalCode: "BNK", date,
        description: `Bank ${input.type}: ${input.description}`, createdById: user.id, lines,
      });
      const created = await tx.bankTransaction.create({
        data: {
          companyId: user.companyId, bankAccountId: acct.id, date, type: input.type, amount,
          description: input.description, counterpartAccountCode: input.counterpartAccountCode,
          postedEntryId: entry.id, createdById: user.id,
        },
      });
      return { id: created.id, entryNo: entry.entryNo };
    });

    await writeAudit({ companyId: user.companyId, actorId: user.id, action: "BANK_TXN", entityType: "BankTransaction", entityId: result.id, after: { type: input.type, amount: round(input.amount) } });
    return { ok: true, entryNo: result.entryNo };
  });
}

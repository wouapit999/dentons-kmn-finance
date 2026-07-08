import type { Prisma } from "@prisma/client";
import { AuthError } from "./auth";

export interface PostLine {
  accountCode: string;
  debit?: number;
  credit?: number;
  description?: string;
}

/**
 * Post a balanced double-entry journal from within a transaction, by account
 * code. Selects the open accounting period covering `date` (falling back to any
 * open period), validates debits == credits, and creates an immutable POSTED
 * entry with a sequential number. Returns the created entry.
 */
export async function postJournal(
  tx: Prisma.TransactionClient,
  params: {
    companyId: string;
    journalCode: string;
    date: Date;
    description: string;
    createdById?: string;
    currency?: string;
    lines: PostLine[];
  },
) {
  const { companyId, journalCode, date, description } = params;

  const journal = await tx.journal.findFirst({
    where: { companyId, code: journalCode },
  });
  if (!journal) throw new AuthError(422, "journal_not_found");

  const period =
    (await tx.accountingPeriod.findFirst({
      where: { companyId, status: "OPEN", startDate: { lte: date }, endDate: { gte: date } },
    })) ??
    (await tx.accountingPeriod.findFirst({
      where: { companyId, status: "OPEN" },
      orderBy: { seq: "asc" },
    }));
  if (!period) throw new AuthError(422, "no_open_period");

  const codes = Array.from(new Set(params.lines.map((l) => l.accountCode)));
  const accounts = await tx.account.findMany({
    where: { companyId, code: { in: codes } },
  });
  const byCode = new Map(accounts.map((a) => [a.code, a]));
  for (const code of codes) {
    const acc = byCode.get(code);
    if (!acc) throw new AuthError(422, `account_missing:${code}`);
    if (!acc.isPostable) throw new AuthError(422, `account_not_postable:${code}`);
  }

  const round = (n: number) => Math.round(n * 100) / 100;
  const totalDebit = round(params.lines.reduce((s, l) => s + (l.debit ?? 0), 0));
  const totalCredit = round(params.lines.reduce((s, l) => s + (l.credit ?? 0), 0));
  if (Math.abs(totalDebit - totalCredit) > 0.01 || totalDebit <= 0) {
    throw new AuthError(422, "unbalanced_entry");
  }

  const count = await tx.journalEntry.count({ where: { companyId } });
  const entryNo = `${journal.code}-${date.getFullYear()}-${String(count + 1).padStart(5, "0")}`;

  return tx.journalEntry.create({
    data: {
      companyId,
      journalId: journal.id,
      periodId: period.id,
      entryNo,
      entryDate: date,
      description,
      currency: params.currency ?? "XAF",
      status: "POSTED",
      postedAt: new Date(),
      createdById: params.createdById ?? null,
      lines: {
        create: params.lines
          .filter((l) => (l.debit ?? 0) > 0 || (l.credit ?? 0) > 0)
          .map((l) => ({
            accountId: byCode.get(l.accountCode)!.id,
            debit: l.debit ?? 0,
            credit: l.credit ?? 0,
            description: l.description ?? null,
          })),
      },
    },
  });
}

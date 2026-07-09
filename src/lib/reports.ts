import "server-only";
import { prisma } from "./prisma";

export interface AccountBalance {
  code: string;
  name: string;
  type: string;
  debit: number;
  credit: number;
  balance: number; // signed per natural side (see below)
}

/**
 * Per-account debit/credit totals over POSTED journal lines, optionally bounded
 * by entry date. `balance` is normalised to each account type's natural side:
 * ASSET/EXPENSE = debit − credit; LIABILITY/EQUITY/REVENUE = credit − debit.
 */
export async function accountBalances(
  companyId: string,
  opts: { from?: Date; to?: Date } = {},
): Promise<AccountBalance[]> {
  const entryWhere: Record<string, unknown> = { companyId, status: "POSTED" };
  if (opts.from || opts.to) {
    entryWhere.entryDate = {
      ...(opts.from ? { gte: opts.from } : {}),
      ...(opts.to ? { lte: opts.to } : {}),
    };
  }

  const accounts = await prisma.account.findMany({
    where: { companyId, status: "ACTIVE" },
    orderBy: { code: "asc" },
    include: { lines: { where: { entry: entryWhere }, select: { debit: true, credit: true } } },
  });

  return accounts.map((a) => {
    const debit = a.lines.reduce((s, l) => s + Number(l.debit), 0);
    const credit = a.lines.reduce((s, l) => s + Number(l.credit), 0);
    const natural =
      a.type === "ASSET" || a.type === "EXPENSE" ? debit - credit : credit - debit;
    return {
      code: a.code,
      name: a.name,
      type: a.type,
      debit: Math.round(debit * 100) / 100,
      credit: Math.round(credit * 100) / 100,
      balance: Math.round(natural * 100) / 100,
    };
  });
}

/** Age an amount into 0–30 / 31–60 / 61–90 / 90+ buckets from a reference date. */
export function ageBucket(dueDate: Date, asOf: Date): "current" | "d30" | "d60" | "d90plus" {
  const days = Math.floor((asOf.getTime() - dueDate.getTime()) / 86_400_000);
  if (days <= 30) return "current";
  if (days <= 60) return "d30";
  if (days <= 90) return "d60";
  return "d90plus";
}

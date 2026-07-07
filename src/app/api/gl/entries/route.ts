import { NextRequest } from "next/server";
import { handle } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { requirePermission, AuthError } from "@/lib/auth";
import { createEntrySchema } from "@/lib/validation";
import { writeAudit } from "@/lib/audit";

export const dynamic = "force-dynamic";

// GET /api/gl/entries — recent posted journal entries with their lines.
export async function GET() {
  return handle(async () => {
    const user = await requirePermission("gl:read");
    const entries = await prisma.journalEntry.findMany({
      where: { companyId: user.companyId },
      orderBy: { createdAt: "desc" },
      take: 100,
      include: {
        journal: true,
        period: true,
        lines: { include: { account: true } },
      },
    });
    return entries.map((e) => ({
      id: e.id,
      entryNo: e.entryNo,
      entryDate: e.entryDate,
      description: e.description,
      currency: e.currency,
      status: e.status,
      journal: e.journal.code,
      period: e.period.name,
      lines: e.lines.map((l) => ({
        account: `${l.account.code} — ${l.account.name}`,
        debit: l.debit.toString(),
        credit: l.credit.toString(),
        description: l.description,
      })),
    }));
  });
}

// POST /api/gl/entries — post a balanced, double-entry journal entry.
// Enforces: period OPEN, accounts postable & in-company, debits == credits.
export async function POST(req: NextRequest) {
  return handle(async () => {
    const user = await requirePermission("gl:post");
    const input = createEntrySchema.parse(await req.json());

    const result = await prisma.$transaction(async (tx) => {
      const journal = await tx.journal.findFirst({
        where: { id: input.journalId, companyId: user.companyId },
      });
      if (!journal) throw new AuthError(422, "invalid_journal");

      const period = await tx.accountingPeriod.findFirst({
        where: { id: input.periodId, companyId: user.companyId },
      });
      if (!period) throw new AuthError(422, "invalid_period");
      if (period.status !== "OPEN") throw new AuthError(422, "period_closed");

      // All referenced accounts must belong to the company and be postable.
      const accountIds = Array.from(new Set(input.lines.map((l) => l.accountId)));
      const accounts = await tx.account.findMany({
        where: { id: { in: accountIds }, companyId: user.companyId },
      });
      if (accounts.length !== accountIds.length) throw new AuthError(422, "invalid_account");
      if (accounts.some((a) => !a.isPostable)) throw new AuthError(422, "account_not_postable");

      // Sequential, human-readable entry number scoped to the company.
      const count = await tx.journalEntry.count({ where: { companyId: user.companyId } });
      const entryNo = `${journal.code}-${new Date(input.entryDate).getFullYear()}-${String(count + 1).padStart(5, "0")}`;

      const entry = await tx.journalEntry.create({
        data: {
          companyId: user.companyId,
          journalId: journal.id,
          periodId: period.id,
          entryNo,
          entryDate: new Date(input.entryDate),
          description: input.description ?? null,
          currency: input.currency,
          status: "POSTED",
          postedAt: new Date(),
          createdById: user.id,
          lines: {
            create: input.lines.map((l) => ({
              accountId: l.accountId,
              debit: l.debit,
              credit: l.credit,
              description: l.description ?? null,
            })),
          },
        },
      });
      return entry;
    });

    await writeAudit({
      companyId: user.companyId,
      actorId: user.id,
      action: "JOURNAL_POSTED",
      entityType: "JournalEntry",
      entityId: result.id,
      after: { entryNo: result.entryNo, lines: input.lines.length },
    });

    return { id: result.id, entryNo: result.entryNo };
  });
}

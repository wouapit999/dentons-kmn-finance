import { handle } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { requirePermission, AuthError } from "@/lib/auth";

export const dynamic = "force-dynamic";
const IN_TYPES = new Set(["INTEREST", "TRANSFER_IN"]);

// GET /api/bank/:id — account detail with transactions + reconciliation summary.
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  return handle(async () => {
    const user = await requirePermission("bank:read");
    const acct = await prisma.bankAccount.findFirst({
      where: { id: params.id, companyId: user.companyId },
      include: { transactions: { orderBy: { date: "desc" } } },
    });
    if (!acct) throw new AuthError(404, "not_found");
    const round = (n: number) => Math.round(n * 100) / 100;
    let book = 0;
    let cleared = 0;
    for (const t of acct.transactions) {
      const signed = IN_TYPES.has(t.type) ? Number(t.amount) : -Number(t.amount);
      book += signed;
      if (t.reconciled) cleared += signed;
    }
    return {
      id: acct.id,
      name: acct.name,
      bankName: acct.bankName,
      accountNumber: acct.accountNumber,
      bookBalance: round(book),
      clearedBalance: round(cleared),
      unreconciled: round(book - cleared),
      transactions: acct.transactions.map((t) => ({
        id: t.id, date: t.date, type: t.type, amount: Number(t.amount),
        description: t.description, reconciled: t.reconciled,
        signed: IN_TYPES.has(t.type) ? Number(t.amount) : -Number(t.amount),
      })),
    };
  });
}

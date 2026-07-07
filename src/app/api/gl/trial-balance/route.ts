import { handle } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/auth";

export const dynamic = "force-dynamic";

// GET /api/gl/trial-balance — debit/credit totals per account across all
// posted entries, plus grand totals (which must be equal for a balanced ledger).
export async function GET() {
  return handle(async () => {
    const user = await requirePermission("gl:read");

    const accounts = await prisma.account.findMany({
      where: { companyId: user.companyId, status: "ACTIVE" },
      orderBy: { code: "asc" },
      include: {
        lines: {
          where: { entry: { companyId: user.companyId, status: "POSTED" } },
          select: { debit: true, credit: true },
        },
      },
    });

    let totalDebit = 0;
    let totalCredit = 0;
    const rows = accounts
      .map((a) => {
        const debit = a.lines.reduce((s, l) => s + Number(l.debit), 0);
        const credit = a.lines.reduce((s, l) => s + Number(l.credit), 0);
        return { code: a.code, name: a.name, type: a.type, debit, credit };
      })
      .filter((r) => r.debit !== 0 || r.credit !== 0);

    for (const r of rows) {
      totalDebit += r.debit;
      totalCredit += r.credit;
    }

    return {
      rows,
      totalDebit,
      totalCredit,
      balanced: Math.abs(totalDebit - totalCredit) < 0.0001,
    };
  });
}

import { handle } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/auth";
import { ageBucket } from "@/lib/reports";

export const dynamic = "force-dynamic";

// GET /api/reports/aged-payables — outstanding vendor bills bucketed by age.
export async function GET() {
  return handle(async () => {
    const user = await requirePermission("report:read");
    const asOf = new Date();
    const bills = await prisma.vendorBill.findMany({
      where: { companyId: user.companyId, status: { in: ["POSTED", "PART_PAID"] } },
      include: { supplier: { select: { name: true } } },
    });

    const rows = bills
      .map((b) => ({
        number: b.number,
        supplier: b.supplier.name,
        dueDate: b.dueDate,
        outstanding: Math.round((Number(b.total) - Number(b.amountPaid)) * 100) / 100,
        bucket: ageBucket(b.dueDate, asOf),
      }))
      .filter((r) => r.outstanding > 0);

    const totals = { current: 0, d30: 0, d60: 0, d90plus: 0, total: 0 };
    for (const r of rows) {
      totals[r.bucket] += r.outstanding;
      totals.total += r.outstanding;
    }
    const round = (n: number) => Math.round(n * 100) / 100;
    (Object.keys(totals) as (keyof typeof totals)[]).forEach((k) => (totals[k] = round(totals[k])));

    return { rows, totals };
  });
}

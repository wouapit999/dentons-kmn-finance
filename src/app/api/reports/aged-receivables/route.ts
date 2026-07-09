import { handle } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/auth";
import { ageBucket } from "@/lib/reports";

export const dynamic = "force-dynamic";

// GET /api/reports/aged-receivables — outstanding invoices bucketed by age.
export async function GET() {
  return handle(async () => {
    const user = await requirePermission("report:read");
    const asOf = new Date();
    const invoices = await prisma.invoice.findMany({
      where: { companyId: user.companyId, status: { in: ["POSTED", "PART_PAID"] } },
      include: { client: { select: { name: true } } },
    });

    const rows = invoices
      .map((i) => ({
        number: i.number,
        client: i.client.name,
        dueDate: i.dueDate,
        outstanding: Math.round((Number(i.total) - Number(i.amountPaid)) * 100) / 100,
        bucket: ageBucket(i.dueDate, asOf),
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

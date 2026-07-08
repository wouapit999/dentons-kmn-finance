import { NextRequest } from "next/server";
import { handle } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { requirePermission, AuthError } from "@/lib/auth";

export const dynamic = "force-dynamic";

// GET /api/billing/unbilled?matterId=... — billable, not-yet-invoiced time & disbursements.
export async function GET(req: NextRequest) {
  return handle(async () => {
    const user = await requirePermission("invoice:create");
    const matterId = req.nextUrl.searchParams.get("matterId");
    if (!matterId) throw new AuthError(422, "matterId_required");

    const matter = await prisma.matter.findFirst({
      where: { id: matterId, companyId: user.companyId },
      include: { client: { select: { id: true, name: true } } },
    });
    if (!matter) throw new AuthError(404, "matter_not_found");

    const [time, disb] = await Promise.all([
      prisma.timeEntry.findMany({
        where: { companyId: user.companyId, matterId, billable: true, status: "DRAFT", invoiceId: null },
        include: { lawyer: { select: { fullName: true } } },
        orderBy: { date: "asc" },
      }),
      prisma.disbursement.findMany({
        where: { companyId: user.companyId, matterId, billable: true, status: "DRAFT", invoiceId: null },
        orderBy: { date: "asc" },
      }),
    ]);

    return {
      matter: { id: matter.id, code: matter.code, name: matter.name, currency: matter.currency },
      client: matter.client,
      time: time.map((t) => ({
        id: t.id,
        date: t.date,
        lawyer: t.lawyer.fullName,
        hours: Math.round((t.minutes / 60) * 100) / 100,
        narrative: t.narrative,
        amount: Number(t.amount),
      })),
      disbursements: disb.map((d) => ({
        id: d.id,
        date: d.date,
        description: d.description,
        vendorName: d.vendorName,
        amount: Number(d.amount),
      })),
    };
  });
}

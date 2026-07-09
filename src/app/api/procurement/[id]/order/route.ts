import { handle } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { requirePermission, AuthError } from "@/lib/auth";
import { writeAudit } from "@/lib/audit";

export const dynamic = "force-dynamic";

// POST /api/procurement/:id/order — issue a purchase order from an approved request.
export async function POST(_req: Request, { params }: { params: { id: string } }) {
  return handle(async () => {
    const user = await requirePermission("procure:approve");
    const result = await prisma.$transaction(async (tx) => {
      const pr = await tx.purchaseRequest.findFirst({
        where: { id: params.id, companyId: user.companyId },
      });
      if (!pr) throw new AuthError(404, "not_found");
      if (pr.status !== "APPROVED") throw new AuthError(422, "not_approved");

      const count = await tx.purchaseOrder.count({ where: { companyId: user.companyId } });
      const number = `PO-${new Date().getFullYear()}-${String(count + 1).padStart(5, "0")}`;
      const po = await tx.purchaseOrder.create({
        data: {
          companyId: user.companyId, requestId: pr.id, number,
          amount: pr.amount, currency: pr.currency, status: "OPEN", createdById: user.id,
        },
      });
      await tx.purchaseRequest.update({ where: { id: pr.id }, data: { status: "ORDERED" } });
      return { number: po.number, prNumber: pr.number };
    });
    await writeAudit({ companyId: user.companyId, actorId: user.id, action: "PO_ISSUED", entityType: "PurchaseRequest", entityId: params.id, after: { po: result.number } });
    return { ok: true, number: result.number };
  });
}

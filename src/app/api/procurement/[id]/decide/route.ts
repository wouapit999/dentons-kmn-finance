import { NextRequest } from "next/server";
import { handle } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { requirePermission, AuthError } from "@/lib/auth";
import { decidePRSchema } from "@/lib/validation";
import { writeAudit } from "@/lib/audit";

export const dynamic = "force-dynamic";

// POST /api/procurement/:id/decide — approve or reject a pending request.
// Segregation of duties: the requester cannot approve their own request.
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  return handle(async () => {
    const user = await requirePermission("procure:approve");
    const input = decidePRSchema.parse(await req.json());
    const pr = await prisma.purchaseRequest.findFirst({
      where: { id: params.id, companyId: user.companyId },
    });
    if (!pr) throw new AuthError(404, "not_found");
    if (pr.status !== "PENDING") throw new AuthError(422, "not_pending");
    if (pr.createdById === user.id) throw new AuthError(422, "cannot_approve_own_request");

    await prisma.purchaseRequest.update({
      where: { id: pr.id },
      data: {
        status: input.decision,
        decidedById: user.id,
        decidedAt: new Date(),
        decisionNote: input.note || null,
      },
    });
    await writeAudit({ companyId: user.companyId, actorId: user.id, action: `PR_${input.decision}`, entityType: "PurchaseRequest", entityId: pr.id, before: { status: pr.status }, after: { status: input.decision } });
    return { ok: true };
  });
}

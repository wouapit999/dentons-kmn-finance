import { NextRequest } from "next/server";
import { handle } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/auth";
import { createPRSchema } from "@/lib/validation";
import { writeAudit } from "@/lib/audit";

export const dynamic = "force-dynamic";

// GET /api/procurement — purchase requests with any orders.
export async function GET() {
  return handle(async () => {
    const user = await requirePermission("procure:read");
    const prs = await prisma.purchaseRequest.findMany({
      where: { companyId: user.companyId },
      orderBy: { createdAt: "desc" },
      include: { orders: { select: { number: true } } },
    });
    return prs.map((p) => ({
      id: p.id,
      number: p.number,
      description: p.description,
      amount: Number(p.amount),
      status: p.status,
      decisionNote: p.decisionNote,
      order: p.orders[0]?.number ?? null,
    }));
  });
}

// POST /api/procurement — raise a purchase request (enters approval workflow).
export async function POST(req: NextRequest) {
  return handle(async () => {
    const user = await requirePermission("procure:request");
    const input = createPRSchema.parse(await req.json());
    const count = await prisma.purchaseRequest.count({ where: { companyId: user.companyId } });
    const number = `PR-${new Date().getFullYear()}-${String(count + 1).padStart(5, "0")}`;
    const created = await prisma.purchaseRequest.create({
      data: {
        companyId: user.companyId, number, description: input.description,
        amount: input.amount, status: "PENDING", createdById: user.id,
      },
    });
    await writeAudit({ companyId: user.companyId, actorId: user.id, action: "PR_CREATED", entityType: "PurchaseRequest", entityId: created.id, after: { number, amount: input.amount } });
    return { id: created.id, number };
  });
}

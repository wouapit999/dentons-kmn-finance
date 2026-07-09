import { NextRequest } from "next/server";
import { handle } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { requirePermission, AuthError } from "@/lib/auth";
import { createCashAccountSchema } from "@/lib/validation";
import { writeAudit } from "@/lib/audit";

export const dynamic = "force-dynamic";

// GET /api/cash — cash accounts with balances.
export async function GET() {
  return handle(async () => {
    const user = await requirePermission("cash:read");
    const accounts = await prisma.cashAccount.findMany({
      where: { companyId: user.companyId },
      orderBy: { createdAt: "desc" },
      include: { _count: { select: { transactions: true } } },
    });
    return accounts.map((a) => ({
      id: a.id,
      name: a.name,
      glAccountCode: a.glAccountCode,
      balance: Number(a.balance),
      currency: a.currency,
      status: a.status,
      transactions: a._count.transactions,
    }));
  });
}

// POST /api/cash — open a cash account.
export async function POST(req: NextRequest) {
  return handle(async () => {
    const user = await requirePermission("cash:manage");
    const input = createCashAccountSchema.parse(await req.json());
    const gl = await prisma.account.findFirst({
      where: { companyId: user.companyId, code: input.glAccountCode, type: "ASSET", isPostable: true },
    });
    if (!gl) throw new AuthError(422, "invalid_gl_account");
    const created = await prisma.cashAccount.create({
      data: { companyId: user.companyId, name: input.name, glAccountCode: input.glAccountCode, createdById: user.id },
    });
    await writeAudit({ companyId: user.companyId, actorId: user.id, action: "CASH_ACCOUNT_OPENED", entityType: "CashAccount", entityId: created.id, after: { name: created.name } });
    return { id: created.id };
  });
}

import { NextRequest } from "next/server";
import { z } from "zod";
import { handle } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { requirePermission, AuthError } from "@/lib/auth";
import { writeAudit } from "@/lib/audit";

export const dynamic = "force-dynamic";

const schema = z.object({ transactionId: z.string().uuid(), reconciled: z.boolean() });

// POST /api/bank/reconcile — mark a bank transaction reconciled / unreconciled.
export async function POST(req: NextRequest) {
  return handle(async () => {
    const user = await requirePermission("bank:reconcile");
    const { transactionId, reconciled } = schema.parse(await req.json());
    const txn = await prisma.bankTransaction.findFirst({
      where: { id: transactionId, companyId: user.companyId },
    });
    if (!txn) throw new AuthError(404, "not_found");
    await prisma.bankTransaction.update({ where: { id: txn.id }, data: { reconciled } });
    await writeAudit({ companyId: user.companyId, actorId: user.id, action: "BANK_RECONCILE", entityType: "BankTransaction", entityId: txn.id, after: { reconciled } });
    return { ok: true };
  });
}

import { NextRequest } from "next/server";
import { handle } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { requirePermission, AuthError } from "@/lib/auth";
import { createBankAccountSchema } from "@/lib/validation";
import { writeAudit } from "@/lib/audit";

export const dynamic = "force-dynamic";

// GET /api/bank — bank accounts with a book balance from recorded transactions.
export async function GET() {
  return handle(async () => {
    const user = await requirePermission("bank:read");
    const accounts = await prisma.bankAccount.findMany({
      where: { companyId: user.companyId },
      orderBy: { createdAt: "desc" },
      include: { transactions: { select: { type: true, amount: true, reconciled: true } } },
    });
    const inTypes = new Set(["INTEREST", "TRANSFER_IN"]);
    return accounts.map((a) => {
      let book = 0;
      let cleared = 0;
      for (const t of a.transactions) {
        const signed = inTypes.has(t.type) ? Number(t.amount) : -Number(t.amount);
        book += signed;
        if (t.reconciled) cleared += signed;
      }
      return {
        id: a.id,
        name: a.name,
        bankName: a.bankName,
        accountNumber: a.accountNumber,
        glAccountCode: a.glAccountCode,
        bookBalance: Math.round(book * 100) / 100,
        clearedBalance: Math.round(cleared * 100) / 100,
        transactions: a.transactions.length,
      };
    });
  });
}

// POST /api/bank — open a bank account.
export async function POST(req: NextRequest) {
  return handle(async () => {
    const user = await requirePermission("bank:manage");
    const input = createBankAccountSchema.parse(await req.json());
    const gl = await prisma.account.findFirst({
      where: { companyId: user.companyId, code: input.glAccountCode, type: "ASSET", isPostable: true },
    });
    if (!gl) throw new AuthError(422, "invalid_gl_account");
    const created = await prisma.bankAccount.create({
      data: {
        companyId: user.companyId, name: input.name, bankName: input.bankName || null,
        accountNumber: input.accountNumber || null, glAccountCode: input.glAccountCode, createdById: user.id,
      },
    });
    await writeAudit({ companyId: user.companyId, actorId: user.id, action: "BANK_ACCOUNT_OPENED", entityType: "BankAccount", entityId: created.id, after: { name: created.name } });
    return { id: created.id };
  });
}

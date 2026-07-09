import { NextRequest } from "next/server";
import { handle } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { requirePermission, AuthError } from "@/lib/auth";
import { createBillSchema } from "@/lib/validation";
import { writeAudit } from "@/lib/audit";

export const dynamic = "force-dynamic";

const round = (n: number) => Math.round(n * 100) / 100;

// GET /api/bills — list vendor bills with supplier + outstanding.
export async function GET() {
  return handle(async () => {
    const user = await requirePermission("ap:read");
    const bills = await prisma.vendorBill.findMany({
      where: { companyId: user.companyId },
      orderBy: { createdAt: "desc" },
      include: { supplier: { select: { name: true } } },
    });
    return bills.map((b) => ({
      id: b.id,
      number: b.number,
      supplier: b.supplier.name,
      supplierRef: b.supplierRef,
      date: b.date,
      dueDate: b.dueDate,
      description: b.description,
      currency: b.currency,
      subtotal: Number(b.subtotal),
      vatAmount: Number(b.vatAmount),
      total: Number(b.total),
      amountPaid: Number(b.amountPaid),
      outstanding: round(Number(b.total) - Number(b.amountPaid)),
      status: b.status,
      posted: !!b.postedEntryId,
    }));
  });
}

// POST /api/bills — create a DRAFT vendor bill (input VAT deductible).
export async function POST(req: NextRequest) {
  return handle(async () => {
    const user = await requirePermission("ap:manage");
    const input = createBillSchema.parse(await req.json());

    const supplier = await prisma.supplier.findFirst({
      where: { id: input.supplierId, companyId: user.companyId },
    });
    if (!supplier) throw new AuthError(422, "invalid_supplier");

    const account = await prisma.account.findFirst({
      where: { companyId: user.companyId, code: input.expenseAccountCode, isPostable: true },
    });
    if (!account) throw new AuthError(422, "invalid_expense_account");

    const subtotal = round(input.amount);
    const vatAmount = round(subtotal * (input.vatRate / 100));
    const total = round(subtotal + vatAmount);

    const count = await prisma.vendorBill.count({ where: { companyId: user.companyId } });
    const number = `BILL-${new Date(input.date).getFullYear()}-${String(count + 1).padStart(5, "0")}`;

    const created = await prisma.vendorBill.create({
      data: {
        companyId: user.companyId,
        supplierId: supplier.id,
        number,
        supplierRef: input.supplierRef || null,
        date: new Date(input.date),
        dueDate: new Date(input.dueDate),
        description: input.description,
        expenseAccountCode: input.expenseAccountCode,
        currency: input.currency,
        subtotal,
        vatRate: input.vatRate,
        vatAmount,
        total,
        status: "DRAFT",
        createdById: user.id,
      },
    });
    await writeAudit({
      companyId: user.companyId,
      actorId: user.id,
      action: "BILL_CREATED",
      entityType: "VendorBill",
      entityId: created.id,
      after: { number, supplier: supplier.name, total },
    });
    return { id: created.id, number };
  });
}

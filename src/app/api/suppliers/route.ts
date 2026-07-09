import { NextRequest } from "next/server";
import { handle } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/auth";
import { createSupplierSchema } from "@/lib/validation";
import { writeAudit } from "@/lib/audit";

export const dynamic = "force-dynamic";

// GET /api/suppliers — list suppliers with bill counts.
export async function GET() {
  return handle(async () => {
    const user = await requirePermission("ap:read");
    const suppliers = await prisma.supplier.findMany({
      where: { companyId: user.companyId, status: "ACTIVE" },
      orderBy: { createdAt: "desc" },
      include: { _count: { select: { bills: true } } },
    });
    return suppliers.map((s) => ({
      id: s.id,
      name: s.name,
      email: s.email,
      taxId: s.taxId,
      bills: s._count.bills,
    }));
  });
}

// POST /api/suppliers — create a supplier.
export async function POST(req: NextRequest) {
  return handle(async () => {
    const user = await requirePermission("ap:manage");
    const input = createSupplierSchema.parse(await req.json());
    const created = await prisma.supplier.create({
      data: {
        companyId: user.companyId,
        name: input.name,
        email: input.email || null,
        phone: input.phone || null,
        taxId: input.taxId || null,
        createdById: user.id,
      },
    });
    await writeAudit({
      companyId: user.companyId,
      actorId: user.id,
      action: "SUPPLIER_CREATED",
      entityType: "Supplier",
      entityId: created.id,
      after: { name: created.name },
    });
    return { id: created.id };
  });
}

import { NextRequest } from "next/server";
import { handle } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/auth";
import { createEmployeeSchema } from "@/lib/validation";
import { writeAudit } from "@/lib/audit";

export const dynamic = "force-dynamic";

// GET /api/employees — list employees.
export async function GET() {
  return handle(async () => {
    const user = await requirePermission("payroll:read");
    const employees = await prisma.employee.findMany({
      where: { companyId: user.companyId, status: "ACTIVE" },
      orderBy: { employeeNo: "asc" },
    });
    return employees.map((e) => ({
      id: e.id,
      employeeNo: e.employeeNo,
      fullName: e.fullName,
      position: e.position,
      baseSalary: Number(e.baseSalary),
      housingAllowance: Number(e.housingAllowance),
      transportAllowance: Number(e.transportAllowance),
      cnpsNo: e.cnpsNo,
    }));
  });
}

// POST /api/employees — add an employee.
export async function POST(req: NextRequest) {
  return handle(async () => {
    const user = await requirePermission("payroll:manage");
    const input = createEmployeeSchema.parse(await req.json());
    const created = await prisma.employee.create({
      data: {
        companyId: user.companyId,
        employeeNo: input.employeeNo,
        fullName: input.fullName,
        position: input.position || null,
        baseSalary: input.baseSalary,
        housingAllowance: input.housingAllowance,
        transportAllowance: input.transportAllowance,
        cnpsNo: input.cnpsNo || null,
        bankAccount: input.bankAccount || null,
        createdById: user.id,
      },
    });
    await writeAudit({
      companyId: user.companyId,
      actorId: user.id,
      action: "EMPLOYEE_CREATED",
      entityType: "Employee",
      entityId: created.id,
      after: { employeeNo: created.employeeNo, fullName: created.fullName },
    });
    return { id: created.id };
  });
}

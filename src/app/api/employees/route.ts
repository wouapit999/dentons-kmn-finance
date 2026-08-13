/*
 * Dentons KMN ERP
 * Copyright (c) 2026 Bouquet Innovation SA. All rights reserved.
 * Proprietary and confidential. Unauthorised copying, distribution, modification,
 * or use of this file, via any medium, is strictly prohibited.
 */
import { NextRequest } from "next/server";
import { handle } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/auth";
import { createEmployeeSchema } from "@/lib/validation";
import { writeAudit } from "@/lib/audit";

export const dynamic = "force-dynamic";

// GET /api/employees — list employees. Salary/compensation figures are only
// returned to holders of payroll:compensation (HR, Managing Partner, IT, CFO);
// all other viewers get the record without any pay data.
export async function GET() {
  return handle(async () => {
    const user = await requirePermission("payroll:read");
    const canSeePay = user.permissions.has("payroll:compensation");
    const employees = await prisma.employee.findMany({
      where: { companyId: user.companyId, status: "ACTIVE" },
      orderBy: { employeeNo: "asc" },
    });
    return employees.map((e) => ({
      id: e.id,
      employeeNo: e.employeeNo,
      fullName: e.fullName,
      position: e.position,
      cnpsNo: e.cnpsNo,
      canSeePay,
      // Compensation & bank details omitted entirely unless authorised.
      ...(canSeePay
        ? {
            baseSalary: Number(e.baseSalary),
            housingAllowance: Number(e.housingAllowance),
            transportAllowance: Number(e.transportAllowance),
            bankAccount: e.bankAccount,
          }
        : {}),
    }));
  });
}

// Next employee number for this company: EMP-#### (zero-padded, continues the
// highest existing EMP-n). Assigned automatically on create.
async function nextEmployeeNo(companyId: string): Promise<string> {
  const existing = await prisma.employee.findMany({
    where: { companyId, employeeNo: { startsWith: "EMP-" } },
    select: { employeeNo: true },
  });
  const highest = existing.reduce((max, e) => {
    const n = parseInt(e.employeeNo.slice(4).replace(/\D/g, ""), 10);
    return Number.isFinite(n) && n > max ? n : max;
  }, 0);
  return `EMP-${String(highest + 1).padStart(4, "0")}`;
}

// POST /api/employees — add an employee. The employee number is generated
// server-side; compensation fields are only accepted from authorised roles.
export async function POST(req: NextRequest) {
  return handle(async () => {
    const user = await requirePermission("payroll:manage");
    const input = createEmployeeSchema.parse(await req.json());
    const canSetPay = user.permissions.has("payroll:compensation");

    // Retry a couple of times in case two employees are created concurrently.
    let created;
    for (let attempt = 0; ; attempt++) {
      const employeeNo = await nextEmployeeNo(user.companyId);
      try {
        created = await prisma.employee.create({
          data: {
            companyId: user.companyId,
            employeeNo,
            fullName: input.fullName,
            position: input.position || null,
            baseSalary: canSetPay ? input.baseSalary : 0,
            housingAllowance: canSetPay ? input.housingAllowance : 0,
            transportAllowance: canSetPay ? input.transportAllowance : 0,
            cnpsNo: input.cnpsNo || null,
            bankAccount: canSetPay ? input.bankAccount || null : null,
            createdById: user.id,
          },
        });
        break;
      } catch (e) {
        if ((e as { code?: string })?.code === "P2002" && attempt < 4) continue;
        throw e;
      }
    }
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

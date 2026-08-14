/*
 * Dentons KMN ERP
 * Copyright (c) 2026 Bouquet Innovation SA. All rights reserved.
 * Proprietary and confidential. Unauthorised copying, distribution, modification,
 * or use of this file, via any medium, is strictly prohibited.
 */
import { NextRequest } from "next/server";
import { handle } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { requirePermission, AuthError } from "@/lib/auth";
import { updateEmployeeSchema } from "@/lib/validation";
import { nextEmployeeNo } from "@/lib/employees";
import { writeAudit } from "@/lib/audit";

export const dynamic = "force-dynamic";

async function loadEmployee(companyId: string, id: string) {
  const emp = await prisma.employee.findFirst({ where: { id, companyId } });
  if (!emp) throw new AuthError(404, "not_found");
  return emp;
}

// PATCH /api/employees/:id — edit any employee field. HR Payroll Officer / IT Admin.
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  return handle(async () => {
    const user = await requirePermission("payroll:manage");
    const input = updateEmployeeSchema.parse(await req.json());
    const emp = await loadEmployee(user.companyId, params.id);

    // Guard the unique employee number against clashes.
    if (input.employeeNo && input.employeeNo !== emp.employeeNo) {
      const clash = await prisma.employee.findFirst({
        where: { companyId: user.companyId, employeeNo: input.employeeNo, id: { not: emp.id } },
        select: { id: true },
      });
      if (clash) throw new AuthError(409, "employee_no_exists");
    }

    const canSetPay = user.permissions.has("payroll:compensation");
    const data: Record<string, unknown> = {};
    if (input.employeeNo !== undefined) data.employeeNo = input.employeeNo;

    // Type switch: interns lose their number (shown as "Stagiaire"); converting an
    // intern back to a regular employee assigns a fresh EMP-#### if it has none.
    if (input.employeeType !== undefined && input.employeeType !== emp.employeeType) {
      data.employeeType = input.employeeType;
      if (input.employeeType === "STAGIAIRE") {
        data.employeeNo = null;
      } else if (input.employeeType === "EMPLOYEE" && !emp.employeeNo) {
        data.employeeNo = await nextEmployeeNo(user.companyId);
      }
    }
    if (input.fullName !== undefined) data.fullName = input.fullName;
    if (input.position !== undefined) data.position = input.position || null;
    if (input.cnpsNo !== undefined) data.cnpsNo = input.cnpsNo || null;
    if (input.status !== undefined) data.status = input.status;
    // Compensation & bank details are only writable by authorised roles;
    // if an unauthorised caller sends them, they are ignored (not applied).
    if (canSetPay) {
      if (input.baseSalary !== undefined) data.baseSalary = input.baseSalary;
      if (input.housingAllowance !== undefined) data.housingAllowance = input.housingAllowance;
      if (input.transportAllowance !== undefined) data.transportAllowance = input.transportAllowance;
      if (input.bankAccount !== undefined) data.bankAccount = input.bankAccount || null;
    }

    const updated = await prisma.employee.update({ where: { id: emp.id }, data });
    await writeAudit({
      companyId: user.companyId,
      actorId: user.id,
      action: "EMPLOYEE_UPDATED",
      entityType: "Employee",
      entityId: emp.id,
      before: { employeeNo: emp.employeeNo, fullName: emp.fullName, baseSalary: Number(emp.baseSalary), status: emp.status },
      after: { employeeNo: updated.employeeNo, fullName: updated.fullName, baseSalary: Number(updated.baseSalary), status: updated.status },
    });
    return { id: updated.id, status: updated.status };
  });
}

// DELETE /api/employees/:id — remove an employee. To protect payroll history,
// an employee with payslips is archived (status INACTIVE) instead of hard
// deleted; one with no history is removed outright.
export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  return handle(async () => {
    const user = await requirePermission("payroll:manage");
    const emp = await loadEmployee(user.companyId, params.id);
    const payslips = await prisma.payslip.count({ where: { employeeId: emp.id } });

    if (payslips > 0) {
      await prisma.employee.update({ where: { id: emp.id }, data: { status: "INACTIVE" } });
      await writeAudit({
        companyId: user.companyId,
        actorId: user.id,
        action: "EMPLOYEE_ARCHIVED",
        entityType: "Employee",
        entityId: emp.id,
        before: { employeeNo: emp.employeeNo, fullName: emp.fullName },
        after: { status: "INACTIVE", reason: "has_payroll_history" },
      });
      return { ok: true, archived: true };
    }

    await prisma.employee.delete({ where: { id: emp.id } });
    await writeAudit({
      companyId: user.companyId,
      actorId: user.id,
      action: "EMPLOYEE_DELETED",
      entityType: "Employee",
      entityId: emp.id,
      before: { employeeNo: emp.employeeNo, fullName: emp.fullName },
    });
    return { ok: true, archived: false };
  });
}

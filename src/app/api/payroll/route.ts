import { NextRequest } from "next/server";
import { handle } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { requirePermission, AuthError } from "@/lib/auth";
import { createPayrollRunSchema } from "@/lib/validation";
import { computePayslip } from "@/lib/payroll";
import { writeAudit } from "@/lib/audit";

export const dynamic = "force-dynamic";

// GET /api/payroll — list payroll runs.
export async function GET() {
  return handle(async () => {
    const user = await requirePermission("payroll:read");
    const runs = await prisma.payrollRun.findMany({
      where: { companyId: user.companyId },
      orderBy: { createdAt: "desc" },
      include: { _count: { select: { payslips: true } } },
    });
    return runs.map((r) => ({
      id: r.id,
      period: r.period,
      status: r.status,
      grossTotal: Number(r.grossTotal),
      netTotal: Number(r.netTotal),
      employees: r._count.payslips,
      posted: !!r.postedEntryId,
    }));
  });
}

// POST /api/payroll — create a run and compute a payslip for every active employee.
export async function POST(req: NextRequest) {
  return handle(async () => {
    const user = await requirePermission("payroll:manage");
    const input = createPayrollRunSchema.parse(await req.json());

    const employees = await prisma.employee.findMany({
      where: { companyId: user.companyId, status: "ACTIVE" },
    });
    if (employees.length === 0) throw new AuthError(422, "no_active_employees");

    const run = await prisma.$transaction(async (tx) => {
      const created = await tx.payrollRun.create({
        data: {
          companyId: user.companyId,
          period: input.period,
          periodId: input.periodId || null,
          status: "DRAFT",
          createdById: user.id,
        },
      });

      let grossTotal = 0;
      let netTotal = 0;
      for (const e of employees) {
        const f = computePayslip(
          Number(e.baseSalary),
          Number(e.housingAllowance),
          Number(e.transportAllowance),
        );
        grossTotal += f.gross;
        netTotal += f.net;
        await tx.payslip.create({
          data: {
            companyId: user.companyId,
            runId: created.id,
            employeeId: e.id,
            gross: f.gross,
            cnpsEmployee: f.cnpsEmployee,
            cnpsEmployer: f.cnpsEmployer,
            cfcEmployee: f.cfcEmployee,
            cfcEmployer: f.cfcEmployer,
            fne: f.fne,
            taxableMonthly: f.taxableMonthly,
            irpp: f.irpp,
            cac: f.cac,
            crtv: f.crtv,
            employeeDeductions: f.employeeDeductions,
            employerCharges: f.employerCharges,
            net: f.net,
          },
        });
      }
      return tx.payrollRun.update({
        where: { id: created.id },
        data: { grossTotal, netTotal },
      });
    });

    await writeAudit({
      companyId: user.companyId,
      actorId: user.id,
      action: "PAYROLL_RUN_CREATED",
      entityType: "PayrollRun",
      entityId: run.id,
      after: { period: run.period, employees: employees.length },
    });

    return { id: run.id, employees: employees.length, gross: Number(run.grossTotal) };
  });
}

import { handle } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { requirePermission, AuthError } from "@/lib/auth";

export const dynamic = "force-dynamic";

// GET /api/payroll/:id — run detail with payslips.
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  return handle(async () => {
    const user = await requirePermission("payroll:read");
    const run = await prisma.payrollRun.findFirst({
      where: { id: params.id, companyId: user.companyId },
      include: {
        payslips: { include: { employee: { select: { employeeNo: true, fullName: true } } } },
      },
    });
    if (!run) throw new AuthError(404, "not_found");

    const slips = run.payslips;
    const sum = (k: (p: (typeof slips)[number]) => number) =>
      slips.reduce((s, p) => s + k(p), 0);

    return {
      id: run.id,
      period: run.period,
      status: run.status,
      posted: !!run.postedEntryId,
      totals: {
        gross: sum((p) => Number(p.gross)),
        cnpsEmployee: sum((p) => Number(p.cnpsEmployee)),
        cnpsEmployer: sum((p) => Number(p.cnpsEmployer)),
        irpp: sum((p) => Number(p.irpp)),
        cac: sum((p) => Number(p.cac)),
        crtv: sum((p) => Number(p.crtv)),
        cfcEmployee: sum((p) => Number(p.cfcEmployee)),
        cfcEmployer: sum((p) => Number(p.cfcEmployer)),
        fne: sum((p) => Number(p.fne)),
        employerCharges: sum((p) => Number(p.employerCharges)),
        net: sum((p) => Number(p.net)),
      },
      payslips: run.payslips.map((p) => ({
        employee: `${p.employee.employeeNo} — ${p.employee.fullName}`,
        gross: Number(p.gross),
        cnpsEmployee: Number(p.cnpsEmployee),
        irpp: Number(p.irpp),
        cac: Number(p.cac),
        crtv: Number(p.crtv),
        cfcEmployee: Number(p.cfcEmployee),
        net: Number(p.net),
      })),
    };
  });
}

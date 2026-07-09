import { handle } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { requirePermission, AuthError } from "@/lib/auth";
import { postJournal } from "@/lib/ledger";
import { writeAudit } from "@/lib/audit";

export const dynamic = "force-dynamic";

const round = (n: number) => Math.round(n * 100) / 100;

// POST /api/payroll/:id/post — post the payroll journal:
//   Dr Salaries & wages (641000)            gross
//   Dr Employer social charges (645000)      employerCharges
//   Cr Salaries payable (421000)             net
//   Cr CNPS payable (431000)                 cnpsEmployee + cnpsEmployer
//   Cr Tax payable (447000)                  irpp + cac + crtv + cfcEmployee + cfcEmployer + fne
export async function POST(_req: Request, { params }: { params: { id: string } }) {
  return handle(async () => {
    const user = await requirePermission("payroll:post");

    const posted = await prisma.$transaction(async (tx) => {
      const run = await tx.payrollRun.findFirst({
        where: { id: params.id, companyId: user.companyId },
        include: { payslips: true },
      });
      if (!run) throw new AuthError(404, "not_found");
      if (run.status !== "DRAFT" || run.postedEntryId) throw new AuthError(422, "already_posted");
      if (run.payslips.length === 0) throw new AuthError(422, "empty_run");

      const slips = run.payslips;
      const sum = (k: (p: (typeof slips)[number]) => number) =>
        round(slips.reduce((s, p) => s + k(p), 0));

      const gross = sum((p) => Number(p.gross));
      const net = sum((p) => Number(p.net));
      const cnps = sum((p) => Number(p.cnpsEmployee) + Number(p.cnpsEmployer));
      const employerCharges = sum((p) => Number(p.employerCharges));
      const taxPayable = sum(
        (p) =>
          Number(p.irpp) +
          Number(p.cac) +
          Number(p.crtv) +
          Number(p.cfcEmployee) +
          Number(p.cfcEmployer) +
          Number(p.fne),
      );

      const entry = await postJournal(tx, {
        companyId: user.companyId,
        journalCode: "PAY",
        date: new Date(),
        description: `Payroll — ${run.period}`,
        createdById: user.id,
        lines: [
          { accountCode: "641000", debit: gross, description: "Salaries & wages" },
          { accountCode: "645000", debit: employerCharges, description: "Employer social charges" },
          { accountCode: "421000", credit: net, description: "Net salaries payable" },
          { accountCode: "431000", credit: cnps, description: "CNPS payable" },
          { accountCode: "447000", credit: taxPayable, description: "Taxes & levies payable" },
        ],
      });

      await tx.payrollRun.update({
        where: { id: run.id },
        data: { status: "POSTED", postedEntryId: entry.id },
      });
      return { run, entryNo: entry.entryNo };
    });

    await writeAudit({
      companyId: user.companyId,
      actorId: user.id,
      action: "PAYROLL_POSTED",
      entityType: "PayrollRun",
      entityId: posted.run.id,
      after: { period: posted.run.period, entryNo: posted.entryNo },
    });

    return { ok: true, entryNo: posted.entryNo };
  });
}

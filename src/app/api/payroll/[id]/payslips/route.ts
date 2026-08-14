/*
 * Dentons KMN ERP
 * Copyright (c) 2026 Bouquet Innovation SA. All rights reserved.
 * Proprietary and confidential. Unauthorised copying, distribution, modification,
 * or use of this file, via any medium, is strictly prohibited.
 */
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePermission, AuthError } from "@/lib/auth";
import { writeAudit } from "@/lib/audit";
import { buildPayslipsPdf, buildPayslipsDocx, type PayLang, type PayslipRun } from "@/lib/payslip";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// GET /api/payroll/:id/payslips?format=pdf|docx&lang=en|fr
// Generates one payslip per employee on a Dentons KMN letterhead. Contains
// salary data, so it is restricted to payroll:compensation holders
// (HR, Managing Partner, IT, CFO).
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await requirePermission("payroll:compensation");
    const format = req.nextUrl.searchParams.get("format") === "docx" ? "docx" : "pdf";
    const lang: PayLang = req.nextUrl.searchParams.get("lang") === "fr" ? "fr" : "en";

    const run = await prisma.payrollRun.findFirst({
      where: { id: params.id, companyId: user.companyId },
      include: {
        payslips: {
          include: {
            employee: {
              select: {
                employeeNo: true, employeeType: true, fullName: true, position: true, cnpsNo: true,
                baseSalary: true, housingAllowance: true, transportAllowance: true,
              },
            },
          },
        },
      },
    });
    if (!run) throw new AuthError(404, "not_found");
    if (run.payslips.length === 0) throw new AuthError(422, "no_payslips");

    const data: PayslipRun = {
      company: "Dentons KMN",
      period: run.period,
      items: run.payslips.map((p) => ({
        matricule: p.employee.employeeType === "STAGIAIRE" ? "Stagiaire" : (p.employee.employeeNo ?? "—"),
        name: p.employee.fullName,
        position: p.employee.position,
        cnpsNo: p.employee.cnpsNo,
        baseSalary: Number(p.employee.baseSalary),
        housingAllowance: Number(p.employee.housingAllowance),
        transportAllowance: Number(p.employee.transportAllowance),
        gross: Number(p.gross),
        cnpsEmployee: Number(p.cnpsEmployee),
        cfcEmployee: Number(p.cfcEmployee),
        crtv: Number(p.crtv),
        irpp: Number(p.irpp),
        cac: Number(p.cac),
        totalDeductions: Number(p.employeeDeductions),
        net: Number(p.net),
      })),
    };

    const buf = format === "pdf" ? await buildPayslipsPdf(data, lang) : await buildPayslipsDocx(data, lang);
    const safePeriod = run.period.replace(/[^a-zA-Z0-9]+/g, "-");
    const filename = `Payslips-${safePeriod}-${lang.toUpperCase()}.${format}`;

    await writeAudit({
      companyId: user.companyId,
      actorId: user.id,
      action: "PAYSLIPS_EXPORTED",
      entityType: "PayrollRun",
      entityId: run.id,
      after: { period: run.period, format, lang, count: run.payslips.length },
    });

    return new Response(new Uint8Array(buf), {
      status: 200,
      headers: {
        "Content-Type":
          format === "pdf"
            ? "application/pdf"
            : "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Content-Length": String(buf.length),
      },
    });
  } catch (e) {
    if (e instanceof AuthError) return Response.json({ error: e.message }, { status: e.status });
    return Response.json({ error: (e as { message?: string })?.message ?? "failed" }, { status: 400 });
  }
}

/*
 * Dentons KMN ERP
 * Copyright (c) 2026 Bouquet Innovation SA. All rights reserved.
 * Proprietary and confidential. Unauthorised copying, distribution, modification,
 * or use of this file, via any medium, is strictly prohibited.
 */
import "server-only";
import { prisma } from "./prisma";

// Next employee number for this company: EMP-#### (zero-padded, continues the
// highest existing EMP-n). Interns (STAGIAIRE) never get one.
export async function nextEmployeeNo(companyId: string): Promise<string> {
  const existing = await prisma.employee.findMany({
    where: { companyId, employeeNo: { startsWith: "EMP-" } },
    select: { employeeNo: true },
  });
  const highest = existing.reduce((max, e) => {
    const n = parseInt((e.employeeNo ?? "").slice(4).replace(/\D/g, ""), 10);
    return Number.isFinite(n) && n > max ? n : max;
  }, 0);
  return `EMP-${String(highest + 1).padStart(4, "0")}`;
}

/** How an employee number is shown: interns read "Stagiaire". */
export function displayEmployeeNo(e: { employeeType: string; employeeNo: string | null }): string {
  return e.employeeType === "STAGIAIRE" ? "Stagiaire" : (e.employeeNo ?? "—");
}

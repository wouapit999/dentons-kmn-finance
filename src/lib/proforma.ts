/*
 * Dentons KMN ERP
 * Copyright (c) 2026 Bouquet Innovation SA. All rights reserved.
 * Proprietary and confidential. Unauthorised copying, distribution, modification,
 * or use of this file, via any medium, is strictly prohibited.
 */
// Proforma (pre-bill) helpers: numbering, totals and the workflow state machine.
import "server-only";
import { prisma } from "./prisma";

export const PROFORMA_STATUSES = ["DRAFT", "IN_REVIEW", "APPROVED", "REJECTED", "BILLED"] as const;

// Who may move a proforma where. Editing is allowed in DRAFT and IN_REVIEW only.
export const PROFORMA_TRANSITIONS: Record<string, { to: string; permission: string }[]> = {
  DRAFT: [{ to: "IN_REVIEW", permission: "proforma:manage" }],
  IN_REVIEW: [
    { to: "APPROVED", permission: "proforma:approve" },
    { to: "REJECTED", permission: "proforma:approve" },
  ],
  REJECTED: [{ to: "DRAFT", permission: "proforma:manage" }],
  APPROVED: [{ to: "DRAFT", permission: "proforma:approve" }], // reopen before billing
  BILLED: [],
};

export function isEditable(status: string): boolean {
  return status === "DRAFT" || status === "IN_REVIEW";
}

const r2 = (n: number) => Math.round(n * 100) / 100;

export interface LineLike {
  sourceType: string;
  originalAmount: unknown;
  adjustedAmount: unknown;
  included: boolean;
}

/** Recompute proforma money from its lines. Fees and manual lines are fees. */
export function computeTotals(
  lines: LineLike[],
  vatRate: number,
  whtRate: number,
) {
  let feeSubtotal = 0, disbSubtotal = 0, writeDown = 0;
  for (const l of lines) {
    const original = Number(l.originalAmount);
    const adjusted = Number(l.adjustedAmount);
    if (!l.included) {
      writeDown += original; // fully written off
      continue;
    }
    writeDown += original - adjusted;
    if (l.sourceType === "DISBURSEMENT") disbSubtotal += adjusted;
    else feeSubtotal += adjusted; // TIME + MANUAL
  }
  const subtotal = feeSubtotal + disbSubtotal;
  const vatAmount = subtotal * (vatRate / 100);
  const whtAmount = feeSubtotal * (whtRate / 100);
  return {
    feeSubtotal: r2(feeSubtotal),
    disbSubtotal: r2(disbSubtotal),
    writeDown: r2(writeDown),
    subtotal: r2(subtotal),
    vatAmount: r2(vatAmount),
    whtAmount: r2(whtAmount),
    total: r2(subtotal + vatAmount - whtAmount),
  };
}

/** Next proforma number for the company: PF-YYYY-NNNNN. */
export async function nextProformaNumber(companyId: string): Promise<string> {
  const prefix = `PF-${new Date().getFullYear()}-`;
  const rows = await prisma.proforma.findMany({
    where: { companyId, number: { startsWith: prefix } },
    select: { number: true },
  });
  const highest = rows.reduce((max, p) => {
    const n = parseInt(p.number.slice(prefix.length).replace(/\D/g, ""), 10);
    return Number.isFinite(n) && n > max ? n : max;
  }, 0);
  return `${prefix}${String(highest + 1).padStart(5, "0")}`;
}

/**
 * FX rate of `currency` to the company base currency, using the most recent
 * rate on or before `asOf`. Base currency (or no rate on file) returns 1.
 */
export async function fxRateFor(
  companyId: string,
  currency: string,
  baseCurrency: string,
  asOf: Date = new Date(),
): Promise<number> {
  if (!currency || currency === baseCurrency) return 1;
  const row = await prisma.exchangeRate.findFirst({
    where: { companyId, currency, asOf: { lte: asOf } },
    orderBy: { asOf: "desc" },
  });
  return row ? Number(row.rate) : 1;
}

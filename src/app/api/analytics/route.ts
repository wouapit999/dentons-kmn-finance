/*
 * Dentons KMN ERP
 * Copyright (c) 2026 Bouquet Innovation SA. All rights reserved.
 * Proprietary and confidential. Unauthorised copying, distribution, modification,
 * or use of this file, via any medium, is strictly prohibited.
 */
import { handle } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/auth";

export const dynamic = "force-dynamic";

const r2 = (n: number) => Math.round(n * 100) / 100;

// GET /api/analytics — persona-based financial analytics:
//   firm   - billing, collection, WIP, realization, proforma pipeline,
//            monthly trend, top matters and fee earners
//   me     - the signed-in user's own hours, value and utilisation
export async function GET() {
  return handle(async () => {
    const user = await requirePermission("analytics:read");
    const now = new Date();
    const yearStart = new Date(Date.UTC(now.getUTCFullYear(), 0, 1));
    const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    const trendStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 11, 1));

    const [invoices, receipts, wipTime, wipDisb, proformas, timeYear, myTimeMonth, clients, matters] =
      await Promise.all([
        prisma.invoice.findMany({
          where: { companyId: user.companyId, createdAt: { gte: trendStart } },
          select: { date: true, total: true, amountPaid: true, status: true, dueDate: true, matterId: true },
        }),
        prisma.receipt.findMany({
          where: { companyId: user.companyId, date: { gte: trendStart } },
          select: { date: true, amount: true },
        }),
        prisma.timeEntry.findMany({
          where: { companyId: user.companyId, status: "DRAFT", invoiceId: null, billable: true },
          select: { amount: true, minutes: true, matterId: true, lawyerId: true },
        }),
        prisma.disbursement.aggregate({
          where: { companyId: user.companyId, status: "DRAFT", invoiceId: null, billable: true },
          _sum: { amount: true },
        }),
        prisma.proforma.groupBy({
          by: ["status"],
          where: { companyId: user.companyId },
          _sum: { total: true },
          _count: { _all: true },
        }),
        prisma.timeEntry.findMany({
          where: { companyId: user.companyId, date: { gte: yearStart } },
          select: { minutes: true, billable: true, amount: true, lawyerId: true },
        }),
        prisma.timeEntry.findMany({
          where: { companyId: user.companyId, lawyerId: user.id, date: { gte: monthStart } },
          select: { minutes: true, billable: true, amount: true },
        }),
        prisma.client.count({ where: { companyId: user.companyId, deletedAt: null } }),
        prisma.matter.findMany({
          where: { companyId: user.companyId, status: "OPEN" },
          select: { id: true, code: true, name: true },
        }),
      ]);

    // --- Billing & collection (year) ---
    const yearInvoices = invoices.filter((i) => i.date >= yearStart && i.status !== "DRAFT");
    const billedYear = yearInvoices.reduce((s, i) => s + Number(i.total), 0);
    const collectedYear = receipts.filter((r) => r.date >= yearStart).reduce((s, r) => s + Number(r.amount), 0);
    const outstanding = invoices
      .filter((i) => ["POSTED", "PART_PAID"].includes(i.status))
      .reduce((s, i) => s + (Number(i.total) - Number(i.amountPaid)), 0);
    const overdue = invoices
      .filter((i) => ["POSTED", "PART_PAID"].includes(i.status) && i.dueDate < now)
      .reduce((s, i) => s + (Number(i.total) - Number(i.amountPaid)), 0);

    // --- WIP (work recorded, not yet billed) ---
    const wipFees = wipTime.reduce((s, t) => s + Number(t.amount), 0);
    const wip = wipFees + Number(wipDisb._sum.amount ?? 0);

    // --- Realization & utilisation (year) ---
    const recordedValue = timeYear.reduce((s, t) => s + Number(t.amount), 0);
    const billableMin = timeYear.filter((t) => t.billable).reduce((s, t) => s + t.minutes, 0);
    const totalMin = timeYear.reduce((s, t) => s + t.minutes, 0);

    // --- Monthly trend (12 months): billed vs collected ---
    const months: { month: string; billed: number; collected: number }[] = [];
    for (let i = 11; i >= 0; i--) {
      const mStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
      const mEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i + 1, 1));
      const key = mStart.toISOString().slice(0, 7);
      months.push({
        month: key,
        billed: r2(invoices.filter((x) => x.status !== "DRAFT" && x.date >= mStart && x.date < mEnd).reduce((s, x) => s + Number(x.total), 0)),
        collected: r2(receipts.filter((x) => x.date >= mStart && x.date < mEnd).reduce((s, x) => s + Number(x.amount), 0)),
      });
    }

    // --- Proforma pipeline ---
    const pipeline = Object.fromEntries(
      proformas.map((p) => [p.status, { count: p._count._all, total: r2(Number(p._sum.total ?? 0)) }]),
    );

    // --- Top WIP matters ---
    const matterName = new Map(matters.map((m) => [m.id, `${m.code} — ${m.name}`]));
    const wipByMatter = new Map<string, number>();
    for (const t of wipTime) {
      wipByMatter.set(t.matterId, (wipByMatter.get(t.matterId) ?? 0) + Number(t.amount));
    }
    const topWip = Array.from(wipByMatter.entries())
      .map(([id, amount]) => ({ matter: matterName.get(id) ?? "—", amount: r2(amount) }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 6);

    // --- Fee earner performance (year) ---
    const byLawyer = new Map<string, { minutes: number; value: number }>();
    for (const t of timeYear) {
      const cur = byLawyer.get(t.lawyerId) ?? { minutes: 0, value: 0 };
      cur.minutes += t.minutes;
      cur.value += Number(t.amount);
      byLawyer.set(t.lawyerId, cur);
    }
    const lawyerIds = Array.from(byLawyer.keys());
    const lawyers = lawyerIds.length
      ? await prisma.user.findMany({ where: { id: { in: lawyerIds } }, select: { id: true, fullName: true } })
      : [];
    const lname = new Map(lawyers.map((l) => [l.id, l.fullName]));
    const feeEarners = Array.from(byLawyer.entries())
      .map(([id, v]) => ({
        name: lname.get(id) ?? "—",
        hours: r2(v.minutes / 60),
        value: r2(v.value),
        me: id === user.id,
      }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 8);

    // --- Personal block (this month) ---
    const myMin = myTimeMonth.reduce((s, t) => s + t.minutes, 0);
    const myBillableMin = myTimeMonth.filter((t) => t.billable).reduce((s, t) => s + t.minutes, 0);
    const myValue = myTimeMonth.reduce((s, t) => s + Number(t.amount), 0);

    return {
      firm: {
        billedYear: r2(billedYear),
        collectedYear: r2(collectedYear),
        collectionRatePct: billedYear > 0 ? r2((collectedYear / billedYear) * 100) : 0,
        outstanding: r2(outstanding),
        overdue: r2(overdue),
        wip: r2(wip),
        recordedValueYear: r2(recordedValue),
        realizationPct: recordedValue > 0 ? r2((billedYear / recordedValue) * 100) : 0,
        billableSharePct: totalMin > 0 ? r2((billableMin / totalMin) * 100) : 0,
        openMatters: matters.length,
        clients,
      },
      pipeline,
      months,
      topWip,
      feeEarners,
      me: {
        monthHours: r2(myMin / 60),
        monthBillableHours: r2(myBillableMin / 60),
        monthValue: r2(myValue),
        utilisationPct: r2((myBillableMin / (160 * 60)) * 100),
      },
    };
  });
}

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
import { createProformaSchema } from "@/lib/validation";
import { computeTotals, nextProformaNumber, fxRateFor } from "@/lib/proforma";
import { writeAudit } from "@/lib/audit";

export const dynamic = "force-dynamic";

// GET /api/proformas — list pre-bills with their workflow state.
export async function GET(req: NextRequest) {
  return handle(async () => {
    const user = await requirePermission("proforma:read");
    const status = req.nextUrl.searchParams.get("status");
    const rows = await prisma.proforma.findMany({
      where: { companyId: user.companyId, ...(status ? { status } : {}) },
      orderBy: { createdAt: "desc" },
      take: 300,
      include: {
        client: { select: { name: true } },
        matter: { select: { code: true, name: true } },
        entity: { select: { code: true } },
        _count: { select: { lines: true, comments: true } },
      },
    });
    return rows.map((p) => ({
      id: p.id,
      number: p.number,
      status: p.status,
      client: p.client.name,
      matter: `${p.matter.code} — ${p.matter.name}`,
      entity: p.entity?.code ?? null,
      currency: p.currency,
      feeSubtotal: Number(p.feeSubtotal),
      disbSubtotal: Number(p.disbSubtotal),
      writeDown: Number(p.writeDown),
      total: Number(p.total),
      lines: p._count.lines,
      comments: p._count.comments,
      invoiceId: p.invoiceId,
      createdAt: p.createdAt,
    }));
  });
}

// POST /api/proformas — build a pre-bill from a matter's unbilled time and
// disbursements. Nothing is marked billed until the proforma is converted.
export async function POST(req: NextRequest) {
  return handle(async () => {
    const user = await requirePermission("proforma:manage");
    const input = createProformaSchema.parse(await req.json());

    const matter = await prisma.matter.findFirst({
      where: { id: input.matterId, companyId: user.companyId },
      select: { id: true, clientId: true, currency: true, entityId: true, status: true },
    });
    if (!matter) throw new AuthError(422, "invalid_matter");

    const from = input.periodFrom ? new Date(input.periodFrom) : undefined;
    const to = input.periodTo ? new Date(input.periodTo) : undefined;
    const dateFilter = from || to ? { date: { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) } } : {};

    const [time, disb] = await Promise.all([
      prisma.timeEntry.findMany({
        where: {
          companyId: user.companyId, matterId: matter.id,
          status: "DRAFT", invoiceId: null, billable: true, ...dateFilter,
        },
        include: { lawyer: { select: { fullName: true } } },
        orderBy: { date: "asc" },
      }),
      prisma.disbursement.findMany({
        where: {
          companyId: user.companyId, matterId: matter.id,
          status: "DRAFT", invoiceId: null, billable: true, ...dateFilter,
        },
        orderBy: { date: "asc" },
      }),
    ]);
    if (time.length === 0 && disb.length === 0) throw new AuthError(422, "nothing_unbilled");

    const company = await prisma.company.findUnique({
      where: { id: user.companyId }, select: { baseCurrency: true },
    });
    const currency = input.currency || matter.currency;
    const fxRate = await fxRateFor(user.companyId, currency, company?.baseCurrency ?? "XAF");

    const lineData = [
      ...time.map((t) => ({
        sourceType: "TIME",
        sourceId: t.id,
        description: `${t.date.toISOString().slice(0, 10)} · ${t.lawyer.fullName} · ${t.narrative ?? "Professional fees"}`,
        originalAmount: Number(t.amount),
        adjustedAmount: Number(t.amount),
        minutes: t.minutes,
        included: true,
      })),
      ...disb.map((d) => ({
        sourceType: "DISBURSEMENT",
        sourceId: d.id,
        description: `${d.date.toISOString().slice(0, 10)} · ${d.description}`,
        originalAmount: Number(d.amount),
        adjustedAmount: Number(d.amount),
        minutes: null,
        included: true,
      })),
    ];
    const totals = computeTotals(lineData, input.vatRate, input.whtRate);
    const number = await nextProformaNumber(user.companyId);

    const created = await prisma.proforma.create({
      data: {
        companyId: user.companyId,
        clientId: matter.clientId,
        matterId: matter.id,
        entityId: matter.entityId,
        number,
        status: "DRAFT",
        currency,
        fxRate,
        periodFrom: from ?? null,
        periodTo: to ?? null,
        vatRate: input.vatRate,
        whtRate: input.whtRate,
        notes: input.notes || null,
        preparedById: user.id,
        feeSubtotal: totals.feeSubtotal,
        disbSubtotal: totals.disbSubtotal,
        writeDown: totals.writeDown,
        subtotal: totals.subtotal,
        total: totals.total,
        lines: { create: lineData },
      },
    });

    await writeAudit({
      companyId: user.companyId,
      actorId: user.id,
      action: "PROFORMA_CREATED",
      entityType: "Proforma",
      entityId: created.id,
      after: { number, matterId: matter.id, lines: lineData.length, total: totals.total },
    });
    return { id: created.id, number, lines: lineData.length, total: totals.total };
  });
}

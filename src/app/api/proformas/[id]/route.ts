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
import { updateProformaSchema } from "@/lib/validation";
import { computeTotals, isEditable } from "@/lib/proforma";
import { writeAudit } from "@/lib/audit";

export const dynamic = "force-dynamic";

// GET /api/proformas/:id — full pre-bill with lines and the review thread.
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  return handle(async () => {
    const user = await requirePermission("proforma:read");
    const p = await prisma.proforma.findFirst({
      where: { id: params.id, companyId: user.companyId },
      include: {
        client: { select: { name: true } },
        matter: { select: { code: true, name: true } },
        entity: { select: { code: true, name: true } },
        lines: { orderBy: { description: "asc" } },
        comments: { orderBy: { createdAt: "asc" } },
      },
    });
    if (!p) throw new AuthError(404, "not_found");

    // Resolve comment authors in one query.
    const authorIds = Array.from(new Set(p.comments.map((c) => c.authorId)));
    const authors = authorIds.length
      ? await prisma.user.findMany({ where: { id: { in: authorIds } }, select: { id: true, fullName: true } })
      : [];
    const nameById = new Map(authors.map((a) => [a.id, a.fullName]));

    return {
      id: p.id,
      number: p.number,
      status: p.status,
      editable: isEditable(p.status),
      client: p.client.name,
      matter: `${p.matter.code} — ${p.matter.name}`,
      entity: p.entity ? `${p.entity.code} — ${p.entity.name}` : null,
      currency: p.currency,
      fxRate: Number(p.fxRate),
      vatRate: Number(p.vatRate),
      whtRate: Number(p.whtRate),
      notes: p.notes,
      invoiceId: p.invoiceId,
      totals: {
        feeSubtotal: Number(p.feeSubtotal),
        disbSubtotal: Number(p.disbSubtotal),
        writeDown: Number(p.writeDown),
        subtotal: Number(p.subtotal),
        total: Number(p.total),
      },
      lines: p.lines.map((l) => ({
        id: l.id,
        sourceType: l.sourceType,
        description: l.description,
        minutes: l.minutes,
        originalAmount: Number(l.originalAmount),
        adjustedAmount: Number(l.adjustedAmount),
        included: l.included,
      })),
      comments: p.comments.map((c) => ({
        id: c.id,
        author: nameById.get(c.authorId) ?? "—",
        body: c.body,
        createdAt: c.createdAt,
      })),
    };
  });
}

// PATCH /api/proformas/:id — collaborative pre-bill editing: adjust or exclude
// lines (write-downs), change tax rates, add manual lines, set the reviewer.
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  return handle(async () => {
    const user = await requirePermission("proforma:manage");
    const input = updateProformaSchema.parse(await req.json());
    const p = await prisma.proforma.findFirst({
      where: { id: params.id, companyId: user.companyId },
      include: { lines: true },
    });
    if (!p) throw new AuthError(404, "not_found");
    if (!isEditable(p.status)) throw new AuthError(422, "proforma_locked");

    await prisma.$transaction(async (tx) => {
      // Line adjustments (write-downs / exclusions / narrative edits).
      for (const l of input.lines ?? []) {
        const existing = p.lines.find((x) => x.id === l.id);
        if (!existing) continue;
        const data: Record<string, unknown> = {};
        if (l.description !== undefined) data.description = l.description;
        if (l.included !== undefined) data.included = l.included;
        if (l.adjustedAmount !== undefined) {
          // Never allow writing a line UP beyond what was actually recorded.
          data.adjustedAmount = Math.min(l.adjustedAmount, Number(existing.originalAmount));
        }
        if (Object.keys(data).length) await tx.proformaLine.update({ where: { id: l.id }, data });
      }
      // Extra manual lines (e.g. agreed fixed fee, courtesy discount line).
      for (const a of input.addLines ?? []) {
        await tx.proformaLine.create({
          data: {
            proformaId: p.id,
            sourceType: "MANUAL",
            description: a.description,
            originalAmount: a.amount,
            adjustedAmount: a.amount,
            included: true,
          },
        });
      }

      const lines = await tx.proformaLine.findMany({ where: { proformaId: p.id } });
      const vatRate = input.vatRate ?? Number(p.vatRate);
      const whtRate = input.whtRate ?? Number(p.whtRate);
      const totals = computeTotals(lines, vatRate, whtRate);

      await tx.proforma.update({
        where: { id: p.id },
        data: {
          vatRate,
          whtRate,
          currency: input.currency ?? p.currency,
          notes: input.notes !== undefined ? input.notes || null : p.notes,
          reviewerId: input.reviewerId !== undefined ? input.reviewerId || null : p.reviewerId,
          feeSubtotal: totals.feeSubtotal,
          disbSubtotal: totals.disbSubtotal,
          writeDown: totals.writeDown,
          subtotal: totals.subtotal,
          total: totals.total,
        },
      });
    });

    await writeAudit({
      companyId: user.companyId,
      actorId: user.id,
      action: "PROFORMA_EDITED",
      entityType: "Proforma",
      entityId: p.id,
      after: { lines: input.lines?.length ?? 0, added: input.addLines?.length ?? 0 },
    });
    return { ok: true };
  });
}

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
import { writeAudit } from "@/lib/audit";

export const dynamic = "force-dynamic";

const r2 = (n: number) => Math.round(n * 100) / 100;

// POST /api/proformas/:id/convert — turn an APPROVED proforma into a DRAFT
// invoice. Only here do the underlying time entries / disbursements get marked
// BILLED; written-off lines (excluded) are left DRAFT for a future decision.
export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  return handle(async () => {
    const user = await requirePermission("proforma:approve");
    const p = await prisma.proforma.findFirst({
      where: { id: params.id, companyId: user.companyId },
      include: { lines: true, matter: { select: { id: true, clientId: true } } },
    });
    if (!p) throw new AuthError(404, "not_found");
    if (p.status !== "APPROVED") throw new AuthError(422, "proforma_not_approved");
    if (p.invoiceId) throw new AuthError(422, "already_billed");

    const included = p.lines.filter((l) => l.included && Number(l.adjustedAmount) > 0);
    if (!included.length) throw new AuthError(422, "no_included_lines");

    const subtotal = Number(p.subtotal);
    const vatAmount = r2(subtotal * (Number(p.vatRate) / 100));
    const whtAmount = r2(Number(p.feeSubtotal) * (Number(p.whtRate) / 100));
    const total = r2(subtotal + vatAmount - whtAmount);

    const invoice = await prisma.$transaction(async (tx) => {
      // Verify the underlying items are still unbilled (a race with direct
      // invoicing would double-bill otherwise).
      const timeIds = included.filter((l) => l.sourceType === "TIME" && l.sourceId).map((l) => l.sourceId!);
      const disbIds = included.filter((l) => l.sourceType === "DISBURSEMENT" && l.sourceId).map((l) => l.sourceId!);
      if (timeIds.length) {
        const free = await tx.timeEntry.count({
          where: { id: { in: timeIds }, status: "DRAFT", invoiceId: null },
        });
        if (free !== timeIds.length) throw new AuthError(422, "time_entry_unavailable");
      }
      if (disbIds.length) {
        const free = await tx.disbursement.count({
          where: { id: { in: disbIds }, status: "DRAFT", invoiceId: null },
        });
        if (free !== disbIds.length) throw new AuthError(422, "disbursement_unavailable");
      }

      const count = await tx.invoice.count({ where: { companyId: user.companyId } });
      const number = `INV-${new Date().getFullYear()}-${String(count + 1).padStart(5, "0")}`;

      const inv = await tx.invoice.create({
        data: {
          companyId: user.companyId,
          clientId: p.clientId,
          matterId: p.matterId,
          number,
          date: new Date(),
          dueDate: new Date(Date.now() + 30 * 864e5),
          currency: p.currency,
          feeSubtotal: p.feeSubtotal,
          disbSubtotal: p.disbSubtotal,
          subtotal: p.subtotal,
          vatRate: p.vatRate,
          vatAmount,
          whtRate: p.whtRate,
          whtAmount,
          total,
          status: "DRAFT",
          createdById: user.id,
          lines: {
            create: included.map((l) => ({
              sourceType: l.sourceType,
              sourceId: l.sourceId,
              description: l.description,
              quantity: 1,
              unitAmount: Number(l.adjustedAmount),
              amount: Number(l.adjustedAmount),
              taxable: true,
            })),
          },
        },
      });

      if (timeIds.length) {
        await tx.timeEntry.updateMany({
          where: { id: { in: timeIds } },
          data: { status: "BILLED", invoiceId: inv.id },
        });
      }
      if (disbIds.length) {
        await tx.disbursement.updateMany({
          where: { id: { in: disbIds } },
          data: { status: "BILLED", invoiceId: inv.id },
        });
      }
      await tx.proforma.update({
        where: { id: p.id },
        data: { status: "BILLED", invoiceId: inv.id },
      });
      return inv;
    });

    await writeAudit({
      companyId: user.companyId,
      actorId: user.id,
      action: "PROFORMA_CONVERTED",
      entityType: "Proforma",
      entityId: p.id,
      after: { invoiceId: invoice.id, invoiceNumber: invoice.number, total: Number(invoice.total) },
    });
    return { invoiceId: invoice.id, number: invoice.number, total: Number(invoice.total) };
  });
}

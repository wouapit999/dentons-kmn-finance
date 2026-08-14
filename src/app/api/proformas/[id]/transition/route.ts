/*
 * Dentons KMN ERP
 * Copyright (c) 2026 Bouquet Innovation SA. All rights reserved.
 * Proprietary and confidential. Unauthorised copying, distribution, modification,
 * or use of this file, via any medium, is strictly prohibited.
 */
import { NextRequest } from "next/server";
import { handle } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { requireUser, AuthError } from "@/lib/auth";
import { proformaTransitionSchema } from "@/lib/validation";
import { PROFORMA_TRANSITIONS } from "@/lib/proforma";
import { writeAudit } from "@/lib/audit";

export const dynamic = "force-dynamic";

const TARGET: Record<string, string> = {
  submit: "IN_REVIEW",
  approve: "APPROVED",
  reject: "REJECTED",
  reopen: "DRAFT",
};

// POST /api/proformas/:id/transition — move the pre-bill through its workflow.
// Each edge declares the permission it needs (submit = manage, approve/reject
// = approve), so lawyers prepare and billers/partners sign off.
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  return handle(async () => {
    const user = await requireUser();
    const input = proformaTransitionSchema.parse(await req.json());
    const to = TARGET[input.action];

    const p = await prisma.proforma.findFirst({
      where: { id: params.id, companyId: user.companyId },
      select: { id: true, status: true, number: true },
    });
    if (!p) throw new AuthError(404, "not_found");

    const edge = (PROFORMA_TRANSITIONS[p.status] ?? []).find((e) => e.to === to);
    if (!edge) throw new AuthError(422, `illegal_transition:${p.status}->${to}`);
    if (!user.permissions.has(edge.permission)) throw new AuthError(403, "forbidden");

    const updated = await prisma.$transaction(async (tx) => {
      const res = await tx.proforma.update({
        where: { id: p.id },
        data: {
          status: to,
          ...(to === "APPROVED" ? { approvedById: user.id, approvedAt: new Date() } : {}),
          ...(to === "DRAFT" ? { approvedById: null, approvedAt: null } : {}),
        },
      });
      if (input.comment) {
        await tx.proformaComment.create({
          data: { proformaId: p.id, authorId: user.id, body: input.comment },
        });
      }
      return res;
    });

    await writeAudit({
      companyId: user.companyId,
      actorId: user.id,
      action: `PROFORMA_${input.action.toUpperCase()}`,
      entityType: "Proforma",
      entityId: p.id,
      before: { status: p.status },
      after: { status: updated.status, number: p.number },
    });
    return { id: updated.id, status: updated.status };
  });
}

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
import { proformaCommentSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

// POST /api/proformas/:id/comments — the lawyer/biller review thread.
// Anyone who can see the proforma can comment on it.
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  return handle(async () => {
    const user = await requirePermission("proforma:read");
    const { body } = proformaCommentSchema.parse(await req.json());
    const p = await prisma.proforma.findFirst({
      where: { id: params.id, companyId: user.companyId },
      select: { id: true },
    });
    if (!p) throw new AuthError(404, "not_found");
    const c = await prisma.proformaComment.create({
      data: { proformaId: p.id, authorId: user.id, body },
    });
    return { id: c.id };
  });
}

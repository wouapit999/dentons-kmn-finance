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
import { generateTemplateSchema } from "@/lib/validation";
import { formatCourt } from "@/lib/courts";
import { writeAudit } from "@/lib/audit";

export const dynamic = "force-dynamic";

// POST /api/templates/generate — fill a template's {{placeholders}} from the
// chosen client/matter and return the document text; optionally file it on the
// client record (kind CONTRACT, markdown).
export async function POST(req: NextRequest) {
  return handle(async () => {
    const user = await requirePermission("client:manage");
    const input = generateTemplateSchema.parse(await req.json());

    const tpl = await prisma.legalTemplate.findFirst({
      where: { id: input.templateId, companyId: user.companyId },
    });
    if (!tpl) throw new AuthError(404, "not_found");

    const client = input.clientId
      ? await prisma.client.findFirst({ where: { id: input.clientId, companyId: user.companyId, deletedAt: null } })
      : null;
    const matter = input.matterId
      ? await prisma.matter.findFirst({
          where: { id: input.matterId, companyId: user.companyId },
          include: { mainLawyer: { select: { fullName: true } } },
        })
      : null;

    const now = new Date();
    const values: Record<string, string> = {
      date: now.toLocaleDateString(tpl.language === "fr" ? "fr-FR" : "en-GB"),
      year: String(now.getFullYear()),
      "firm.name": "Dentons KMN",
      "user.name": user.fullName,
      "client.name": client?.name ?? "",
      "client.email": client?.email ?? "",
      "client.address": client?.address ?? "",
      "client.taxId": client?.taxId ?? "",
      "matter.code": matter?.code ?? "",
      "matter.name": matter?.name ?? "",
      "matter.nature": matter?.nature ?? "",
      "matter.adversary": matter?.adversary ?? "",
      "matter.court": matter ? formatCourt(matter.courtType, matter.courtLocation, tpl.language as "en" | "fr") : "",
      "matter.lawyer": matter?.mainLawyer?.fullName ?? "",
    };
    for (const [k, v] of Object.entries(input.extra ?? {})) values[`extra.${k}`] = v;

    // Replace {{key}}; unknown keys stay visible so nothing is silently dropped.
    const body = tpl.body.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (m, key: string) =>
      key in values ? values[key] : m,
    );
    const unresolved = Array.from(new Set(Array.from(body.matchAll(/\{\{\s*[\w.]+\s*\}\}/g)).map((m) => m[0])));

    let savedDocId: string | null = null;
    if (input.saveToClientFile && client) {
      const filename = `${tpl.name.replace(/[^\w\- ]+/g, "").trim() || "document"} - ${client.name}.md`;
      const doc = await prisma.clientDocument.create({
        data: {
          companyId: user.companyId,
          clientId: client.id,
          kind: "CONTRACT",
          filename,
          mime: "text/markdown",
          sizeBytes: Buffer.byteLength(body, "utf8"),
          storage: "INTERNAL",
          data: Buffer.from(body, "utf8").toString("base64"),
          ocrText: body.slice(0, 100_000),
          ocrAt: new Date(),
          notes: `Generated from template: ${tpl.name}`,
          uploadedBy: user.id,
        },
      });
      savedDocId = doc.id;
    }

    await writeAudit({
      companyId: user.companyId, actorId: user.id, action: "TEMPLATE_GENERATED",
      entityType: "LegalTemplate", entityId: tpl.id,
      after: { client: client?.name, matter: matter?.code, saved: !!savedDocId },
    });
    return { body, unresolved, savedDocId };
  });
}

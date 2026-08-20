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
import { esignSendSchema } from "@/lib/validation";
import { resolveIntegrations } from "@/lib/settings";
import { sendSignatureRequest, getSignatureStatus } from "@/lib/esign";
import { sendTeamsMessage } from "@/lib/msgraph";
import { writeAudit } from "@/lib/audit";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// GET /api/esign — list signature requests (client:read), refreshing the status
// of any non-final ones from the provider (best-effort).
export async function GET() {
  return handle(async () => {
    const user = await requirePermission("client:read");
    const { esignApiKey } = await resolveIntegrations(user.companyId);
    const rows = await prisma.signatureRequest.findMany({
      where: { companyId: user.companyId },
      orderBy: { sentAt: "desc" },
      take: 100,
    });

    // Refresh pending statuses (max 5 per call to stay fast).
    if (esignApiKey) {
      const pending = rows.filter((r) => r.providerRef && (r.status === "SENT" || r.status === "VIEWED")).slice(0, 5);
      for (const r of pending) {
        try {
          const s = await getSignatureStatus(esignApiKey, r.providerRef!);
          if (s.status !== r.status) {
            await prisma.signatureRequest.update({
              where: { id: r.id },
              data: { status: s.status, detail: s.detail, ...(s.status === "SIGNED" ? { completedAt: new Date() } : {}) },
            });
            r.status = s.status;
          }
        } catch {
          /* keep stored status */
        }
      }
    }

    return {
      configured: !!esignApiKey,
      requests: rows.map((r) => ({
        id: r.id,
        title: r.title,
        signerName: r.signerName,
        signerEmail: r.signerEmail,
        status: r.status,
        provider: r.provider,
        sentAt: r.sentAt,
        completedAt: r.completedAt,
        documentId: r.documentId,
      })),
    };
  });
}

// POST /api/esign — send an internal PDF client document for e-signature.
export async function POST(req: NextRequest) {
  return handle(async () => {
    const user = await requirePermission("client:manage");
    const input = esignSendSchema.parse(await req.json());
    const { esignApiKey, teamsWebhookUrl } = await resolveIntegrations(user.companyId);
    if (!esignApiKey) throw new AuthError(422, "esign_not_configured");

    const doc = await prisma.clientDocument.findFirst({
      where: { id: input.documentId, companyId: user.companyId },
      select: { id: true, clientId: true, filename: true, mime: true, storage: true, data: true },
    });
    if (!doc) throw new AuthError(404, "not_found");
    if (doc.storage !== "INTERNAL" || !doc.data) throw new AuthError(422, "esign_link_doc");
    if (doc.mime !== "application/pdf") throw new AuthError(422, "esign_pdf_only");

    const sent = await sendSignatureRequest(esignApiKey, {
      title: input.subject,
      subject: input.subject,
      message: input.message || undefined,
      signerName: input.signerName,
      signerEmail: input.signerEmail,
      fileBase64: doc.data,
      filename: doc.filename,
    });

    const rec = await prisma.signatureRequest.create({
      data: {
        companyId: user.companyId,
        clientId: doc.clientId,
        documentId: doc.id,
        provider: "DROPBOX_SIGN",
        providerRef: sent.requestId,
        title: input.subject,
        signerName: input.signerName,
        signerEmail: input.signerEmail,
        status: sent.status,
        sentById: user.id,
      },
    });

    await writeAudit({
      companyId: user.companyId, actorId: user.id, action: "ESIGN_SENT",
      entityType: "SignatureRequest", entityId: rec.id,
      after: { document: doc.filename, signer: input.signerEmail },
    });

    // Optional Teams notification (best-effort).
    if (teamsWebhookUrl) {
      await sendTeamsMessage(
        teamsWebhookUrl,
        "Signature request sent",
        `**${doc.filename}** sent to ${input.signerName} (${input.signerEmail}) by ${user.fullName}.`,
      );
    }

    return { id: rec.id, status: rec.status };
  });
}

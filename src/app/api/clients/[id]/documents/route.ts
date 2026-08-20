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
import { clientDocumentSchema, clientDocumentLinkSchema } from "@/lib/validation";
import { writeAudit } from "@/lib/audit";
import { docMetaScan, geminiExtractText } from "@/lib/ai";
import { resolveAiConfig, resolveGeminiConfig } from "@/lib/settings";

export const dynamic = "force-dynamic";

// GET /api/clients/:id/documents — client file listing (read-only roles included).
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  return handle(async () => {
    const user = await requirePermission("client:read");
    const client = await prisma.client.findFirst({
      where: { id: params.id, companyId: user.companyId, deletedAt: null },
      select: { id: true },
    });
    if (!client) throw new AuthError(404, "not_found");

    const docs = await prisma.clientDocument.findMany({
      where: { clientId: client.id },
      orderBy: { createdAt: "desc" },
      select: {
        id: true, kind: true, filename: true, mime: true,
        sizeBytes: true, notes: true, createdAt: true,
        storage: true, url: true, source: true, ocrAt: true,
      },
    });
    return docs;
  });
}

// Metadata scan on upload: always run cheap text heuristics (name mention +
// case-reference codes); use the vision model for PDFs/images when an AI key
// is configured. Failures never block the upload — the scan is best-effort.
async function scanMetadata(
  companyId: string,
  clientName: string,
  filename: string,
  mime: string,
  base64: string,
): Promise<string | null> {
  const findings: string[] = [];
  const refRe = /\b(?:M|CL|INV|RG)-\d{4}-?\d{2,6}\b/gi;

  // Heuristic pass over decodable text (TXT/MD and the XML inside DOCX).
  if (mime.startsWith("text/") || mime.includes("wordprocessingml")) {
    const text = Buffer.from(base64, "base64").toString("utf8");
    const tokens = clientName.toLowerCase().split(/\s+/).filter((w) => w.length >= 3);
    if (tokens.some((tk) => text.toLowerCase().includes(tk))) findings.push("mentions client");
    const refs = Array.from(new Set(text.match(refRe) ?? []));
    if (refs.length) findings.push(`refs: ${refs.slice(0, 5).join(", ")}`);
  }
  const nameHit = filename.toLowerCase().match(refRe);
  if (nameHit) findings.push(`filename ref: ${nameHit[0]}`);

  // AI pass for scanned documents (PDF / images) when configured.
  if (mime === "application/pdf" || mime.startsWith("image/")) {
    const cfg = await resolveAiConfig(companyId);
    if (cfg.apiKey) {
      try {
        const r = await docMetaScan(base64, mime, clientName, cfg);
        if (r.docType) findings.push(`type: ${r.docType}`);
        if (r.mentionsClient) findings.push("mentions client");
        if (r.caseRefs?.length) findings.push(`refs: ${r.caseRefs.slice(0, 5).join(", ")}`);
      } catch {
        findings.push("scan unavailable");
      }
    }
  }
  return findings.length ? `Scan: ${Array.from(new Set(findings)).join(" · ")}` : null;
}

// POST /api/clients/:id/documents — attach a document (lawyers: client:manage).
// Two modes: a real file upload ({...base64}) stored internally, or a LINK
// ({link:{url,source,...}}) pointing at OneDrive / SharePoint / an external DMS.
// Internal PDFs/images are OCR'd (Gemini, best-effort) for full-text search.
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  return handle(async () => {
    const user = await requirePermission("client:manage");
    const raw = await req.json();
    const client = await prisma.client.findFirst({
      where: { id: params.id, companyId: user.companyId, deletedAt: null },
      select: { id: true, name: true },
    });
    if (!client) throw new AuthError(404, "not_found");

    // ---- LINK mode ----
    if (raw && typeof raw === "object" && "link" in raw) {
      const input = clientDocumentLinkSchema.parse((raw as { link: unknown }).link);
      const doc = await prisma.clientDocument.create({
        data: {
          companyId: user.companyId,
          clientId: client.id,
          kind: input.kind,
          filename: input.filename,
          mime: "text/uri-list",
          sizeBytes: 0,
          storage: "LINK",
          url: input.url,
          source: input.source,
          data: null,
          notes: input.notes || null,
          uploadedBy: user.id,
        },
      });
      await writeAudit({
        companyId: user.companyId,
        actorId: user.id,
        action: "CLIENT_DOC_LINKED",
        entityType: "Client",
        entityId: client.id,
        after: { filename: input.filename, source: input.source, url: input.url },
      });
      return { id: doc.id, storage: "LINK" };
    }

    // ---- FILE mode ----
    const input = clientDocumentSchema.parse(raw);
    const sizeBytes = Math.floor(input.base64.length * 0.75);
    if (sizeBytes > 2 * 1024 * 1024) throw new AuthError(422, "file_too_large");

    const scan = await scanMetadata(
      user.companyId, client.name, input.filename, input.mime, input.base64,
    );
    const notes = [input.notes || null, scan].filter(Boolean).join(" — ") || null;

    // OCR for search (PDF/images via Gemini; text files store their own text).
    let ocrText: string | null = null;
    if (input.mime.startsWith("text/")) {
      ocrText = Buffer.from(input.base64, "base64").toString("utf8").slice(0, 100_000);
    } else if (input.mime === "application/pdf" || input.mime.startsWith("image/")) {
      const gem = await resolveGeminiConfig(user.companyId);
      if (gem.apiKey) {
        try {
          ocrText = (await geminiExtractText(input.base64, input.mime, { apiKey: gem.apiKey, model: gem.model })).slice(0, 100_000) || null;
        } catch (e) {
          console.error("doc-ocr: extraction failed -", e instanceof Error ? e.message : e);
        }
      }
    }

    const doc = await prisma.clientDocument.create({
      data: {
        companyId: user.companyId,
        clientId: client.id,
        kind: input.kind,
        filename: input.filename,
        mime: input.mime,
        sizeBytes,
        storage: "INTERNAL",
        data: input.base64,
        ocrText,
        ocrAt: ocrText ? new Date() : null,
        notes,
        uploadedBy: user.id,
      },
    });
    await writeAudit({
      companyId: user.companyId,
      actorId: user.id,
      action: "CLIENT_DOC_ADDED",
      entityType: "Client",
      entityId: client.id,
      after: { kind: input.kind, filename: input.filename, sizeBytes, scan, ocr: !!ocrText },
    });
    return { id: doc.id, scan, ocr: !!ocrText };
  });
}

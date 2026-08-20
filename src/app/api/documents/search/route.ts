/*
 * Dentons KMN ERP
 * Copyright (c) 2026 Bouquet Innovation SA. All rights reserved.
 * Proprietary and confidential. Unauthorised copying, distribution, modification,
 * or use of this file, via any medium, is strictly prohibited.
 */
import { NextRequest } from "next/server";
import { handle } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/auth";
import { geminiExtractText } from "@/lib/ai";
import { resolveGeminiConfig } from "@/lib/settings";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// GET /api/documents/search?q= — full-text search across the client file:
// filename, notes and OCR-extracted text. Company-scoped, client:read.
export async function GET(req: NextRequest) {
  return handle(async () => {
    const user = await requirePermission("client:read");
    const q = (req.nextUrl.searchParams.get("q") ?? "").trim();
    if (q.length < 2) return { results: [], pendingOcr: 0 };

    // Case-insensitive match done in JS so it behaves identically on SQLite
    // (dev) and Postgres (prod); the client-file corpus is small.
    const all = await prisma.clientDocument.findMany({
      where: { companyId: user.companyId },
      orderBy: { createdAt: "desc" },
      take: 500,
      select: {
        id: true, filename: true, kind: true, mime: true, storage: true, url: true,
        source: true, sizeBytes: true, notes: true, createdAt: true, ocrText: true,
        client: { select: { id: true, name: true } },
      },
    });
    const needle = q.toLowerCase();
    const results = all
      .filter(
        (d) =>
          d.filename.toLowerCase().includes(needle) ||
          (d.notes ?? "").toLowerCase().includes(needle) ||
          (d.ocrText ?? "").toLowerCase().includes(needle) ||
          d.client.name.toLowerCase().includes(needle),
      )
      .slice(0, 50);

    // Docs not yet OCR'd (uploaded before OCR existed) — surfaced so the UI can
    // offer an "index now" action.
    const pendingOcr = await prisma.clientDocument.count({
      where: {
        companyId: user.companyId,
        storage: "INTERNAL",
        ocrText: null,
        OR: [{ mime: "application/pdf" }, { mime: { startsWith: "image/" } }],
      },
    });

    return {
      pendingOcr,
      results: results.map((d) => {
        // A short excerpt around the first match in the OCR text.
        let excerpt: string | null = null;
        if (d.ocrText) {
          const i = d.ocrText.toLowerCase().indexOf(q.toLowerCase());
          if (i >= 0) {
            const start = Math.max(0, i - 60);
            excerpt = (start > 0 ? "…" : "") + d.ocrText.slice(start, i + q.length + 90).replace(/\s+/g, " ") + "…";
          }
        }
        return {
          id: d.id,
          filename: d.filename,
          kind: d.kind,
          mime: d.mime,
          storage: d.storage,
          source: d.source,
          sizeBytes: d.sizeBytes,
          notes: d.notes,
          createdAt: d.createdAt,
          client: d.client.name,
          clientId: d.client.id,
          excerpt,
          openUrl: d.storage === "LINK" && d.url ? d.url : `/api/clients/documents/${d.id}`,
        };
      }),
    };
  });
}

// POST /api/documents/search — backfill OCR for up to 5 not-yet-indexed
// internal PDFs/images (older uploads). Runs Gemini per document; call
// repeatedly until pendingOcr reaches 0.
export async function POST() {
  return handle(async () => {
    const user = await requirePermission("client:manage");
    const gem = await resolveGeminiConfig(user.companyId);
    if (!gem.apiKey) return { indexed: 0, remaining: 0, reason: "gemini_not_configured" };

    const docs = await prisma.clientDocument.findMany({
      where: {
        companyId: user.companyId,
        storage: "INTERNAL",
        ocrText: null,
        OR: [{ mime: "application/pdf" }, { mime: { startsWith: "image/" } }],
      },
      orderBy: { createdAt: "desc" },
      take: 5,
      select: { id: true, mime: true, data: true },
    });

    let indexed = 0;
    for (const d of docs) {
      if (!d.data) continue;
      try {
        const text = (await geminiExtractText(d.data, d.mime, { apiKey: gem.apiKey, model: gem.model })).slice(0, 100_000);
        await prisma.clientDocument.update({
          where: { id: d.id },
          data: { ocrText: text || "(no text found)", ocrAt: new Date() },
        });
        indexed++;
      } catch (e) {
        console.error("doc-ocr backfill failed -", e instanceof Error ? e.message : e);
      }
    }
    const remaining = await prisma.clientDocument.count({
      where: {
        companyId: user.companyId,
        storage: "INTERNAL",
        ocrText: null,
        OR: [{ mime: "application/pdf" }, { mime: { startsWith: "image/" } }],
      },
    });
    return { indexed, remaining };
  });
}

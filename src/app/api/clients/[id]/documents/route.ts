import { NextRequest } from "next/server";
import { handle } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { requirePermission, AuthError } from "@/lib/auth";
import { clientDocumentSchema } from "@/lib/validation";
import { writeAudit } from "@/lib/audit";
import { docMetaScan } from "@/lib/ai";
import { resolveAiConfig } from "@/lib/settings";

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

// POST /api/clients/:id/documents — upload a scan/reference (lawyers: client:manage).
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  return handle(async () => {
    const user = await requirePermission("client:manage");
    const input = clientDocumentSchema.parse(await req.json());
    const client = await prisma.client.findFirst({
      where: { id: params.id, companyId: user.companyId, deletedAt: null },
      select: { id: true, name: true },
    });
    if (!client) throw new AuthError(404, "not_found");

    const sizeBytes = Math.floor(input.base64.length * 0.75);
    if (sizeBytes > 2 * 1024 * 1024) throw new AuthError(422, "file_too_large");

    const scan = await scanMetadata(
      user.companyId, client.name, input.filename, input.mime, input.base64,
    );
    const notes = [input.notes || null, scan].filter(Boolean).join(" — ") || null;

    const doc = await prisma.clientDocument.create({
      data: {
        companyId: user.companyId,
        clientId: client.id,
        kind: input.kind,
        filename: input.filename,
        mime: input.mime,
        sizeBytes,
        data: input.base64,
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
      after: { kind: input.kind, filename: input.filename, sizeBytes, scan },
    });
    return { id: doc.id, scan };
  });
}

import { NextRequest } from "next/server";
import { handle } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { requirePermission, AuthError } from "@/lib/auth";
import { clientDocumentSchema } from "@/lib/validation";
import { writeAudit } from "@/lib/audit";

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

    const doc = await prisma.clientDocument.create({
      data: {
        companyId: user.companyId,
        clientId: client.id,
        kind: input.kind,
        filename: input.filename,
        mime: input.mime,
        sizeBytes,
        data: input.base64,
        notes: input.notes || null,
        uploadedBy: user.id,
      },
    });
    await writeAudit({
      companyId: user.companyId,
      actorId: user.id,
      action: "CLIENT_DOC_ADDED",
      entityType: "Client",
      entityId: client.id,
      after: { kind: input.kind, filename: input.filename, sizeBytes },
    });
    return { id: doc.id };
  });
}

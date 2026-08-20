/*
 * Dentons KMN ERP
 * Copyright (c) 2026 Bouquet Innovation SA. All rights reserved.
 * Proprietary and confidential. Unauthorised copying, distribution, modification,
 * or use of this file, via any medium, is strictly prohibited.
 */
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePermission, AuthError } from "@/lib/auth";

export const dynamic = "force-dynamic";

// GET /api/clients/documents/:docId — download a client-file document (client:read).
export async function GET(_req: NextRequest, { params }: { params: { docId: string } }) {
  try {
    const user = await requirePermission("client:read");
    const doc = await prisma.clientDocument.findFirst({
      where: { id: params.docId, companyId: user.companyId },
    });
    if (!doc) throw new AuthError(404, "not_found");
    // LINK documents live on OneDrive/SharePoint/DMS — send the caller there.
    if (doc.storage === "LINK" && doc.url) {
      return NextResponse.redirect(doc.url, 302);
    }
    if (!doc.data) throw new AuthError(404, "no_content");
    return new NextResponse(Buffer.from(doc.data, "base64"), {
      headers: {
        "Content-Type": doc.mime,
        "Content-Disposition": `attachment; filename="${doc.filename.replace(/"/g, "")}"`,
      },
    });
  } catch (e) {
    const status = e instanceof AuthError ? e.status : 500;
    return NextResponse.json({ error: "download_failed" }, { status });
  }
}

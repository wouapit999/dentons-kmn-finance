/*
 * Dentons KMN ERP
 * Copyright (c) 2026 Bouquet Innovation SA. All rights reserved.
 * Proprietary and confidential. Unauthorised copying, distribution, modification,
 * or use of this file, via any medium, is strictly prohibited.
 */
import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requirePermission, AuthError } from "@/lib/auth";
import { handle } from "@/lib/api";
import { writeAudit } from "@/lib/audit";
import { buildPdf, buildDocx } from "@/lib/docgen";
import {
  HR_DOC_TYPE_KEYS,
  allowedKeys,
  buildReference,
  docTypeSpec,
  documentFileStem,
  renderHrDocument,
  todayIso,
  validateHrDoc,
  type HrDocInput,
} from "@/lib/hr-docs";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const schema = z.object({
  document_type: z.enum(HR_DOC_TYPE_KEYS as [string, ...string[]]),
  fields: z.record(z.string().max(4000)).default({}),
  action: z.enum(["preview", "issue"]).default("preview"),
  format: z.enum(["pdf", "docx"]).default("pdf"),
});

/** Drop anything the document type does not declare, and trim what is left. */
function sanitise(typeKey: string, fields: Record<string, string>): HrDocInput {
  const allowed = new Set(allowedKeys(typeKey));
  const out: HrDocInput = {};
  for (const [key, value] of Object.entries(fields)) {
    if (allowed.has(key)) out[key] = String(value ?? "").trim();
  }
  return out;
}

/**
 * Allocate the next sequence for the company/type/year and persist the issued
 * document. The unique index is the real guard: two officers issuing at the
 * same instant collide on it rather than sharing a reference number, so the
 * loser simply retries with the next number.
 */
async function issue(params: {
  companyId: string;
  userId: string;
  typeKey: string;
  code: string;
  input: HrDocInput;
  year: number;
}) {
  for (let attempt = 0; attempt < 5; attempt++) {
    const last = await prisma.hrDocument.findFirst({
      where: { companyId: params.companyId, docType: params.typeKey, year: params.year },
      orderBy: { sequence: "desc" },
      select: { sequence: true },
    });
    const sequence = (last?.sequence ?? 0) + 1 + attempt;
    const reference = buildReference(params.code, params.year, sequence);
    const doc = renderHrDocument(params.typeKey, params.input, reference);
    try {
      const row = await prisma.hrDocument.create({
        data: {
          companyId: params.companyId,
          reference,
          docType: params.typeKey,
          year: params.year,
          sequence,
          subjectName: params.input.employee_full_name || params.input.guest_full_name || "",
          purpose: params.input.purpose || params.input.visit_purpose || params.input.mission_purpose || null,
          title: doc.title,
          payload: JSON.stringify(params.input),
          markdown: doc.markdown,
          issuedById: params.userId,
        },
      });
      return { row, doc };
    } catch (e) {
      const code = (e as { code?: string }).code;
      if (code !== "P2002") throw e;
      // Reference taken between the read and the write — try the next one.
    }
  }
  throw new AuthError(409, "reference_allocation_failed");
}

/**
 * POST /api/hr-documents — validate a submission and either preview the
 * bilingual text or issue it, returning the signed-ready PDF/DOCX.
 *
 * An incomplete submission is answered with 422 and the list of fields still
 * needed, so the officer is asked for them instead of a document going out
 * with a gap in it.
 */
export async function POST(req: NextRequest) {
  try {
    const user = await requirePermission("payroll:read");
    const body = schema.parse(await req.json());
    const spec = docTypeSpec(body.document_type);
    if (!spec) return Response.json({ error: "unknown_document_type" }, { status: 400 });

    const input = sanitise(body.document_type, body.fields);
    if (!input.issue_date) input.issue_date = todayIso();

    const check = validateHrDoc(body.document_type, input);
    if (!check.ok) {
      return Response.json(
        { error: "missing_fields", missing: check.missing, advisories: check.advisories },
        { status: 422 },
      );
    }

    if (body.action === "preview") {
      // Show the reference the document would carry without consuming it.
      const year = Number((input.issue_date || todayIso()).slice(0, 4));
      const last = await prisma.hrDocument.findFirst({
        where: { companyId: user.companyId, docType: body.document_type, year },
        orderBy: { sequence: "desc" },
        select: { sequence: true },
      });
      const provisional = buildReference(spec.code, year, (last?.sequence ?? 0) + 1);
      const doc = renderHrDocument(body.document_type, input, provisional);
      return Response.json({
        reference: provisional,
        provisional: true,
        title: doc.title,
        subtitle: doc.subtitle,
        markdown: doc.markdown,
        footer: doc.footer,
        advisories: check.advisories,
      });
    }

    await requirePermission("payroll:manage");
    const year = Number((input.issue_date || todayIso()).slice(0, 4));
    const { row, doc } = await issue({
      companyId: user.companyId,
      userId: user.id,
      typeKey: body.document_type,
      code: spec.code,
      input,
      year,
    });

    // compact keeps each language to a single sheet.
    const render = {
      title: doc.title,
      subtitle: doc.subtitle,
      markdown: doc.markdown,
      footer: doc.footer,
      compact: true,
    };
    const buf = body.format === "pdf" ? await buildPdf(render) : await buildDocx(render);
    const filename = `${documentFileStem(body.document_type, input, row.reference)}.${body.format}`;

    await writeAudit({
      companyId: user.companyId,
      actorId: user.id,
      action: "HR_DOCUMENT_ISSUED",
      entityType: "HrDocument",
      entityId: row.id,
      after: { reference: row.reference, docType: row.docType, subject: row.subjectName, format: body.format },
    });

    return new Response(new Uint8Array(buf), {
      status: 200,
      headers: {
        "Content-Type":
          body.format === "pdf"
            ? "application/pdf"
            : "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Content-Length": String(buf.length),
        "X-Document-Reference": row.reference,
      },
    });
  } catch (e) {
    if (e instanceof AuthError) return Response.json({ error: e.message }, { status: e.status });
    if (e instanceof z.ZodError) {
      return Response.json({ error: "validation_error", issues: e.flatten() }, { status: 422 });
    }
    console.error(e);
    return Response.json({ error: "document_generation_failed" }, { status: 400 });
  }
}

/**
 * GET /api/hr-documents — the issuance register, or a single lookup by
 * reference (`?reference=DKMN/HR/WA/2026/0001`) when an authority calls to
 * check a document the firm has signed.
 */
export async function GET(req: NextRequest) {
  return handle(async () => {
    const user = await requirePermission("payroll:read");
    const reference = req.nextUrl.searchParams.get("reference")?.trim();

    if (reference) {
      const row = await prisma.hrDocument.findUnique({
        where: { companyId_reference: { companyId: user.companyId, reference } },
      });
      if (!row) return { found: false as const };
      return {
        found: true as const,
        reference: row.reference,
        docType: row.docType,
        title: row.title,
        subjectName: row.subjectName,
        purpose: row.purpose,
        issuedAt: row.issuedAt.toISOString(),
        markdown: row.markdown,
      };
    }

    const rows = await prisma.hrDocument.findMany({
      where: { companyId: user.companyId },
      orderBy: { issuedAt: "desc" },
      take: 50,
    });
    return rows.map((r) => ({
      id: r.id,
      reference: r.reference,
      docType: r.docType,
      title: r.title,
      subjectName: r.subjectName,
      issuedAt: r.issuedAt.toISOString(),
    }));
  });
}

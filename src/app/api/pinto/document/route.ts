import { NextRequest } from "next/server";
import { z } from "zod";
import { requireUser, AuthError } from "@/lib/auth";
import { resolveAiConfig } from "@/lib/settings";
import { generatePintoDocument, pintoConfigured } from "@/lib/pinto";
import { buildPdf, buildDocx } from "@/lib/docgen";
import { writeAudit } from "@/lib/audit";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const schema = z.object({
  instruction: z.string().min(3).max(4000),
  format: z.enum(["pdf", "docx"]),
  title: z.string().max(160).optional(),
});

function safeName(title: string): string {
  return (title.replace(/[^a-zA-Z0-9 _-]/g, "").trim().replace(/\s+/g, "_").slice(0, 60) || "Document");
}

// POST /api/pinto/document — Pinto drafts a document and streams it back as a
// downloadable PDF or DOCX. Available to any authenticated user.
export async function POST(req: NextRequest) {
  try {
    const user = await requireUser();
    const { instruction, format, title } = schema.parse(await req.json());

    const cfg = await resolveAiConfig(user.companyId);
    if (!pintoConfigured(cfg)) {
      return Response.json(
        { error: "AI is not configured. Ask your IT Administrator to add the Anthropic API key under AI Settings." },
        { status: 400 },
      );
    }

    const doc = await generatePintoDocument(cfg, instruction, user);
    if (title) doc.title = title;

    const buf = format === "pdf" ? await buildPdf(doc) : await buildDocx(doc);
    const filename = `${safeName(doc.title)}.${format}`;

    await writeAudit({
      companyId: user.companyId,
      actorId: user.id,
      action: "AI_DOCUMENT",
      entityType: "Document",
      entityId: null,
      after: { title: doc.title, format },
    });

    return new Response(new Uint8Array(buf), {
      status: 200,
      headers: {
        "Content-Type":
          format === "pdf"
            ? "application/pdf"
            : "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Content-Length": String(buf.length),
        "X-Document-Title": encodeURIComponent(doc.title),
      },
    });
  } catch (e) {
    if (e instanceof AuthError) return Response.json({ error: e.message }, { status: e.status });
    const detail = (e as { message?: string })?.message ?? "Document generation failed";
    return Response.json({ error: detail }, { status: 400 });
  }
}

// AI provider integration (Claude API).
//
// Two capabilities:
//   1. Natural-language financial reporting  (nlReport)
//   2. Invoice / receipt OCR extraction       (extractInvoice)
//
// Both are gated on ANTHROPIC_API_KEY. When it is not set the callers surface a
// friendly "not configured" message instead of failing hard, so the rest of the
// app runs fine without an AI key.
import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { AuthError } from "./auth";

const MODEL = process.env.AI_MODEL ?? "claude-sonnet-5";

export function aiConfigured(): boolean {
  return !!process.env.ANTHROPIC_API_KEY;
}

function client(): Anthropic {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new AuthError(503, "ai_not_configured");
  return new Anthropic({ apiKey });
}

function firstText(msg: Anthropic.Messages.Message): string {
  const block = msg.content.find((b) => b.type === "text");
  return block && block.type === "text" ? block.text : "";
}

/**
 * Natural-language reporting: answer a finance question grounded in a JSON
 * snapshot of the company's figures. The snapshot is built server-side so the
 * model only ever sees this tenant's data.
 */
export async function nlReport(question: string, context: unknown, locale: string): Promise<string> {
  const c = client();
  const system =
    "You are the finance analyst for Dentons KMN, a law firm in Cameroon. " +
    "Answer ONLY from the JSON financial context provided. Amounts are in XAF unless stated. " +
    "Be concise and specific; cite the figures you use. If the answer is not in the context, say so. " +
    `Reply in ${locale === "fr" ? "French" : "English"}.`;

  const msg = await c.messages.create({
    model: MODEL,
    max_tokens: 1024,
    system,
    messages: [
      {
        role: "user",
        content: `Financial context (JSON):\n${JSON.stringify(context)}\n\nQuestion: ${question}`,
      },
    ],
  });
  return firstText(msg);
}

export interface ExtractedInvoice {
  supplierName: string | null;
  invoiceNumber: string | null;
  date: string | null;
  amountExclVat: number | null;
  vatAmount: number | null;
  total: number | null;
  currency: string | null;
  description: string | null;
}

/**
 * OCR/extraction: pull structured fields from an invoice or receipt image/PDF
 * so the AP bill form can be pre-filled. Accepts a base64 payload + mime type.
 */
export async function extractInvoice(base64: string, mime: string): Promise<ExtractedInvoice> {
  const c = client();
  const isPdf = mime === "application/pdf";

  const doc: Anthropic.Messages.ContentBlockParam = isPdf
    ? { type: "document", source: { type: "base64", media_type: "application/pdf", data: base64 } }
    : {
        type: "image",
        source: {
          type: "base64",
          media_type: (["image/png", "image/jpeg", "image/webp", "image/gif"].includes(mime)
            ? mime
            : "image/png") as "image/png" | "image/jpeg" | "image/webp" | "image/gif",
          data: base64,
        },
      };

  const msg = await c.messages.create({
    model: MODEL,
    max_tokens: 512,
    system:
      "Extract vendor invoice fields. Return ONLY a JSON object with keys: " +
      "supplierName, invoiceNumber, date (YYYY-MM-DD), amountExclVat (number), " +
      "vatAmount (number), total (number), currency (ISO code), description. " +
      "Use null for anything not present. No prose, no code fences.",
    messages: [
      { role: "user", content: [doc, { type: "text", text: "Extract the invoice fields as JSON." }] },
    ],
  });

  const text = firstText(msg).trim();
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1) throw new AuthError(422, "extraction_failed");
  try {
    return JSON.parse(text.slice(start, end + 1)) as ExtractedInvoice;
  } catch {
    throw new AuthError(422, "extraction_failed");
  }
}

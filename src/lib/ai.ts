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

// Key/model are resolved per company (in-app setting first, env fallback) via
// resolveAiConfig() in settings.ts and passed in by the API routes.
export interface AiConfig {
  apiKey: string | null;
  model: string;
}

export function aiConfigured(cfg?: AiConfig): boolean {
  if (cfg) return !!cfg.apiKey;
  return !!process.env.ANTHROPIC_API_KEY;
}

function client(cfg: AiConfig): Anthropic {
  if (!cfg.apiKey) throw new AuthError(503, "ai_not_configured");
  return new Anthropic({ apiKey: cfg.apiKey });
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
export async function nlReport(
  question: string,
  context: unknown,
  locale: string,
  cfg: AiConfig,
): Promise<string> {
  const c = client(cfg);
  const system =
    "You are the finance analyst for Dentons KMN, a law firm in Cameroon. " +
    "Answer ONLY from the JSON financial context provided. Amounts are in XAF unless stated. " +
    "Be concise and specific; cite the figures you use. If the answer is not in the context, say so. " +
    `Reply in ${locale === "fr" ? "French" : "English"}.`;

  const msg = await c.messages.create({
    model: cfg.model,
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

/**
 * KYC/AML internet screening via Claude's web-search tool: sanctions and
 * adverse-media mentions, business registrations, litigation footprint.
 * Returns a markdown report ending with a parseable "RISK_LEVEL:" line.
 */
export async function kycScreen(
  subject: { name: string; type: string; taxId?: string | null; email?: string | null; country: string },
  cfg: AiConfig,
): Promise<{ report: string; riskLevel: "LOW" | "MEDIUM" | "HIGH" }> {
  const c = client(cfg);
  const msg = await c.messages.create({
    model: cfg.model,
    max_tokens: 2500,
    // Server-side web search tool — the model searches the public internet.
    tools: [{ type: "web_search_20250305", name: "web_search", max_uses: 6 } as never],
    system:
      "You are a KYC/AML due-diligence analyst for Dentons KMN, a law firm in Cameroon. " +
      "Screen the subject using web search: (1) identity & business registrations, " +
      "(2) sanctions lists / PEP indications, (3) adverse media (fraud, corruption, money laundering, litigation), " +
      "(4) overall reputation. Write a concise markdown report with sections: Identity, " +
      "Sanctions & PEP, Adverse Media, Business Footprint, Sources (URLs), Risk Assessment. " +
      "Be factual; if nothing is found, say so — absence of findings is a valid result. " +
      "END the report with exactly one line: RISK_LEVEL: LOW or RISK_LEVEL: MEDIUM or RISK_LEVEL: HIGH.",
    messages: [
      {
        role: "user",
        content:
          `Screen this prospective client:\n` +
          `Name: ${subject.name}\nType: ${subject.type}\nCountry: ${subject.country}` +
          (subject.taxId ? `\nTax ID: ${subject.taxId}` : "") +
          (subject.email ? `\nEmail domain: ${subject.email.split("@")[1] ?? ""}` : ""),
      },
    ],
  });

  const report = msg.content
    .filter((b): b is Anthropic.Messages.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("\n")
    .trim();
  const m = report.match(/RISK_LEVEL:\s*(LOW|MEDIUM|HIGH)/i);
  const riskLevel = (m ? m[1].toUpperCase() : "MEDIUM") as "LOW" | "MEDIUM" | "HIGH";
  return { report, riskLevel };
}

/**
 * Lightweight document metadata scan for client intake: does the document
 * mention the client's name, and which matter/case references appear?
 * Uses the vision model for PDFs/images; the caller falls back to text
 * heuristics when no AI key is configured.
 */
export async function docMetaScan(
  base64: string,
  mime: string,
  clientName: string,
  cfg: AiConfig,
): Promise<{ mentionsClient: boolean; caseRefs: string[]; docType: string | null }> {
  const c = client(cfg);
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
    model: cfg.model,
    max_tokens: 300,
    system:
      "Scan the document. Return ONLY JSON with keys: mentionsClient (boolean — does the " +
      `document mention "${clientName}" or an obvious variant), caseRefs (array of case/matter ` +
      "reference codes found, e.g. M-2026-001, RG numbers), docType (short label like " +
      "'national ID', 'contract', 'invoice', 'court filing', or null). No prose.",
    messages: [{ role: "user", content: [doc, { type: "text", text: "Scan for metadata." }] }],
  });
  const text = firstText(msg).trim();
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1) throw new AuthError(422, "scan_failed");
  return JSON.parse(text.slice(start, end + 1));
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
export async function extractInvoice(
  base64: string,
  mime: string,
  cfg: AiConfig,
): Promise<ExtractedInvoice> {
  const c = client(cfg);
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
    model: cfg.model,
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

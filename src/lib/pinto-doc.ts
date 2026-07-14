// Document drafting for Pinto, in its own module so both the chat agentic loop
// (pinto-tools) and the download route can use it without an import cycle.
import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import type { AiConfig } from "./ai";
import { AuthError, type CurrentUser } from "./auth";

export interface PintoDocument {
  title: string;
  subtitle?: string;
  markdown: string;
}

// Split a Markdown string into a title (first H1) and body.
export function splitTitle(md: string, fallback = "Document"): { title: string; body: string } {
  const lines = md.split("\n");
  const idx = lines.findIndex((l) => /^#\s+/.test(l.trim()));
  if (idx !== -1) {
    const title = lines[idx].replace(/^#\s+/, "").trim() || fallback;
    return { title, body: lines.slice(idx + 1).join("\n").trim() };
  }
  return { title: fallback, body: md };
}

// Draft a complete downloadable document (legal memo, jurisprudence note,
// contract, letter, research write-up) from a free-text instruction. Uses web
// search so legal content (articles, case citations) can be verified.
export async function generatePintoDocument(
  cfg: AiConfig,
  instruction: string,
  user: CurrentUser,
): Promise<PintoDocument> {
  if (!cfg.apiKey) throw new AuthError(503, "pinto_not_configured");
  const client = new Anthropic({ apiKey: cfg.apiKey });
  const lang = user.locale === "fr" ? "French" : "English";

  const system =
    "You are Pinto, drafting a formal, ready-to-use document for Dentons KMN, a law firm in Cameroon. " +
    "Produce a COMPLETE, well-structured document in Markdown answering the user's request. " +
    "Begin with a single '# Title' line (a real title, not the word 'Title'), then the document body using ##/### headings, short paragraphs and '- ' bullet points. " +
    "For legal documents (jurisprudence notes, case summaries, memoranda, contracts, clauses, opinions) be accurate and cite the governing texts (OHADA Uniform Acts and CCJA case law, CEMAC/COBAC/CIMA/OAPI, Cameroon codes incl. the Penal Code and Criminal Procedure Code, articles where known); use web search to verify articles and citations before stating them. " +
    "Where a fact must be supplied by the firm (client name, dates, amounts), insert a clear placeholder like [CLIENT NAME]. " +
    "Output ONLY the document itself — no preamble, no chat, no 'here is your document'. " +
    `Write the document in ${lang}.`;

  const res = await client.messages.create({
    model: cfg.model,
    max_tokens: 4096,
    system,
    tools: [{ type: "web_search_20250305", name: "web_search", max_uses: 5 } as unknown as Anthropic.Tool],
    messages: [{ role: "user", content: instruction }],
  });

  const md = res.content
    .filter((b): b is Anthropic.Messages.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("\n")
    .trim();

  const { title, body } = splitTitle(md, (instruction.slice(0, 60) || "Document").trim());
  const generated = new Date().toISOString().slice(0, 10);
  return { title, subtitle: `Dentons KMN — generated ${generated}`, markdown: body };
}

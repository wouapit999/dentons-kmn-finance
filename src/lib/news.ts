/*
 * Dentons KMN ERP
 * Copyright (c) 2026 Bouquet Innovation SA. All rights reserved.
 * Proprietary and confidential. Unauthorised copying, distribution, modification,
 * or use of this file, via any medium, is strictly prohibited.
 */
// Firm-news fetcher. Uses Claude's server-side web search to gather recent,
// real, sourced Dentons news / awards / wins and return them bilingually
// (EN + FR). Results are cached (see /api/news) so this runs at most ~daily.
import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import type { AiConfig } from "./ai";

export interface NewsItem {
  title: string;
  summary: string;
  url: string | null;
  date: string | null;
}
export interface NewsCache {
  generatedAt: string;
  en: NewsItem[];
  fr: NewsItem[];
}

function firstJson(text: string): any | null {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) return null;
  try {
    return JSON.parse(text.slice(start, end + 1));
  } catch {
    return null;
  }
}

export async function fetchDentonsNews(cfg: AiConfig): Promise<NewsCache | null> {
  if (!cfg.apiKey) return null;
  const client = new Anthropic({ apiKey: cfg.apiKey });

  const res = await client.messages.create({
    model: cfg.model,
    max_tokens: 2500,
    tools: [{ type: "web_search_20250305", name: "web_search", max_uses: 5 } as unknown as Anthropic.Tool],
    system:
      "You are a research assistant compiling a short news ticker for a law firm's internal app. " +
      "Search the web for the most RECENT and NOTABLE news about the global law firm Dentons - press releases, awards, rankings, major deals, appointments and notable wins - and, where available, Dentons in Africa / Cameroon (Dentons is associated with regional firms). " +
      "Only include items you actually found via web search and can attribute to a real source URL. Do NOT invent, guess, or pad. Prefer items from the last 12 months. Return 6 to 8 items. " +
      "Provide each item in BOTH English and French. Respond with ONLY a JSON object, no prose, of the exact shape: " +
      '{"items":[{"title_en":"","title_fr":"","summary_en":"","summary_fr":"","url":"","date":"YYYY-MM"}]}',
    messages: [
      { role: "user", content: "Compile the latest Dentons news and wins as bilingual ticker items. JSON only." },
    ],
  });

  const text = res.content
    .filter((b): b is Anthropic.Messages.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("\n");
  const parsed = firstJson(text);
  const items: any[] = Array.isArray(parsed?.items) ? parsed.items : [];
  if (!items.length) return null;

  const en: NewsItem[] = [];
  const fr: NewsItem[] = [];
  for (const it of items.slice(0, 10)) {
    const url = typeof it.url === "string" && /^https?:\/\//.test(it.url) ? it.url : null;
    const date = typeof it.date === "string" ? it.date.slice(0, 10) : null;
    if (it.title_en) en.push({ title: String(it.title_en), summary: String(it.summary_en ?? ""), url, date });
    if (it.title_fr) fr.push({ title: String(it.title_fr), summary: String(it.summary_fr ?? ""), url, date });
  }
  if (!en.length && !fr.length) return null;
  return { generatedAt: new Date().toISOString(), en, fr };
}

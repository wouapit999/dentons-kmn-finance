"use client";
/*
 * Dentons KMN ERP
 * Copyright (c) 2026 Bouquet Innovation SA. All rights reserved.
 * Proprietary and confidential. Unauthorised copying, distribution, modification,
 * or use of this file, via any medium, is strictly prohibited.
 */
// Scrolling firm-news ticker shown on every page after login. Bilingual: it
// follows the user's selected language. Content comes from /api/news (Claude
// web search, cached daily). Pauses on hover; links open in a new tab.
import { useQuery } from "@tanstack/react-query";
import { useUi } from "@/lib/store";
import { useT } from "@/lib/useT";
import { CameroonFlag } from "@/components/flag";

interface NewsItem { title: string; summary: string; url: string | null; date: string | null }
interface NewsResp { items: NewsItem[]; generatedAt: string | null; configured: boolean }

export function NewsTicker() {
  const { locale } = useUi();
  const t = useT();
  const q = useQuery({
    queryKey: ["news", locale],
    queryFn: async () => (await fetch(`/api/news?lang=${locale}`)).json() as Promise<NewsResp>,
    staleTime: 30 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const items = q.data?.items ?? [];
  const label = t("news.label");

  // Duration scales with item count so long feeds still scroll at a readable pace.
  const duration = Math.max(28, items.length * 7);

  const Row = ({ ariaHidden }: { ariaHidden?: boolean }) => (
    <div className="ticker-track" aria-hidden={ariaHidden}>
      {items.map((it, i) => {
        const text = it.summary ? `${it.title} — ${it.summary}` : it.title;
        const body = (
          <span className="inline-flex items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-cmr-yellow shadow-[0_0_6px_rgba(252,209,22,0.9)]" />
            <span className="text-slate-600 dark:text-slate-300">
              {text}
              {it.date ? <span className="ml-1 text-slate-400">({it.date})</span> : null}
            </span>
          </span>
        );
        return (
          <span key={(ariaHidden ? "b" : "a") + i} className="mx-6 whitespace-nowrap text-xs">
            {it.url ? (
              <a href={it.url} target="_blank" rel="noopener noreferrer" className="hover:text-brand-600 hover:underline">
                {body}
              </a>
            ) : (
              body
            )}
          </span>
        );
      })}
    </div>
  );

  return (
    <div className="ticker-bar flex h-8 items-center gap-3 border-b border-slate-200/60 px-4 text-xs dark:border-slate-800/60">
      <span className="flex shrink-0 items-center gap-1.5 font-semibold uppercase tracking-wide text-brand-700 dark:text-brand-200">
        <CameroonFlag className="flag-wave h-3.5 w-5 rounded-[2px] ring-1 ring-black/5" />
        {label}
      </span>
      <div className="ticker-mask relative flex-1 overflow-hidden">
        {q.isLoading ? (
          <span className="text-slate-400">{t("news.loading")}</span>
        ) : items.length === 0 ? (
          <span className="text-slate-400">{q.data?.configured === false ? t("news.notConfigured") : t("news.empty")}</span>
        ) : (
          <div className="ticker-viewport flex" style={{ ["--dur" as string]: `${duration}s` }}>
            <Row />
            <Row ariaHidden />
          </div>
        )}
      </div>
    </div>
  );
}

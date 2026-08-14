/*
 * Dentons KMN ERP
 * Copyright (c) 2026 Bouquet Innovation SA. All rights reserved.
 * Proprietary and confidential. Unauthorised copying, distribution, modification,
 * or use of this file, via any medium, is strictly prohibited.
 */
import { NextRequest } from "next/server";
import { handle } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { getSetting, setSetting, resolveAiConfig } from "@/lib/settings";
import { fetchDentonsNews, type NewsCache } from "@/lib/news";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const CACHE_KEY = "news.cache";

// Evergreen, factual fallback shown when no live items are available yet (e.g.
// before the AI key is funded). Real links; replaced by live news once fetched.
const FALLBACK: Record<"en" | "fr", { title: string; summary: string; url: string; date: string | null }[]> = {
  en: [
    { title: "Dentons is one of the world's largest global law firms, present in 80+ countries", summary: "", url: "https://www.dentons.com", date: null },
    { title: "Dentons insights, news and thought leadership", summary: "Explore the firm's latest publications", url: "https://www.dentons.com/en/insights", date: null },
    { title: "Dentons in Africa — pan-African legal capability across key markets", summary: "", url: "https://www.dentons.com/en/global-presence", date: null },
  ],
  fr: [
    { title: "Dentons, l'un des plus grands cabinets d'avocats au monde, présent dans plus de 80 pays", summary: "", url: "https://www.dentons.com", date: null },
    { title: "Analyses et actualités de Dentons", summary: "Découvrez les dernières publications du cabinet", url: "https://www.dentons.com/fr", date: null },
    { title: "Dentons en Afrique — une capacité juridique panafricaine sur les marchés clés", summary: "", url: "https://www.dentons.com/en/global-presence", date: null },
  ],
};
const LOCK_KEY = "news.refreshing";
const MAX_AGE_MS = 24 * 60 * 60 * 1000; // refresh at most once per day
const LOCK_MS = 3 * 60 * 1000; // avoid concurrent refresh stampede

// GET /api/news?lang=en|fr — bilingual Dentons news/wins ticker feed.
// Any authenticated user. Cached ~daily; refreshed via Claude web search.
export async function GET(req: NextRequest) {
  return handle(async () => {
    const user = await requireUser();
    const lang = req.nextUrl.searchParams.get("lang") === "fr" ? "fr" : "en";

    const raw = await getSetting(user.companyId, CACHE_KEY);
    let cache: NewsCache | null = raw ? (JSON.parse(raw) as NewsCache) : null;
    const age = cache ? Date.now() - Date.parse(cache.generatedAt) : Infinity;
    const fresh = cache && age < MAX_AGE_MS && (cache[lang]?.length ?? 0) > 0;

    if (!fresh) {
      const cfg = await resolveAiConfig(user.companyId);
      if (!cfg.apiKey) {
        // Not configured: serve any stale cache, else the evergreen fallback.
        const stale = cache?.[lang] ?? [];
        return {
          items: stale.length ? stale : FALLBACK[lang],
          generatedAt: cache?.generatedAt ?? null,
          configured: false,
          live: stale.length > 0,
        };
      }
      // Stampede guard: skip refresh if another request started one recently.
      const lock = await getSetting(user.companyId, LOCK_KEY);
      const locked = lock && Date.now() - Date.parse(lock) < LOCK_MS;
      if (!locked) {
        await setSetting(user.companyId, LOCK_KEY, new Date().toISOString());
        try {
          const fetched = await fetchDentonsNews(cfg);
          if (fetched) {
            cache = fetched;
            await setSetting(user.companyId, CACHE_KEY, JSON.stringify(fetched));
          }
        } catch {
          // keep whatever cache we had
        }
      }
    }

    const items = cache?.[lang] ?? [];
    return {
      items: items.length ? items : FALLBACK[lang],
      generatedAt: cache?.generatedAt ?? null,
      configured: true,
      live: items.length > 0,
    };
  });
}

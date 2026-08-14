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
        // Not configured: serve any stale cache, else signal not-configured.
        return { items: cache?.[lang] ?? [], generatedAt: cache?.generatedAt ?? null, configured: false };
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

    return {
      items: cache?.[lang] ?? [],
      generatedAt: cache?.generatedAt ?? null,
      configured: true,
    };
  });
}

"use client";
/*
 * Dentons KMN ERP
 * Copyright (c) 2026 Bouquet Innovation SA. All rights reserved.
 * Proprietary and confidential. Unauthorised copying, distribution, modification,
 * or use of this file, via any medium, is strictly prohibited.
 */
import { useState } from "react";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button, Input, Card, Badge } from "@/components/ui";
import { useT } from "@/lib/useT";
import { usePerms } from "@/lib/usePerms";

interface Result {
  id: string;
  filename: string;
  kind: string;
  mime: string;
  storage: string;
  source: string | null;
  sizeBytes: number;
  notes: string | null;
  createdAt: string;
  client: string;
  clientId: string;
  excerpt: string | null;
  openUrl: string;
}
interface SearchResponse { results: Result[]; pendingOcr: number }

export default function DocumentsPage() {
  const t = useT();
  const { can } = usePerms();
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [query, setQuery] = useState("");

  const search = useQuery({
    queryKey: ["doc-search", query],
    enabled: query.length >= 2,
    queryFn: async () => {
      const res = await fetch(`/api/documents/search?q=${encodeURIComponent(query)}`);
      if (!res.ok) throw new Error("failed");
      return (await res.json()) as SearchResponse;
    },
  });

  const index = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/documents/search", { method: "POST" });
      if (!res.ok) throw new Error("failed");
      return (await res.json()) as { indexed: number; remaining: number; reason?: string };
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["doc-search", query] }),
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">{t("docs.title")}</h1>
        <p className="text-sm text-slate-500">{t("docs.subtitle")}</p>
      </div>

      <div className="flex gap-2">
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={t("docs.placeholder")}
          onKeyDown={(e) => { if (e.key === "Enter" && q.trim().length >= 2) setQuery(q.trim()); }}
        />
        <Button disabled={q.trim().length < 2} onClick={() => setQuery(q.trim())}>{t("common.search")}</Button>
      </div>

      {search.data && search.data.pendingOcr > 0 && can("client:manage") && (
        <div className="flex items-center justify-between rounded-lg border border-amber-300 bg-amber-50 px-4 py-2 text-sm dark:border-amber-800 dark:bg-amber-950/20">
          <span>{t("docs.pendingOcr")} {search.data.pendingOcr}</span>
          <Button size="sm" variant="outline" disabled={index.isPending} onClick={() => index.mutate()}>
            {index.isPending ? t("docs.indexing") : t("docs.indexNow")}
          </Button>
        </div>
      )}

      {query.length >= 2 && (
        <Card className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500 dark:bg-slate-800/50">
              <tr>
                <th className="px-4 py-3">{t("docs.file")}</th>
                <th className="px-4 py-3">{t("docs.client")}</th>
                <th className="px-4 py-3">{t("docs.match")}</th>
                <th className="px-4 py-3 text-right">{t("common.actions")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {search.isLoading && <tr><td colSpan={4} className="px-4 py-6 text-center text-slate-400">{t("common.loading")}</td></tr>}
              {search.data?.results.length === 0 && <tr><td colSpan={4} className="px-4 py-8 text-center text-slate-400">{t("docs.noResults")}</td></tr>}
              {search.data?.results.map((r) => (
                <tr key={r.id}>
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{r.filename}</span>
                      {r.storage === "LINK" && <Badge color="amber">{r.source ?? "LINK"}</Badge>}
                      <Badge color={r.kind.endsWith("_REPORT") ? "brand" : "slate"}>{r.kind}</Badge>
                    </div>
                  </td>
                  <td className="px-4 py-2.5">
                    <Link href={`/clients/${r.clientId}`} className="text-brand-700 hover:underline dark:text-brand-300">{r.client}</Link>
                  </td>
                  <td className="max-w-md px-4 py-2.5 text-xs text-slate-500">{r.excerpt ?? r.notes ?? "—"}</td>
                  <td className="px-4 py-2.5 text-right">
                    <a href={r.openUrl} target={r.storage === "LINK" ? "_blank" : undefined} rel="noopener noreferrer">
                      <Button size="sm" variant="outline">{t("docs.open")}</Button>
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}

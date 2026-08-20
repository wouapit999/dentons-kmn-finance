"use client";
/*
 * Dentons KMN ERP
 * Copyright (c) 2026 Bouquet Innovation SA. All rights reserved.
 * Proprietary and confidential. Unauthorised copying, distribution, modification,
 * or use of this file, via any medium, is strictly prohibited.
 */
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button, Input, Card, Badge } from "@/components/ui";
import { useT } from "@/lib/useT";

interface Integrations {
  m365: { configured: boolean; tenantId: string; clientId: string; secretMasked: string | null; sharepointHost: string; sharepointSite: string };
  teams: { configured: boolean };
  esign: { configured: boolean; keyMasked: string | null };
}

export default function IntegrationsPage() {
  const t = useT();
  const qc = useQueryClient();
  const [f, setF] = useState<Record<string, string>>({});
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<string | null>(null);

  const q = useQuery({
    queryKey: ["integrations"],
    retry: false,
    queryFn: async () => {
      const res = await fetch("/api/settings/integrations");
      if (res.status === 401 || res.status === 403) return null;
      if (!res.ok) throw new Error();
      return (await res.json()) as Integrations;
    },
  });

  const save = useMutation({
    mutationFn: async (body: Record<string, string>) => {
      const res = await fetch("/api/settings/integrations", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const b = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(b.error || "failed");
      return b as Integrations;
    },
    onSuccess: () => { setF({}); setError(null); setNotice(t("intg.saved")); qc.invalidateQueries({ queryKey: ["integrations"] }); },
    onError: (e: Error) => { setNotice(null); setError(e.message); },
  });

  const test = useMutation({
    mutationFn: async (which: string) => {
      const res = await fetch("/api/settings/integrations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ test: which }),
      });
      const b = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(b.error || "failed");
      return b as { ok: boolean; siteName?: string | null; error?: string };
    },
    onSuccess: (b) => setTestResult(b.ok ? `${t("intg.testOk")}${b.siteName ? ` · ${b.siteName}` : ""}` : `${t("intg.testFail")}: ${b.error}`),
    onError: (e: Error) => setTestResult(`${t("intg.testFail")}: ${e.message}`),
  });

  if (q.isLoading) return null;
  if (!q.data) return <p className="text-sm text-slate-400">{t("ai.adminOnly")}</p>;
  const d = q.data;
  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement>) => setF((s) => ({ ...s, [k]: e.target.value }));
  const dirty = Object.keys(f).length > 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">{t("intg.title")}</h1>
        <p className="text-sm text-slate-500">{t("intg.subtitle")}</p>
      </div>

      {/* Microsoft 365 */}
      <Card className="p-5">
        <div className="mb-1 flex items-center gap-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">{t("intg.m365")}</h2>
          <Badge color={d.m365.configured ? "green" : "amber"}>{d.m365.configured ? t("intg.connected") : t("intg.notConnected")}</Badge>
        </div>
        <p className="mb-4 text-sm text-slate-500">{t("intg.m365Hint")}</p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div><label className="mb-1 block text-xs font-medium">Tenant ID</label>
            <Input placeholder={d.m365.tenantId || "00000000-…"} value={f.m365TenantId ?? ""} onChange={set("m365TenantId")} /></div>
          <div><label className="mb-1 block text-xs font-medium">Client ID</label>
            <Input placeholder={d.m365.clientId || "00000000-…"} value={f.m365ClientId ?? ""} onChange={set("m365ClientId")} /></div>
          <div><label className="mb-1 block text-xs font-medium">Client secret {d.m365.secretMasked ? `(${d.m365.secretMasked})` : ""}</label>
            <Input type="password" value={f.m365ClientSecret ?? ""} onChange={set("m365ClientSecret")} /></div>
          <div><label className="mb-1 block text-xs font-medium">SharePoint host</label>
            <Input placeholder={d.m365.sharepointHost || "contoso.sharepoint.com"} value={f.m365SharepointHost ?? ""} onChange={set("m365SharepointHost")} /></div>
          <div><label className="mb-1 block text-xs font-medium">SharePoint site path</label>
            <Input placeholder={d.m365.sharepointSite || "sites/Legal"} value={f.m365SharepointSite ?? ""} onChange={set("m365SharepointSite")} /></div>
          <div className="flex items-end">
            {d.m365.configured && (
              <Button variant="outline" disabled={test.isPending} onClick={() => test.mutate("m365")}>{t("intg.test")}</Button>
            )}
          </div>
        </div>
      </Card>

      {/* Teams */}
      <Card className="p-5">
        <div className="mb-1 flex items-center gap-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">{t("intg.teams")}</h2>
          <Badge color={d.teams.configured ? "green" : "amber"}>{d.teams.configured ? t("intg.connected") : t("intg.notConnected")}</Badge>
        </div>
        <p className="mb-4 text-sm text-slate-500">{t("intg.teamsHint")}</p>
        <div className="flex flex-wrap items-end gap-2">
          <div className="min-w-[260px] flex-1">
            <label className="mb-1 block text-xs font-medium">Webhook URL</label>
            <Input type="password" placeholder="https://….webhook.office.com/…" value={f.teamsWebhookUrl ?? ""} onChange={set("teamsWebhookUrl")} />
          </div>
          {d.teams.configured && (
            <Button variant="outline" disabled={test.isPending} onClick={() => test.mutate("teams")}>{t("intg.test")}</Button>
          )}
        </div>
      </Card>

      {/* E-signature */}
      <Card className="p-5">
        <div className="mb-1 flex items-center gap-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">{t("intg.esign")}</h2>
          <Badge color={d.esign.configured ? "green" : "amber"}>{d.esign.configured ? t("intg.connected") : t("intg.notConnected")}</Badge>
        </div>
        <p className="mb-4 text-sm text-slate-500">{t("intg.esignHint")}</p>
        <div className="max-w-md">
          <label className="mb-1 block text-xs font-medium">Dropbox Sign API key {d.esign.keyMasked ? `(${d.esign.keyMasked})` : ""}</label>
          <Input type="password" value={f.esignApiKey ?? ""} onChange={set("esignApiKey")} />
        </div>
      </Card>

      <div className="flex items-center gap-3">
        <Button disabled={!dirty || save.isPending} onClick={() => save.mutate(f)}>{t("ai.save")}</Button>
        {notice && <span className="text-sm text-green-600">{notice}</span>}
        {error && <span className="text-sm text-red-600">{error}</span>}
        {testResult && <span className="text-sm text-slate-500">{testResult}</span>}
      </div>
    </div>
  );
}

"use client";
/*
 * Dentons KMN ERP
 * Copyright (c) 2026 Bouquet Innovation SA. All rights reserved.
 * Proprietary and confidential. Unauthorised copying, distribution, modification,
 * or use of this file, via any medium, is strictly prohibited.
 */
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button, Input, Card, Badge } from "@/components/ui";
import { useT } from "@/lib/useT";

interface AiSettings {
  configured: boolean;
  source: "settings" | "env" | "none";
  maskedKey: string | null;
  model: string;
  geminiConfigured: boolean;
  geminiSource: "settings" | "env" | "none";
  geminiMaskedKey: string | null;
  geminiModel: string;
}

// Configure the firm's AI provider keys. The GET/PUT require user:manage, so the
// card is only usable by the IT Administrator; it renders nothing for anyone else.
export function AiSettingsCard() {
  const t = useT();
  const qc = useQueryClient();
  const [apiKey, setApiKey] = useState("");
  const [model, setModel] = useState("");
  const [geminiKey, setGeminiKey] = useState("");
  const [geminiModel, setGeminiModel] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const settings = useQuery({
    queryKey: ["ai-settings"],
    retry: false,
    queryFn: async () => {
      const res = await fetch("/api/settings/ai");
      if (res.status === 403 || res.status === 401) return null; // not IT admin
      if (!res.ok) throw new Error();
      return (await res.json()) as AiSettings;
    },
  });

  const save = useMutation({
    mutationFn: async (body: { apiKey?: string; model?: string; geminiApiKey?: string; geminiModel?: string }) => {
      const res = await fetch("/api/settings/ai", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const b = await res.json();
      if (!res.ok)
        throw new Error(
          b?.issues?.fieldErrors?.apiKey?.[0] || b?.issues?.fieldErrors?.geminiApiKey?.[0] || b.error || "failed",
        );
      return b as AiSettings;
    },
    onSuccess: (_b, vars) => {
      setApiKey("");
      setGeminiKey("");
      setError(null);
      setNotice(vars.apiKey === "" || vars.geminiApiKey === "" ? t("ai.cleared") : t("ai.saved"));
      qc.invalidateQueries({ queryKey: ["ai-settings"] });
    },
    onError: (e: Error) => {
      setNotice(null);
      setError(e.message);
    },
  });

  // Loading — say nothing yet.
  if (settings.isLoading) return null;
  // Loaded but not permitted (GET returned 403/null): show a clear notice rather
  // than a blank screen, so an admin who lacks the permission understands why.
  if (!settings.data) return <p className="text-sm text-slate-400">{t("ai.adminOnly")}</p>;
  const d = settings.data;
  const sourceLabel =
    d.source === "settings" ? t("ai.sourceSettings") : d.source === "env" ? t("ai.sourceEnv") : t("ai.sourceNone");

  return (
    <Card className="p-5">
      <div className="mb-1 flex items-center gap-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">{t("ai.settings")}</h2>
        <Badge color={d.configured ? "green" : "amber"}>
          {d.configured ? `${t("ai.active")} · ${sourceLabel}` : sourceLabel}
        </Badge>
      </div>
      <p className="mb-4 text-sm text-slate-500">{t("ai.settingsHint")}</p>

      {d.configured && d.maskedKey && (
        <p className="mb-3 font-mono text-sm text-slate-600 dark:text-slate-300">
          {d.maskedKey} · {d.model}
        </p>
      )}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-6">
        <div className="sm:col-span-3">
          <label className="mb-1 block text-xs font-medium">{t("ai.keyLabel")}</label>
          <Input
            type="password"
            placeholder={t("ai.keyPlaceholder")}
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
          />
        </div>
        <div className="sm:col-span-2">
          <label className="mb-1 block text-xs font-medium">{t("ai.model")}</label>
          <Input placeholder={d.model} value={model} onChange={(e) => setModel(e.target.value)} />
        </div>
        <div className="flex items-end gap-2">
          <Button
            className="h-10"
            disabled={save.isPending || (apiKey.trim() === "" && model.trim() === "")}
            onClick={() => save.mutate({ ...(apiKey.trim() ? { apiKey: apiKey.trim() } : {}), ...(model.trim() ? { model: model.trim() } : {}) })}
          >
            {t("ai.save")}
          </Button>
          {d.source === "settings" && (
            <Button className="h-10" variant="outline" disabled={save.isPending} onClick={() => save.mutate({ apiKey: "" })}>
              {t("ai.clear")}
            </Button>
          )}
        </div>
      </div>

      {/* Gemini — powers KYC internet screening on the free tier. */}
      <div className="mt-6 border-t border-slate-200 pt-4 dark:border-slate-800">
        <div className="mb-1 flex items-center gap-3">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">{t("ai.gemini")}</h3>
          <Badge color={d.geminiConfigured ? "green" : "amber"}>
            {d.geminiConfigured
              ? `${t("ai.active")} · ${d.geminiSource === "settings" ? t("ai.sourceSettings") : d.geminiSource === "env" ? t("ai.sourceEnv") : t("ai.sourceNone")}`
              : t("ai.sourceNone")}
          </Badge>
        </div>
        <p className="mb-3 text-sm text-slate-500">{t("ai.geminiHint")}</p>
        {d.geminiConfigured && d.geminiMaskedKey && (
          <p className="mb-3 font-mono text-sm text-slate-600 dark:text-slate-300">
            {d.geminiMaskedKey} · {d.geminiModel}
          </p>
        )}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-6">
          <div className="sm:col-span-3">
            <label className="mb-1 block text-xs font-medium">{t("ai.geminiKeyLabel")}</label>
            <Input
              type="password"
              placeholder={t("ai.geminiKeyPlaceholder")}
              value={geminiKey}
              onChange={(e) => setGeminiKey(e.target.value)}
            />
          </div>
          <div className="sm:col-span-2">
            <label className="mb-1 block text-xs font-medium">{t("ai.model")}</label>
            <Input placeholder={d.geminiModel} value={geminiModel} onChange={(e) => setGeminiModel(e.target.value)} />
          </div>
          <div className="flex items-end gap-2">
            <Button
              className="h-10"
              disabled={save.isPending || (geminiKey.trim() === "" && geminiModel.trim() === "")}
              onClick={() =>
                save.mutate({
                  ...(geminiKey.trim() ? { geminiApiKey: geminiKey.trim() } : {}),
                  ...(geminiModel.trim() ? { geminiModel: geminiModel.trim() } : {}),
                })
              }
            >
              {t("ai.save")}
            </Button>
            {d.geminiSource === "settings" && (
              <Button className="h-10" variant="outline" disabled={save.isPending} onClick={() => save.mutate({ geminiApiKey: "" })}>
                {t("ai.clear")}
              </Button>
            )}
          </div>
        </div>
      </div>

      {notice && <p className="mt-3 text-sm text-green-600">{notice}</p>}
      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
    </Card>
  );
}

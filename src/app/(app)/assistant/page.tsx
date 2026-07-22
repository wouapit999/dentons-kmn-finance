"use client";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button, Input, Card, Badge } from "@/components/ui";
import { useT } from "@/lib/useT";
import { usePerms } from "@/lib/usePerms";
import { formatMoney } from "@/lib/money";

interface Extracted {
  supplierName: string | null;
  invoiceNumber: string | null;
  date: string | null;
  amountExclVat: number | null;
  vatAmount: number | null;
  total: number | null;
  currency: string | null;
  description: string | null;
}

export default function AssistantPage() {
  const t = useT();
  const { can } = usePerms();
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState<string | null>(null);

  const ask = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/ai/nl-report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question }),
      });
      const b = await res.json();
      if (!res.ok) throw new Error(b.error || "failed");
      return b as { configured: boolean; answer: string };
    },
    onSuccess: (b) => setAnswer(b.answer),
    onError: () => setAnswer(t("ai.notConfigured")),
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">{t("ai.title")}</h1>
        <p className="text-sm text-slate-500">{t("ai.subtitle")}</p>
      </div>

      <Card className="p-5">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">{t("ai.ask")}</h2>
        <div className="flex gap-2">
          <Input
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder={t("ai.placeholder")}
            onKeyDown={(e) => { if (e.key === "Enter" && question.length > 2) ask.mutate(); }}
          />
          <Button disabled={question.length < 3 || ask.isPending} onClick={() => ask.mutate()}>
            {ask.isPending ? t("ai.thinking") : t("ai.send")}
          </Button>
        </div>
        {answer && (
          <div className="mt-4 whitespace-pre-wrap rounded-md bg-slate-50 p-4 text-sm dark:bg-slate-800/50">
            {answer}
          </div>
        )}
      </Card>

      {can("ap:manage") && <OcrCard />}
      {can("user:manage") && <AiSettingsCard />}
    </div>
  );
}

interface AiSettings {
  configured: boolean;
  source: "settings" | "env" | "none";
  maskedKey: string | null;
  model: string;
}

// Visible only to the IT Administrator (the GET returns 403 for everyone else).
function AiSettingsCard() {
  const t = useT();
  const qc = useQueryClient();
  const [apiKey, setApiKey] = useState("");
  const [model, setModel] = useState("");
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
    mutationFn: async (body: { apiKey?: string; model?: string }) => {
      const res = await fetch("/api/settings/ai", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const b = await res.json();
      if (!res.ok) throw new Error(b?.issues?.fieldErrors?.apiKey?.[0] || b.error || "failed");
      return b as AiSettings;
    },
    onSuccess: (_b, vars) => {
      setApiKey("");
      setError(null);
      setNotice(vars.apiKey === "" ? t("ai.cleared") : t("ai.saved"));
      qc.invalidateQueries({ queryKey: ["ai-settings"] });
    },
    onError: (e: Error) => {
      setNotice(null);
      setError(e.message);
    },
  });

  // Hide entirely for non-admins or while loading.
  if (!settings.data) return null;
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
      {notice && <p className="mt-3 text-sm text-green-600">{notice}</p>}
      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
    </Card>
  );
}

function OcrCard() {
  const t = useT();
  const [fields, setFields] = useState<Extracted | null>(null);
  const [error, setError] = useState<string | null>(null);

  const extract = useMutation({
    mutationFn: async (file: File) => {
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result).split(",")[1] ?? "");
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      const res = await fetch("/api/ai/ocr", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ base64, mime: file.type || "image/png" }),
      });
      const b = await res.json();
      if (!res.ok) throw new Error(b.error || "failed");
      if (b.configured === false) throw new Error(b.error || t("ai.notConfigured"));
      return b.fields as Extracted;
    },
    onSuccess: (f) => { setFields(f); setError(null); },
    onError: (e: Error) => { setError(e.message); setFields(null); },
  });

  return (
    <Card className="p-5">
      <h2 className="mb-1 text-sm font-semibold uppercase tracking-wide text-slate-500">{t("ai.ocr")}</h2>
      <p className="mb-3 text-sm text-slate-500">{t("ai.ocrHint")}</p>
      <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-slate-300 px-4 py-2 text-sm font-medium hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800">
        {extract.isPending ? t("ai.extracting") : t("ai.upload")}
        <input
          type="file"
          accept="image/*,application/pdf"
          className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) extract.mutate(f); }}
        />
      </label>

      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

      {fields && (
        <div className="mt-4">
          <div className="mb-2 flex items-center gap-2">
            <Badge color="brand">{t("ai.extracted")}</Badge>
          </div>
          <table className="w-full max-w-md text-sm">
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              <Row label={t("bill.supplier")} value={fields.supplierName} />
              <Row label={t("bill.ref")} value={fields.invoiceNumber} />
              <Row label={t("common.date")} value={fields.date} />
              <Row label={t("bill.desc")} value={fields.description} />
              <Row label={t("bill.amount")} value={fields.amountExclVat != null ? formatMoney(fields.amountExclVat, fields.currency ?? "XAF") : "—"} />
              <Row label={t("bill.vat")} value={fields.vatAmount != null ? formatMoney(fields.vatAmount, fields.currency ?? "XAF") : "—"} />
              <Row label={t("bill.total")} value={fields.total != null ? formatMoney(fields.total, fields.currency ?? "XAF") : "—"} />
            </tbody>
          </table>
          <p className="mt-3 text-xs text-slate-400">
            Use these values to create a bill under Accounts Payable → New bill.
          </p>
        </div>
      )}
    </Card>
  );
}

function Row({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <tr>
      <td className="py-1.5 pr-4 text-slate-500">{label}</td>
      <td className="py-1.5 font-medium">{value ?? "—"}</td>
    </tr>
  );
}

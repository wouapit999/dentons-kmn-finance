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
import { usePerms } from "@/lib/usePerms";

interface TemplateRow { id: string; name: string; category: string; language: string; updatedAt: string }
interface TemplateFull extends TemplateRow { body: string }
interface ClientOpt { id: string; name: string }
interface MatterOpt { id: string; code: string; name: string }

const CATS = ["ENGAGEMENT", "NDA", "POA", "DEMAND", "CONTRACT", "GENERAL"] as const;

export default function TemplatesPage() {
  const t = useT();
  const { can } = usePerms();
  const qc = useQueryClient();
  const canManage = can("client:manage");
  const [editing, setEditing] = useState<TemplateFull | "new" | null>(null);
  const [generating, setGenerating] = useState<TemplateRow | null>(null);

  const list = useQuery({
    queryKey: ["templates"],
    queryFn: async () => {
      const res = await fetch("/api/templates");
      if (!res.ok) throw new Error("failed");
      return (await res.json()) as TemplateRow[];
    },
  });

  const openEdit = async (row: TemplateRow) => {
    const res = await fetch(`/api/templates/${row.id}`);
    if (res.ok) setEditing((await res.json()) as TemplateFull);
  };

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/templates/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("failed");
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["templates"] }),
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">{t("tpl.title")}</h1>
          <p className="text-sm text-slate-500">{t("tpl.subtitle")}</p>
        </div>
        {canManage && <Button onClick={() => setEditing("new")}>+ {t("tpl.new")}</Button>}
      </div>

      <Card className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500 dark:bg-slate-800/50">
            <tr>
              <th className="px-4 py-3">{t("tpl.name")}</th>
              <th className="px-4 py-3">{t("tpl.category")}</th>
              <th className="px-4 py-3">{t("common.language")}</th>
              <th className="px-4 py-3 text-right">{t("common.actions")}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {list.isLoading && <tr><td colSpan={4} className="px-4 py-6 text-center text-slate-400">{t("common.loading")}</td></tr>}
            {list.data?.length === 0 && <tr><td colSpan={4} className="px-4 py-8 text-center text-slate-400">{t("tpl.empty")}</td></tr>}
            {list.data?.map((row) => (
              <tr key={row.id}>
                <td className="px-4 py-2.5 font-medium">{row.name}</td>
                <td className="px-4 py-2.5"><Badge color="slate">{row.category}</Badge></td>
                <td className="px-4 py-2.5 uppercase text-slate-500">{row.language}</td>
                <td className="px-4 py-2.5">
                  <div className="flex justify-end gap-2">
                    <Button size="sm" onClick={() => setGenerating(row)}>{t("tpl.generate")}</Button>
                    {canManage && (
                      <>
                        <Button size="sm" variant="outline" onClick={() => openEdit(row)}>{t("common.edit")}</Button>
                        <Button size="sm" variant="outline" disabled={remove.isPending}
                          onClick={() => { if (confirm(t("tpl.confirmDelete"))) remove.mutate(row.id); }}>
                          {t("common.delete")}
                        </Button>
                      </>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
      <p className="text-xs text-slate-400">{t("tpl.placeholdersHint")}</p>

      {editing && (
        <EditDialog
          tpl={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); qc.invalidateQueries({ queryKey: ["templates"] }); }}
        />
      )}
      {generating && <GenerateDialog tpl={generating} onClose={() => setGenerating(null)} />}
    </div>
  );
}

function EditDialog({ tpl, onClose, onSaved }: { tpl: TemplateFull | null; onClose: () => void; onSaved: () => void }) {
  const t = useT();
  const [name, setName] = useState(tpl?.name ?? "");
  const [category, setCategory] = useState(tpl?.category ?? "GENERAL");
  const [language, setLanguage] = useState(tpl?.language ?? "en");
  const [body, setBody] = useState(tpl?.body ?? "");
  const [error, setError] = useState<string | null>(null);

  const save = useMutation({
    mutationFn: async () => {
      const res = await fetch(tpl ? `/api/templates/${tpl.id}` : "/api/templates", {
        method: tpl ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, category, language, body }),
      });
      if (!res.ok) { const b = await res.json().catch(() => ({})); throw new Error(b.error || "failed"); }
    },
    onSuccess: onSaved,
    onError: (e: Error) => setError(e.message),
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <Card className="max-h-[92vh] w-full max-w-3xl overflow-y-auto p-6">
        <h2 className="mb-4 text-lg font-semibold">{tpl ? t("tpl.edit") : t("tpl.new")}</h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div>
            <label className="mb-1 block text-xs font-medium">{t("tpl.name")}</label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium">{t("tpl.category")}</label>
            <select className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-900" value={category} onChange={(e) => setCategory(e.target.value)}>
              {CATS.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium">{t("common.language")}</label>
            <select className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-900" value={language} onChange={(e) => setLanguage(e.target.value)}>
              <option value="en">EN</option>
              <option value="fr">FR</option>
            </select>
          </div>
        </div>
        <label className="mb-1 mt-3 block text-xs font-medium">{t("tpl.body")}</label>
        <textarea
          className="min-h-[300px] w-full rounded-md border border-slate-300 bg-white px-3 py-2 font-mono text-xs dark:border-slate-700 dark:bg-slate-900"
          value={body} onChange={(e) => setBody(e.target.value)}
        />
        <p className="mt-1 text-xs text-slate-400">{t("tpl.placeholdersHint")}</p>
        {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>{t("common.cancel")}</Button>
          <Button disabled={name.length < 2 || body.length < 10 || save.isPending} onClick={() => save.mutate()}>{t("common.save")}</Button>
        </div>
      </Card>
    </div>
  );
}

function GenerateDialog({ tpl, onClose }: { tpl: TemplateRow; onClose: () => void }) {
  const t = useT();
  const [clientId, setClientId] = useState("");
  const [matterId, setMatterId] = useState("");
  const [saveToFile, setSaveToFile] = useState(true);
  const [output, setOutput] = useState<string | null>(null);
  const [unresolved, setUnresolved] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  const clients = useQuery({
    queryKey: ["clients-list"],
    queryFn: async () => {
      const res = await fetch("/api/clients");
      if (!res.ok) throw new Error("failed");
      return (await res.json()) as ClientOpt[];
    },
  });
  const matters = useQuery({
    queryKey: ["matters"],
    queryFn: async () => {
      const res = await fetch("/api/matters");
      if (!res.ok) throw new Error("failed");
      return (await res.json()) as MatterOpt[];
    },
  });

  const gen = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/templates/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          templateId: tpl.id,
          clientId: clientId || undefined,
          matterId: matterId || undefined,
          saveToClientFile: saveToFile && !!clientId,
        }),
      });
      const b = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(b.error || "failed");
      return b as { body: string; unresolved: string[]; savedDocId: string | null };
    },
    onSuccess: (b) => { setOutput(b.body); setUnresolved(b.unresolved); setError(null); },
    onError: (e: Error) => setError(e.message),
  });

  const download = () => {
    if (!output) return;
    const blob = new Blob([output], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${tpl.name.replace(/[^\w\- ]+/g, "").trim() || "document"}.md`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 3000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <Card className="max-h-[92vh] w-full max-w-2xl overflow-y-auto p-6">
        <h2 className="mb-4 text-lg font-semibold">{t("tpl.generate")} · {tpl.name}</h2>
        {!output ? (
          <div className="space-y-3">
            <div>
              <label className="mb-1 block text-xs font-medium">{t("tpl.forClient")}</label>
              <select className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-900" value={clientId} onChange={(e) => setClientId(e.target.value)}>
                <option value="">—</option>
                {clients.data?.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium">{t("tpl.forMatter")}</label>
              <select className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-900" value={matterId} onChange={(e) => setMatterId(e.target.value)}>
                <option value="">—</option>
                {matters.data?.map((m) => <option key={m.id} value={m.id}>{m.code} — {m.name}</option>)}
              </select>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={saveToFile} onChange={(e) => setSaveToFile(e.target.checked)} disabled={!clientId} />
              {t("tpl.saveToFile")}
            </label>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={onClose}>{t("common.cancel")}</Button>
              <Button disabled={gen.isPending} onClick={() => gen.mutate()}>{gen.isPending ? "…" : t("tpl.generate")}</Button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {unresolved.length > 0 && (
              <p className="rounded bg-amber-50 p-2 text-xs text-amber-700 dark:bg-amber-950/20 dark:text-amber-300">
                {t("tpl.unresolved")}: {unresolved.join(", ")}
              </p>
            )}
            <pre className="max-h-[50vh] overflow-auto whitespace-pre-wrap rounded-md bg-slate-50 p-4 text-xs dark:bg-slate-800/50">{output}</pre>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={onClose}>{t("common.cancel")}</Button>
              <Button onClick={download}>{t("tpl.download")}</Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}

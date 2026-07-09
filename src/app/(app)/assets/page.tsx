"use client";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button, Input, Card, Badge } from "@/components/ui";
import { useT } from "@/lib/useT";
import { formatMoney } from "@/lib/money";

interface Asset {
  id: string;
  tag: string;
  name: string;
  category: string | null;
  cost: number;
  salvageValue: number;
  usefulLifeMonths: number;
  monthsDepreciated: number;
  accumulatedDepreciation: number;
  netBookValue: number;
  status: string;
}

export default function AssetsPage() {
  const t = useT();
  const qc = useQueryClient();
  const [creating, setCreating] = useState(false);
  const [disposeFor, setDisposeFor] = useState<Asset | null>(null);
  const [depOpen, setDepOpen] = useState(false);

  const assets = useQuery({
    queryKey: ["assets"],
    queryFn: async () => (await fetch("/api/assets")).json() as Promise<Asset[]>,
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">{t("fa.title")}</h1>
          <p className="text-sm text-slate-500">{t("fa.subtitle")}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setDepOpen(true)}>{t("fa.depreciate")}</Button>
          <Button onClick={() => setCreating(true)}>+ {t("fa.new")}</Button>
        </div>
      </div>

      <Card className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500 dark:bg-slate-800/50">
            <tr>
              <th className="px-4 py-3">{t("fa.tag")}</th>
              <th className="px-4 py-3">{t("fa.name")}</th>
              <th className="px-4 py-3 text-right">{t("fa.cost")}</th>
              <th className="px-4 py-3 text-right">{t("fa.accumulated")}</th>
              <th className="px-4 py-3 text-right">{t("fa.nbv")}</th>
              <th className="px-4 py-3">Life</th>
              <th className="px-4 py-3">{t("inv.status")}</th>
              <th className="px-4 py-3 text-right">{t("common.actions")}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {assets.isLoading && (
              <tr><td colSpan={8} className="px-4 py-6 text-center text-slate-400">{t("common.loading")}</td></tr>
            )}
            {assets.data?.length === 0 && (
              <tr><td colSpan={8} className="px-4 py-6 text-center text-slate-400">—</td></tr>
            )}
            {assets.data?.map((a) => (
              <tr key={a.id}>
                <td className="px-4 py-2.5 font-mono">{a.tag}</td>
                <td className="px-4 py-2.5 font-medium">{a.name}</td>
                <td className="px-4 py-2.5 text-right">{formatMoney(a.cost)}</td>
                <td className="px-4 py-2.5 text-right">{formatMoney(a.accumulatedDepreciation)}</td>
                <td className="px-4 py-2.5 text-right font-medium">{formatMoney(a.netBookValue)}</td>
                <td className="px-4 py-2.5 text-slate-500">{a.monthsDepreciated}/{a.usefulLifeMonths}</td>
                <td className="px-4 py-2.5"><Badge color={a.status === "ACTIVE" ? "green" : "slate"}>{a.status}</Badge></td>
                <td className="px-4 py-2.5 text-right">
                  {a.status === "ACTIVE" && (
                    <Button size="sm" variant="outline" onClick={() => setDisposeFor(a)}>{t("fa.dispose")}</Button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      {creating && <NewAssetDialog onClose={() => setCreating(false)} onCreated={() => { setCreating(false); qc.invalidateQueries({ queryKey: ["assets"] }); }} />}
      {depOpen && <DepreciateDialog onClose={() => setDepOpen(false)} onDone={() => { setDepOpen(false); qc.invalidateQueries({ queryKey: ["assets"] }); }} />}
      {disposeFor && <DisposeDialog asset={disposeFor} onClose={() => setDisposeFor(null)} onDone={() => { setDisposeFor(null); qc.invalidateQueries({ queryKey: ["assets"] }); }} />}
    </div>
  );
}

function NewAssetDialog({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const t = useT();
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    tag: "", name: "", category: "", assetAccountCode: "",
    acquisitionDate: new Date().toISOString().slice(0, 10),
    cost: 0, salvageValue: 0, usefulLifeMonths: 36,
  });
  const meta = useQuery({
    queryKey: ["assets-meta"],
    queryFn: async () => (await fetch("/api/assets/meta")).json() as Promise<{ assetAccounts: { code: string; name: string }[] }>,
  });
  const set = (k: string, v: any) => setForm((f) => ({ ...f, [k]: v }));

  const create = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/assets", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, cost: Number(form.cost), salvageValue: Number(form.salvageValue), usefulLifeMonths: Number(form.usefulLifeMonths) }),
      });
      if (!res.ok) { const b = await res.json().catch(() => ({})); throw new Error(b.error || "failed"); }
    },
    onSuccess: onCreated,
    onError: (e: Error) => setError(e.message),
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <Card className="w-full max-w-lg p-6">
        <h2 className="mb-4 text-lg font-semibold">{t("fa.new")}</h2>
        <div className="grid grid-cols-2 gap-3">
          <div><label className="mb-1 block text-sm font-medium">{t("fa.tag")}</label><Input value={form.tag} onChange={(e) => set("tag", e.target.value)} /></div>
          <div><label className="mb-1 block text-sm font-medium">{t("fa.category")}</label><Input value={form.category} onChange={(e) => set("category", e.target.value)} /></div>
          <div className="col-span-2"><label className="mb-1 block text-sm font-medium">{t("fa.name")}</label><Input value={form.name} onChange={(e) => set("name", e.target.value)} /></div>
          <div className="col-span-2">
            <label className="mb-1 block text-sm font-medium">{t("fa.account")}</label>
            <select className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-900" value={form.assetAccountCode} onChange={(e) => set("assetAccountCode", e.target.value)}>
              <option value="">—</option>
              {meta.data?.assetAccounts.map((a) => <option key={a.code} value={a.code}>{a.name}</option>)}
            </select>
          </div>
          <div><label className="mb-1 block text-sm font-medium">{t("fa.cost")}</label><Input type="number" value={form.cost} onChange={(e) => set("cost", e.target.value)} /></div>
          <div><label className="mb-1 block text-sm font-medium">{t("fa.salvage")}</label><Input type="number" value={form.salvageValue} onChange={(e) => set("salvageValue", e.target.value)} /></div>
          <div><label className="mb-1 block text-sm font-medium">{t("fa.life")}</label><Input type="number" value={form.usefulLifeMonths} onChange={(e) => set("usefulLifeMonths", e.target.value)} /></div>
          <div><label className="mb-1 block text-sm font-medium">{t("fa.acquired")}</label><Input type="date" value={form.acquisitionDate} onChange={(e) => set("acquisitionDate", e.target.value)} /></div>
        </div>
        {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>{t("common.cancel")}</Button>
          <Button disabled={!form.tag || !form.name || !form.assetAccountCode || Number(form.cost) <= 0 || create.isPending} onClick={() => create.mutate()}>{t("common.create")}</Button>
        </div>
      </Card>
    </div>
  );
}

function DepreciateDialog({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const t = useT();
  const [period, setPeriod] = useState("");
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const run = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/assets/depreciate", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ period, date: new Date().toISOString().slice(0, 10) }),
      });
      const b = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(b.error || "failed");
      return b;
    },
    onSuccess: (b) => { setResult(`${b.assets} assets, ${b.total} depreciated (${b.entryNo}).`); onDone(); },
    onError: (e: Error) => setError(e.message === "nothing_to_depreciate" ? "Nothing to depreciate." : e.message),
  });
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <Card className="w-full max-w-sm p-6">
        <h2 className="mb-4 text-lg font-semibold">{t("fa.depreciate")}</h2>
        <label className="mb-1 block text-sm font-medium">{t("fa.period")}</label>
        <Input placeholder="July 2026" value={period} onChange={(e) => setPeriod(e.target.value)} />
        {result && <p className="mt-2 text-sm text-green-600">{result}</p>}
        {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>{t("common.cancel")}</Button>
          <Button disabled={period.length < 3 || run.isPending} onClick={() => run.mutate()}>{t("fa.depreciate")}</Button>
        </div>
      </Card>
    </div>
  );
}

function DisposeDialog({ asset, onClose, onDone }: { asset: Asset; onClose: () => void; onDone: () => void }) {
  const t = useT();
  const [proceeds, setProceeds] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const dispose = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/assets/${asset.id}/dispose`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date: new Date().toISOString().slice(0, 10), proceeds: Number(proceeds) }),
      });
      if (!res.ok) { const b = await res.json().catch(() => ({})); throw new Error(b.error || "failed"); }
    },
    onSuccess: onDone,
    onError: (e: Error) => setError(e.message),
  });
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <Card className="w-full max-w-sm p-6">
        <h2 className="mb-1 text-lg font-semibold">{t("fa.disposeTitle")}</h2>
        <p className="mb-4 text-sm text-slate-500">{asset.tag} · {t("fa.nbv")}: {formatMoney(asset.netBookValue)}</p>
        <label className="mb-1 block text-sm font-medium">{t("fa.proceeds")}</label>
        <Input type="number" value={proceeds} onChange={(e) => setProceeds(Number(e.target.value))} />
        {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>{t("common.cancel")}</Button>
          <Button disabled={dispose.isPending} onClick={() => dispose.mutate()}>{t("fa.dispose")}</Button>
        </div>
      </Card>
    </div>
  );
}

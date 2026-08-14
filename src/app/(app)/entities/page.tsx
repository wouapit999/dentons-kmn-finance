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

interface Entity {
  id: string; code: string; name: string; baseCurrency: string;
  countryCode: string; taxId: string | null; isDefault: boolean;
  matters: number; proformas: number;
}
interface Office { id: string; name: string; countryCode: string; currency: string; timezone: string }
interface Rate { currency: string; rate: number; asOf: string }
interface Data { baseCurrency: string; entities: Entity[]; offices: Office[]; rates: Rate[] }

export default function EntitiesPage() {
  const t = useT();
  const qc = useQueryClient();
  const [addEntity, setAddEntity] = useState(false);
  const [addRate, setAddRate] = useState(false);

  const me = useQuery({
    queryKey: ["me"],
    queryFn: async () => (await fetch("/api/me")).json() as Promise<{ permissions: string[] }>,
  });
  const canManage = (me.data?.permissions ?? []).includes("entity:manage");

  const q = useQuery({
    queryKey: ["entities"],
    queryFn: async () => {
      const res = await fetch("/api/entities");
      if (!res.ok) throw new Error("failed");
      return (await res.json()) as Data;
    },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">{t("ent.title")}</h1>
        <p className="text-sm text-slate-500">{t("ent.subtitle")}</p>
      </div>

      {/* Legal entities */}
      <Card className="overflow-hidden">
        <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3 dark:border-slate-800">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">{t("ent.entities")}</h2>
          {canManage && <Button size="sm" onClick={() => setAddEntity(true)}>+ {t("ent.newEntity")}</Button>}
        </div>
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500 dark:bg-slate-800/50">
            <tr>
              <th className="px-4 py-2.5">{t("ent.code")}</th>
              <th className="px-4 py-2.5">{t("ent.name")}</th>
              <th className="px-4 py-2.5">{t("ent.country")}</th>
              <th className="px-4 py-2.5">{t("ent.currency")}</th>
              <th className="px-4 py-2.5">{t("ent.taxId")}</th>
              <th className="px-4 py-2.5 text-right">{t("ent.matters")}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {q.isLoading && <tr><td colSpan={6} className="px-4 py-6 text-center text-slate-400">{t("common.loading")}</td></tr>}
            {q.data?.entities.length === 0 && <tr><td colSpan={6} className="px-4 py-8 text-center text-slate-400">{t("ent.noEntities")}</td></tr>}
            {q.data?.entities.map((e) => (
              <tr key={e.id}>
                <td className="px-4 py-2.5 font-mono">{e.code}</td>
                <td className="px-4 py-2.5">
                  {e.name} {e.isDefault && <Badge color="brand">{t("ent.default")}</Badge>}
                </td>
                <td className="px-4 py-2.5">{e.countryCode}</td>
                <td className="px-4 py-2.5">{e.baseCurrency}</td>
                <td className="px-4 py-2.5 text-slate-500">{e.taxId ?? "—"}</td>
                <td className="px-4 py-2.5 text-right">{e.matters}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Offices */}
        <Card className="overflow-hidden">
          <div className="border-b border-slate-100 px-4 py-3 dark:border-slate-800">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">{t("ent.offices")}</h2>
          </div>
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500 dark:bg-slate-800/50">
              <tr>
                <th className="px-4 py-2.5">{t("ent.name")}</th>
                <th className="px-4 py-2.5">{t("ent.country")}</th>
                <th className="px-4 py-2.5">{t("ent.currency")}</th>
                <th className="px-4 py-2.5">{t("ent.timezone")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {q.data?.offices.length === 0 && <tr><td colSpan={4} className="px-4 py-6 text-center text-slate-400">—</td></tr>}
              {q.data?.offices.map((o) => (
                <tr key={o.id}>
                  <td className="px-4 py-2.5">{o.name}</td>
                  <td className="px-4 py-2.5">{o.countryCode}</td>
                  <td className="px-4 py-2.5">{o.currency}</td>
                  <td className="px-4 py-2.5 text-slate-500">{o.timezone}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>

        {/* FX rates */}
        <Card className="overflow-hidden">
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3 dark:border-slate-800">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">{t("ent.fx")} · {t("ent.base")} {q.data?.baseCurrency}</h2>
            {canManage && <Button size="sm" onClick={() => setAddRate(true)}>+ {t("ent.newRate")}</Button>}
          </div>
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500 dark:bg-slate-800/50">
              <tr>
                <th className="px-4 py-2.5">{t("ent.pair")}</th>
                <th className="px-4 py-2.5 text-right">{t("ent.rate")}</th>
                <th className="px-4 py-2.5">{t("ent.asOf")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {q.data?.rates.length === 0 && <tr><td colSpan={3} className="px-4 py-6 text-center text-slate-400">{t("ent.noRates")}</td></tr>}
              {q.data?.rates.map((r) => (
                <tr key={r.currency}>
                  <td className="px-4 py-2.5 font-mono">1 {r.currency} → {r.rate} {q.data?.baseCurrency}</td>
                  <td className="px-4 py-2.5 text-right">{r.rate}</td>
                  <td className="px-4 py-2.5 text-slate-500">{new Date(r.asOf).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      </div>

      {addEntity && <EntityDialog onClose={() => setAddEntity(false)} onDone={() => { setAddEntity(false); qc.invalidateQueries({ queryKey: ["entities"] }); }} />}
      {addRate && <RateDialog base={q.data?.baseCurrency ?? "XAF"} onClose={() => setAddRate(false)} onDone={() => { setAddRate(false); qc.invalidateQueries({ queryKey: ["entities"] }); }} />}
    </div>
  );
}

function EntityDialog({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const t = useT();
  const [f, setF] = useState({ code: "", name: "", baseCurrency: "XAF", countryCode: "CM", taxId: "", isDefault: false });
  const [error, setError] = useState<string | null>(null);
  const save = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/entities", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...f, taxId: f.taxId || undefined }),
      });
      if (!res.ok) { const b = await res.json().catch(() => ({})); throw new Error(b.error || "failed"); }
    },
    onSuccess: onDone,
    onError: (e: Error) => setError(e.message),
  });
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <Card className="w-full max-w-md p-6">
        <h2 className="mb-4 text-lg font-semibold">{t("ent.newEntity")}</h2>
        <div className="grid grid-cols-2 gap-3">
          <div><label className="mb-1 block text-xs font-medium">{t("ent.code")}</label><Input value={f.code} onChange={(e) => setF({ ...f, code: e.target.value })} /></div>
          <div><label className="mb-1 block text-xs font-medium">{t("ent.currency")}</label><Input value={f.baseCurrency} onChange={(e) => setF({ ...f, baseCurrency: e.target.value.toUpperCase() })} maxLength={3} /></div>
          <div className="col-span-2"><label className="mb-1 block text-xs font-medium">{t("ent.name")}</label><Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></div>
          <div><label className="mb-1 block text-xs font-medium">{t("ent.country")}</label><Input value={f.countryCode} onChange={(e) => setF({ ...f, countryCode: e.target.value.toUpperCase() })} maxLength={2} /></div>
          <div><label className="mb-1 block text-xs font-medium">{t("ent.taxId")}</label><Input value={f.taxId} onChange={(e) => setF({ ...f, taxId: e.target.value })} /></div>
        </div>
        <label className="mt-3 flex items-center gap-2 text-sm">
          <input type="checkbox" checked={f.isDefault} onChange={(e) => setF({ ...f, isDefault: e.target.checked })} />
          {t("ent.makeDefault")}
        </label>
        {error && <p className="mt-2 text-sm text-red-600">{t(("err." + error) as never)}</p>}
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>{t("common.cancel")}</Button>
          <Button disabled={!f.code || !f.name || save.isPending} onClick={() => save.mutate()}>{t("common.create")}</Button>
        </div>
      </Card>
    </div>
  );
}

function RateDialog({ base, onClose, onDone }: { base: string; onClose: () => void; onDone: () => void }) {
  const t = useT();
  const [currency, setCurrency] = useState("EUR");
  const [rate, setRate] = useState(655.957);
  const [asOf, setAsOf] = useState(new Date().toISOString().slice(0, 10));
  const [error, setError] = useState<string | null>(null);
  const save = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/entities", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fx: { currency, rate, asOf } }),
      });
      if (!res.ok) { const b = await res.json().catch(() => ({})); throw new Error(b.error || "failed"); }
    },
    onSuccess: onDone,
    onError: (e: Error) => setError(e.message),
  });
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <Card className="w-full max-w-sm p-6">
        <h2 className="mb-1 text-lg font-semibold">{t("ent.newRate")}</h2>
        <p className="mb-4 text-sm text-slate-500">{t("ent.rateHint")}</p>
        <div className="space-y-3">
          <div><label className="mb-1 block text-xs font-medium">{t("ent.currency")}</label><Input value={currency} onChange={(e) => setCurrency(e.target.value.toUpperCase())} maxLength={3} /></div>
          <div><label className="mb-1 block text-xs font-medium">{t("ent.rateTo")} {base}</label><Input type="number" value={rate} onChange={(e) => setRate(Number(e.target.value))} /></div>
          <div><label className="mb-1 block text-xs font-medium">{t("ent.asOf")}</label><Input type="date" value={asOf} onChange={(e) => setAsOf(e.target.value)} /></div>
          {error && <p className="text-sm text-red-600">{t(("err." + error) as never)}</p>}
          <div className="flex justify-end gap-2 pt-1">
            <Button variant="outline" onClick={onClose}>{t("common.cancel")}</Button>
            <Button disabled={!currency || rate <= 0 || save.isPending} onClick={() => save.mutate()}>{t("common.save")}</Button>
          </div>
        </div>
      </Card>
    </div>
  );
}

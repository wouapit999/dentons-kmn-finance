"use client";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button, Input, Card, Badge } from "@/components/ui";
import { useT } from "@/lib/useT";
import { usePerms, getJson } from "@/lib/usePerms";
import { formatMoney } from "@/lib/money";

interface Budget {
  id: string;
  name: string;
  year: number;
  status: string;
  lines: number;
  total: number;
}
interface Detail {
  id: string;
  name: string;
  year: number;
  rows: { accountCode: string; accountName: string; type: string; budget: number; actual: number; variance: number; usedPct: number; favourable: boolean }[];
  totals: { budget: number; actual: number };
}

export default function BudgetsPage() {
  const t = useT();
  const { can } = usePerms();
  const qc = useQueryClient();
  const [creating, setCreating] = useState(false);
  const [viewId, setViewId] = useState<string | null>(null);

  const budgets = useQuery({
    queryKey: ["budgets"],
    queryFn: () => getJson<Budget[]>("/api/budgets"),
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">{t("bud.title")}</h1>
          <p className="text-sm text-slate-500">{t("bud.subtitle")}</p>
        </div>
        {can("budget:manage") && <Button onClick={() => setCreating(true)}>+ {t("bud.new")}</Button>}
      </div>

      <Card className="overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500 dark:bg-slate-800/50">
            <tr>
              <th className="px-4 py-3">{t("bud.name")}</th>
              <th className="px-4 py-3">{t("bud.year")}</th>
              <th className="px-4 py-3">{t("bud.lines")}</th>
              <th className="px-4 py-3 text-right">{t("bud.total")}</th>
              <th className="px-4 py-3 text-right">{t("common.actions")}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {budgets.isLoading && <tr><td colSpan={5} className="px-4 py-6 text-center text-slate-400">{t("common.loading")}</td></tr>}
            {budgets.data?.length === 0 && <tr><td colSpan={5} className="px-4 py-6 text-center text-slate-400">—</td></tr>}
            {budgets.data?.map((b) => (
              <tr key={b.id}>
                <td className="px-4 py-2.5 font-medium">{b.name}</td>
                <td className="px-4 py-2.5">{b.year}</td>
                <td className="px-4 py-2.5 text-slate-500">{b.lines}</td>
                <td className="px-4 py-2.5 text-right">{formatMoney(b.total)}</td>
                <td className="px-4 py-2.5 text-right">
                  <Button size="sm" variant="outline" onClick={() => setViewId(b.id)}>{t("bud.view")}</Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      {creating && <NewBudgetDialog onClose={() => setCreating(false)} onCreated={() => { setCreating(false); qc.invalidateQueries({ queryKey: ["budgets"] }); }} />}
      {viewId && <VarianceDialog id={viewId} onClose={() => setViewId(null)} />}
    </div>
  );
}

function NewBudgetDialog({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const t = useT();
  const [name, setName] = useState("");
  const [year, setYear] = useState(new Date().getFullYear());
  const [lines, setLines] = useState<{ accountCode: string; annualAmount: number }[]>([{ accountCode: "", annualAmount: 0 }]);
  const [error, setError] = useState<string | null>(null);

  const meta = useQuery({
    queryKey: ["budgets-meta"],
    queryFn: () => getJson<{ accounts: { code: string; name: string }[] }>("/api/budgets/meta"),
  });

  const create = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/budgets", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, year: Number(year), lines: lines.filter((l) => l.accountCode).map((l) => ({ accountCode: l.accountCode, annualAmount: Number(l.annualAmount) || 0 })) }),
      });
      if (!res.ok) { const b = await res.json().catch(() => ({})); throw new Error(b.error || "failed"); }
    },
    onSuccess: onCreated,
    onError: (e: Error) => setError(e.message),
  });

  const setLine = (i: number, patch: Partial<{ accountCode: string; annualAmount: number }>) =>
    setLines((ls) => ls.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <Card className="max-h-[90vh] w-full max-w-xl overflow-y-auto p-6">
        <h2 className="mb-4 text-lg font-semibold">{t("bud.new")}</h2>
        <div className="mb-4 grid grid-cols-2 gap-3">
          <div><label className="mb-1 block text-sm font-medium">{t("bud.name")}</label><Input value={name} onChange={(e) => setName(e.target.value)} /></div>
          <div><label className="mb-1 block text-sm font-medium">{t("bud.year")}</label><Input type="number" value={year} onChange={(e) => setYear(Number(e.target.value))} /></div>
        </div>
        <div className="space-y-2">
          {lines.map((l, i) => (
            <div key={i} className="flex gap-2">
              <select className="h-9 flex-1 rounded-md border border-slate-300 bg-white px-2 text-sm dark:border-slate-700 dark:bg-slate-900" value={l.accountCode} onChange={(e) => setLine(i, { accountCode: e.target.value })}>
                <option value="">— {t("bud.account")} —</option>
                {meta.data?.accounts.map((a) => <option key={a.code} value={a.code}>{a.name}</option>)}
              </select>
              <Input className="h-9 w-40" type="number" placeholder={t("bud.annualAmount")} value={l.annualAmount} onChange={(e) => setLine(i, { annualAmount: Number(e.target.value) })} />
            </div>
          ))}
        </div>
        <Button variant="outline" size="sm" className="mt-2" onClick={() => setLines((ls) => [...ls, { accountCode: "", annualAmount: 0 }])}>+ {t("bud.addLine")}</Button>
        {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>{t("common.cancel")}</Button>
          <Button disabled={!name || lines.filter((l) => l.accountCode).length === 0 || create.isPending} onClick={() => create.mutate()}>{t("common.create")}</Button>
        </div>
      </Card>
    </div>
  );
}

function VarianceDialog({ id, onClose }: { id: string; onClose: () => void }) {
  const t = useT();
  const q = useQuery({
    queryKey: ["budget", id],
    queryFn: () => getJson<Detail>(`/api/budgets/${id}`),
  });
  const d = q.data;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <Card className="max-h-[90vh] w-full max-w-3xl overflow-y-auto p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">{d ? `${d.name} · ${d.year}` : t("bud.view")}</h2>
          <Button size="sm" variant="ghost" onClick={onClose}>✕</Button>
        </div>
        {!d ? <p className="text-slate-400">{t("common.loading")}</p> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-2 py-2">{t("bud.account")}</th>
                  <th className="px-2 py-2 text-right">{t("bud.budget")}</th>
                  <th className="px-2 py-2 text-right">{t("bud.actual")}</th>
                  <th className="px-2 py-2 text-right">{t("bud.variance")}</th>
                  <th className="px-2 py-2 text-right">{t("bud.used")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {d.rows.map((r) => (
                  <tr key={r.accountCode}>
                    <td className="px-2 py-1.5">{r.accountName}</td>
                    <td className="px-2 py-1.5 text-right">{formatMoney(r.budget)}</td>
                    <td className="px-2 py-1.5 text-right">{formatMoney(r.actual)}</td>
                    <td className="px-2 py-1.5 text-right">
                      <span className={r.favourable ? "text-green-600" : "text-red-600"}>{formatMoney(r.variance)}</span>
                    </td>
                    <td className="px-2 py-1.5 text-right">
                      <Badge color={r.usedPct > 100 ? "red" : r.usedPct > 85 ? "amber" : "green"}>{r.usedPct}%</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-slate-300 font-semibold dark:border-slate-600">
                  <td className="px-2 py-2">{t("bud.total")}</td>
                  <td className="px-2 py-2 text-right">{formatMoney(d.totals.budget)}</td>
                  <td className="px-2 py-2 text-right">{formatMoney(d.totals.actual)}</td>
                  <td className="px-2 py-2" colSpan={2}></td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}

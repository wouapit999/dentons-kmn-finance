"use client";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button, Input, Card, Badge } from "@/components/ui";
import { useT } from "@/lib/useT";
import { usePerms, getJson } from "@/lib/usePerms";
import { formatMoney } from "@/lib/money";

interface Run {
  id: string;
  period: string;
  status: string;
  grossTotal: number;
  netTotal: number;
  employees: number;
  posted: boolean;
}
interface RunDetail {
  id: string;
  period: string;
  status: string;
  posted: boolean;
  totals: Record<string, number>;
  payslips: { employee: string; gross: number; cnpsEmployee: number; irpp: number; cac: number; crtv: number; cfcEmployee: number; net: number }[];
}

export default function PayrollPage() {
  const t = useT();
  const { can } = usePerms();
  const qc = useQueryClient();
  const [period, setPeriod] = useState("");
  const [viewId, setViewId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const runs = useQuery({
    queryKey: ["payroll"],
    queryFn: () => getJson<Run[]>("/api/payroll"),
  });

  const createRun = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/payroll", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ period }),
      });
      if (!res.ok) { const b = await res.json().catch(() => ({})); throw new Error(b.error || "failed"); }
    },
    onSuccess: () => { setPeriod(""); setError(null); qc.invalidateQueries({ queryKey: ["payroll"] }); },
    onError: (e: Error) => setError(e.message),
  });

  const post = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/payroll/${id}/post`, { method: "POST" });
      if (!res.ok) throw new Error();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["payroll"] }),
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">{t("pr.title")}</h1>
        <p className="text-sm text-slate-500">{t("pr.subtitle")}</p>
      </div>

      <Card className="p-5">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">{t("pr.new")}</h2>
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex-1 min-w-[200px]">
            <label className="mb-1 block text-xs font-medium">{t("pr.period")}</label>
            <Input placeholder="July 2026" value={period} onChange={(e) => setPeriod(e.target.value)} />
          </div>
          {can("payroll:manage") && <Button disabled={period.length < 3 || createRun.isPending} onClick={() => createRun.mutate()}>{t("pr.new")}</Button>}
        </div>
        {error && <p className="mt-2 text-sm text-red-600">{error === "no_active_employees" ? "Add employees first." : error}</p>}
      </Card>

      <Card className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500 dark:bg-slate-800/50">
            <tr>
              <th className="px-4 py-3">{t("pr.period")}</th>
              <th className="px-4 py-3">{t("pr.employees")}</th>
              <th className="px-4 py-3 text-right">{t("pr.gross")}</th>
              <th className="px-4 py-3 text-right">{t("pr.net")}</th>
              <th className="px-4 py-3">{t("inv.status")}</th>
              <th className="px-4 py-3 text-right">{t("common.actions")}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {runs.isLoading && (
              <tr><td colSpan={6} className="px-4 py-6 text-center text-slate-400">{t("common.loading")}</td></tr>
            )}
            {runs.data?.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-6 text-center text-slate-400">—</td></tr>
            )}
            {runs.data?.map((r) => (
              <tr key={r.id}>
                <td className="px-4 py-2.5 font-medium">{r.period}</td>
                <td className="px-4 py-2.5 text-slate-500">{r.employees}</td>
                <td className="px-4 py-2.5 text-right">{formatMoney(r.grossTotal)}</td>
                <td className="px-4 py-2.5 text-right font-medium">{formatMoney(r.netTotal)}</td>
                <td className="px-4 py-2.5"><Badge color={r.posted ? "brand" : "slate"}>{r.status}</Badge></td>
                <td className="px-4 py-2.5">
                  <div className="flex justify-end gap-2">
                    <Button size="sm" variant="outline" onClick={() => setViewId(r.id)}>{t("pr.view")}</Button>
                    {!r.posted && can("payroll:post") && (
                      <Button size="sm" disabled={post.isPending} onClick={() => post.mutate(r.id)}>{t("pr.post")}</Button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      {viewId && <RunDetailDialog id={viewId} onClose={() => setViewId(null)} />}
    </div>
  );
}

function RunDetailDialog({ id, onClose }: { id: string; onClose: () => void }) {
  const t = useT();
  const detail = useQuery({
    queryKey: ["payroll", id],
    queryFn: () => getJson<RunDetail>(`/api/payroll/${id}`),
  });
  const d = detail.data;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <Card className="max-h-[90vh] w-full max-w-4xl overflow-y-auto p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">{t("pr.title")} · {d?.period ?? ""}</h2>
          <Button size="sm" variant="ghost" onClick={onClose}>✕</Button>
        </div>
        {!d ? (
          <p className="text-slate-400">{t("common.loading")}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-2 py-2">Employee</th>
                  <th className="px-2 py-2 text-right">Gross</th>
                  <th className="px-2 py-2 text-right">CNPS</th>
                  <th className="px-2 py-2 text-right">IRPP</th>
                  <th className="px-2 py-2 text-right">CAC</th>
                  <th className="px-2 py-2 text-right">CRTV</th>
                  <th className="px-2 py-2 text-right">CFC</th>
                  <th className="px-2 py-2 text-right">Net</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {d.payslips.map((p, i) => (
                  <tr key={i}>
                    <td className="px-2 py-1.5">{p.employee}</td>
                    <td className="px-2 py-1.5 text-right">{formatMoney(p.gross)}</td>
                    <td className="px-2 py-1.5 text-right">{formatMoney(p.cnpsEmployee)}</td>
                    <td className="px-2 py-1.5 text-right">{formatMoney(p.irpp)}</td>
                    <td className="px-2 py-1.5 text-right">{formatMoney(p.cac)}</td>
                    <td className="px-2 py-1.5 text-right">{formatMoney(p.crtv)}</td>
                    <td className="px-2 py-1.5 text-right">{formatMoney(p.cfcEmployee)}</td>
                    <td className="px-2 py-1.5 text-right font-medium">{formatMoney(p.net)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-slate-300 font-semibold dark:border-slate-600">
                  <td className="px-2 py-2">{t("pr.totals")}</td>
                  <td className="px-2 py-2 text-right">{formatMoney(d.totals.gross)}</td>
                  <td className="px-2 py-2 text-right">{formatMoney(d.totals.cnpsEmployee)}</td>
                  <td className="px-2 py-2 text-right">{formatMoney(d.totals.irpp)}</td>
                  <td className="px-2 py-2 text-right">{formatMoney(d.totals.cac)}</td>
                  <td className="px-2 py-2 text-right">{formatMoney(d.totals.crtv)}</td>
                  <td className="px-2 py-2 text-right">{formatMoney(d.totals.cfcEmployee)}</td>
                  <td className="px-2 py-2 text-right">{formatMoney(d.totals.net)}</td>
                </tr>
              </tfoot>
            </table>
            <p className="mt-3 text-xs text-slate-400">
              Employer charges (CNPS + Crédit Foncier + FNE): {formatMoney(d.totals.employerCharges)}
            </p>
          </div>
        )}
      </Card>
    </div>
  );
}

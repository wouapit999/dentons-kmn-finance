"use client";
import { useQuery } from "@tanstack/react-query";
import { Card, Badge } from "@/components/ui";
import { useT } from "@/lib/useT";
import { formatMoney } from "@/lib/money";

interface Insights {
  duplicates: { supplier: string; amount: number; bills: string[] }[];
  forecast: {
    inflow: { d30: number; d60: number; d90: number; beyond: number };
    outflow: { d30: number; d60: number; d90: number; beyond: number };
    net: { d30: number; d60: number; d90: number };
  };
  alerts: { overdueInvoiceCount: number; overdueInvoiceAmount: number; duplicateBillCount: number };
}

export default function InsightsPage() {
  const t = useT();
  const q = useQuery({ queryKey: ["insights"], queryFn: async () => (await fetch("/api/insights")).json() as Promise<Insights> });
  const d = q.data;

  return (
    <div className="space-y-6">
      <div><h1 className="text-2xl font-semibold">{t("ins.title")}</h1><p className="text-sm text-slate-500">{t("ins.subtitle")}</p></div>

      {!d ? <p className="text-slate-400">{t("common.loading")}</p> : (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Card className="p-5"><div className="text-3xl font-semibold">{d.alerts.overdueInvoiceCount}</div><div className="mt-1 text-sm text-slate-500">{t("ins.overdue")} · {formatMoney(d.alerts.overdueInvoiceAmount)}</div></Card>
            <Card className="p-5"><div className="text-3xl font-semibold">{d.alerts.duplicateBillCount}</div><div className="mt-1 text-sm text-slate-500">{t("ins.duplicates")}</div></Card>
            <Card className="p-5"><div className="text-3xl font-semibold">{formatMoney(d.forecast.net.d30)}</div><div className="mt-1 text-sm text-slate-500">{t("ins.forecast")} · 30d</div></Card>
          </div>

          <Card className="p-5">
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">{t("ins.forecast")}</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-xs uppercase tracking-wide text-slate-500"><tr><th className="px-2 py-2"></th><th className="px-2 py-2 text-right">0–30d</th><th className="px-2 py-2 text-right">31–60d</th><th className="px-2 py-2 text-right">61–90d</th></tr></thead>
                <tbody>
                  <tr><td className="px-2 py-1.5 text-green-600">{t("ins.inflow")}</td><td className="px-2 py-1.5 text-right">{formatMoney(d.forecast.inflow.d30)}</td><td className="px-2 py-1.5 text-right">{formatMoney(d.forecast.inflow.d60)}</td><td className="px-2 py-1.5 text-right">{formatMoney(d.forecast.inflow.d90)}</td></tr>
                  <tr><td className="px-2 py-1.5 text-red-600">{t("ins.outflow")}</td><td className="px-2 py-1.5 text-right">{formatMoney(d.forecast.outflow.d30)}</td><td className="px-2 py-1.5 text-right">{formatMoney(d.forecast.outflow.d60)}</td><td className="px-2 py-1.5 text-right">{formatMoney(d.forecast.outflow.d90)}</td></tr>
                  <tr className="border-t border-slate-200 font-semibold dark:border-slate-700"><td className="px-2 py-1.5">Net</td><td className="px-2 py-1.5 text-right">{formatMoney(d.forecast.net.d30)}</td><td className="px-2 py-1.5 text-right">{formatMoney(d.forecast.net.d60)}</td><td className="px-2 py-1.5 text-right">{formatMoney(d.forecast.net.d90)}</td></tr>
                </tbody>
              </table>
            </div>
          </Card>

          <Card className="p-5">
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">{t("ins.duplicates")}</h2>
            {d.duplicates.length === 0 ? <p className="text-sm text-slate-400">{t("ins.none")}</p> : (
              <div className="space-y-2">
                {d.duplicates.map((dup, i) => (
                  <div key={i} className="flex items-center justify-between rounded-md border border-amber-200 bg-amber-50 p-3 text-sm dark:border-amber-900/40 dark:bg-amber-900/20">
                    <span>{dup.supplier} · {dup.bills.join(" ↔ ")}</span>
                    <Badge color="amber">{formatMoney(dup.amount)}</Badge>
                  </div>
                ))}
              </div>
            )}
          </Card>

          <p className="text-xs text-slate-400">
            These analytics are computed deterministically from your ledger data. Invoice/receipt
            OCR and natural-language reporting require connecting an external AI provider
            (e.g. the Claude API) — a documented extension point, not yet wired in.
          </p>
        </>
      )}
    </div>
  );
}

"use client";
/*
 * Dentons KMN ERP
 * Copyright (c) 2026 Bouquet Innovation SA. All rights reserved.
 * Proprietary and confidential. Unauthorised copying, distribution, modification,
 * or use of this file, via any medium, is strictly prohibited.
 */
import { useQuery } from "@tanstack/react-query";
import { Card, Badge } from "@/components/ui";
import { useT } from "@/lib/useT";
import { formatMoney } from "@/lib/money";

interface Analytics {
  firm: {
    billedYear: number; collectedYear: number; collectionRatePct: number;
    outstanding: number; overdue: number; wip: number;
    recordedValueYear: number; realizationPct: number; billableSharePct: number;
    openMatters: number; clients: number;
  };
  pipeline: Record<string, { count: number; total: number }>;
  months: { month: string; billed: number; collected: number }[];
  topWip: { matter: string; amount: number }[];
  feeEarners: { name: string; hours: number; value: number; me: boolean }[];
  me: { monthHours: number; monthBillableHours: number; monthValue: number; utilisationPct: number };
}

function Stat({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: string }) {
  return (
    <Card className="p-4">
      <div className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</div>
      <div className={"mt-1 text-2xl font-semibold " + (tone ?? "")}>{value}</div>
      {sub && <div className="mt-0.5 text-xs text-slate-400">{sub}</div>}
    </Card>
  );
}

export default function AnalyticsPage() {
  const t = useT();
  const q = useQuery({
    queryKey: ["analytics"],
    queryFn: async () => {
      const res = await fetch("/api/analytics");
      if (!res.ok) throw new Error("failed");
      return (await res.json()) as Analytics;
    },
  });

  if (q.isLoading) return <p className="text-sm text-slate-400">{t("common.loading")}</p>;
  if (q.isError || !q.data) return <p className="text-sm text-red-600">{t("an.loadError")}</p>;
  const d = q.data;
  const maxMonth = Math.max(1, ...d.months.map((m) => Math.max(m.billed, m.collected)));
  const pipelineOrder = ["DRAFT", "IN_REVIEW", "APPROVED", "REJECTED", "BILLED"];
  const maxEarner = Math.max(1, ...d.feeEarners.map((f) => f.value));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">{t("an.title")}</h1>
        <p className="text-sm text-slate-500">{t("an.subtitle")}</p>
      </div>

      {/* Personal block */}
      <Card className="bg-gradient-to-br from-brand-500/10 to-cmr-green/10 p-5">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">{t("an.myMonth")}</h2>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div><div className="text-xs text-slate-500">{t("an.myHours")}</div><div className="text-xl font-semibold">{d.me.monthHours}h</div></div>
          <div><div className="text-xs text-slate-500">{t("an.myBillable")}</div><div className="text-xl font-semibold">{d.me.monthBillableHours}h</div></div>
          <div><div className="text-xs text-slate-500">{t("an.myValue")}</div><div className="text-xl font-semibold">{formatMoney(d.me.monthValue)}</div></div>
          <div><div className="text-xs text-slate-500">{t("an.myUtil")}</div><div className="text-xl font-semibold">{d.me.utilisationPct}%</div></div>
        </div>
      </Card>

      {/* Firm KPIs */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label={t("an.billedYtd")} value={formatMoney(d.firm.billedYear)} />
        <Stat label={t("an.collectedYtd")} value={formatMoney(d.firm.collectedYear)} sub={`${d.firm.collectionRatePct}% ${t("an.collectionRate")}`} />
        <Stat label={t("an.wip")} value={formatMoney(d.firm.wip)} sub={t("an.wipSub")} />
        <Stat label={t("an.outstanding")} value={formatMoney(d.firm.outstanding)} sub={`${formatMoney(d.firm.overdue)} ${t("an.overdue")}`} tone={d.firm.overdue > 0 ? "text-red-600" : ""} />
        <Stat label={t("an.realization")} value={`${d.firm.realizationPct}%`} sub={t("an.realizationSub")} />
        <Stat label={t("an.billableShare")} value={`${d.firm.billableSharePct}%`} sub={t("an.billableShareSub")} />
        <Stat label={t("an.openMatters")} value={String(d.firm.openMatters)} />
        <Stat label={t("an.clients")} value={String(d.firm.clients)} />
      </div>

      {/* Monthly trend */}
      <Card className="p-5">
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-500">{t("an.trend")}</h2>
        <div className="flex items-end gap-2 overflow-x-auto pb-2" style={{ minHeight: 180 }}>
          {d.months.map((m) => (
            <div key={m.month} className="flex min-w-[36px] flex-1 flex-col items-center gap-1">
              <div className="flex h-40 w-full items-end justify-center gap-0.5">
                <div className="w-1/2 rounded-t bg-brand-500" style={{ height: `${(m.billed / maxMonth) * 100}%` }} title={`${t("an.billed")}: ${formatMoney(m.billed)}`} />
                <div className="w-1/2 rounded-t bg-cmr-green" style={{ height: `${(m.collected / maxMonth) * 100}%` }} title={`${t("an.collected")}: ${formatMoney(m.collected)}`} />
              </div>
              <div className="text-[10px] text-slate-400">{m.month.slice(5)}</div>
            </div>
          ))}
        </div>
        <div className="mt-2 flex gap-4 text-xs text-slate-500">
          <span className="flex items-center gap-1"><span className="inline-block h-2.5 w-2.5 rounded bg-brand-500" />{t("an.billed")}</span>
          <span className="flex items-center gap-1"><span className="inline-block h-2.5 w-2.5 rounded bg-cmr-green" />{t("an.collected")}</span>
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Fee earner performance */}
        <Card className="p-5">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-500">{t("an.feeEarners")}</h2>
          <div className="space-y-2">
            {d.feeEarners.length === 0 && <p className="text-sm text-slate-400">—</p>}
            {d.feeEarners.map((f) => (
              <div key={f.name}>
                <div className="mb-0.5 flex justify-between text-sm">
                  <span className={f.me ? "font-semibold text-brand-700 dark:text-brand-300" : ""}>{f.name}{f.me && ` · ${t("an.you")}`}</span>
                  <span className="text-slate-500">{f.hours}h · {formatMoney(f.value)}</span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                  <div className={"h-full rounded-full " + (f.me ? "bg-brand-600" : "bg-brand-400")} style={{ width: `${(f.value / maxEarner) * 100}%` }} />
                </div>
              </div>
            ))}
          </div>
        </Card>

        {/* Proforma pipeline + top WIP */}
        <div className="space-y-6">
          <Card className="p-5">
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">{t("an.pipeline")}</h2>
            <div className="space-y-1.5 text-sm">
              {pipelineOrder.map((s) => {
                const v = d.pipeline[s];
                if (!v) return null;
                return (
                  <div key={s} className="flex items-center justify-between">
                    <span className="flex items-center gap-2"><Badge color={s === "APPROVED" ? "green" : s === "IN_REVIEW" ? "amber" : s === "REJECTED" ? "red" : s === "BILLED" ? "brand" : "slate"}>{t(("pf.st." + s) as never)}</Badge><span className="text-slate-500">{v.count}</span></span>
                    <span>{formatMoney(v.total)}</span>
                  </div>
                );
              })}
              {Object.keys(d.pipeline).length === 0 && <p className="text-slate-400">{t("an.noPipeline")}</p>}
            </div>
          </Card>

          <Card className="p-5">
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">{t("an.topWip")}</h2>
            <div className="space-y-1.5 text-sm">
              {d.topWip.length === 0 && <p className="text-slate-400">—</p>}
              {d.topWip.map((w) => (
                <div key={w.matter} className="flex justify-between">
                  <span className="truncate pr-2 text-slate-600 dark:text-slate-300">{w.matter}</span>
                  <span className="font-medium">{formatMoney(w.amount)}</span>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

"use client";
/*
 * Dentons KMN ERP
 * Copyright (c) 2026 Bouquet Innovation SA. All rights reserved.
 * Proprietary and confidential. Unauthorised copying, distribution, modification,
 * or use of this file, via any medium, is strictly prohibited.
 */
// Centralised diary: a personal dashboard of time recorded today and this week,
// what is still unbilled, open timers, and a 14-day trend.
import { useQuery } from "@tanstack/react-query";
import { Card, Badge } from "@/components/ui";
import { useT } from "@/lib/useT";
import { getJson } from "@/lib/usePerms";
import { formatMoney } from "@/lib/money";

interface Diary {
  today: { minutes: number; billableMinutes: number };
  week: { start: string; minutes: number; billableMinutes: number; nonBillableMinutes: number; utilisationPct: number };
  unbilled: { minutes: number; amount: number; entries: number; byMatter: { matter: string; minutes: number; amount: number }[] };
  openTimers: { id: string; status: string; matter: string | null; narrative: string | null; elapsedSec: number }[];
  trend: { day: string; minutes: number; billableMinutes: number }[];
}

const hrs = (m: number) => (m / 60).toFixed(1);

export function DiaryPanel() {
  const t = useT();
  const q = useQuery({ queryKey: ["diary"], queryFn: () => getJson<Diary>("/api/time/diary") });
  const d = q.data;

  if (q.isLoading) return <p className="text-sm text-slate-400">{t("common.loading")}</p>;
  if (!d) return <p className="text-sm text-slate-400">—</p>;

  const peak = Math.max(60, ...d.trend.map((x) => x.minutes));
  const stats = [
    { label: t("diary.today"), value: `${hrs(d.today.minutes)}h`, sub: `${hrs(d.today.billableMinutes)}h ${t("diary.billable")}`, tone: "text-brand-600 dark:text-brand-200" },
    { label: t("diary.week"), value: `${hrs(d.week.minutes)}h`, sub: `${hrs(d.week.billableMinutes)}h ${t("diary.billable")}`, tone: "text-slate-900 dark:text-white" },
    { label: t("diary.utilisation"), value: `${d.week.utilisationPct}%`, sub: t("diary.ofTarget"), tone: "text-cmr-green" },
    { label: t("diary.unbilled"), value: formatMoney(d.unbilled.amount), sub: `${hrs(d.unbilled.minutes)}h · ${d.unbilled.entries} ${t("diary.entries")}`, tone: "text-cmr-red" },
  ];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {stats.map((s) => (
          <Card key={s.label} className="p-4">
            <div className="text-xs font-medium uppercase tracking-wide text-slate-500">{s.label}</div>
            <div className={`mt-1 text-2xl font-semibold ${s.tone}`}>{s.value}</div>
            <div className="mt-0.5 text-xs text-slate-400">{s.sub}</div>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* 14-day trend */}
        <Card className="p-4 lg:col-span-2">
          <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">{t("diary.trend")}</h3>
          <div className="flex h-32 items-end gap-1.5">
            {d.trend.map((x) => {
              const h = Math.round((x.minutes / peak) * 100);
              const bh = x.minutes ? Math.round((x.billableMinutes / x.minutes) * h) : 0;
              return (
                <div key={x.day} className="group relative flex-1" title={`${x.day}: ${hrs(x.minutes)}h (${hrs(x.billableMinutes)}h billable)`}>
                  <div className="relative w-full rounded-t bg-slate-200 dark:bg-slate-700" style={{ height: `${Math.max(2, h)}%` }}>
                    <div className="absolute bottom-0 w-full rounded-t bg-gradient-to-t from-brand-700 to-brand-400" style={{ height: `${bh}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
          <div className="mt-2 flex justify-between text-[10px] text-slate-400">
            <span>{d.trend[0]?.day.slice(5)}</span>
            <span>{t("diary.billableShaded")}</span>
            <span>{d.trend[d.trend.length - 1]?.day.slice(5)}</span>
          </div>
        </Card>

        {/* Open timers */}
        <Card className="p-4">
          <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">{t("diary.openTimers")}</h3>
          {d.openTimers.length === 0 ? (
            <p className="text-sm text-slate-400">{t("timer.none")}</p>
          ) : (
            <ul className="space-y-2">
              {d.openTimers.map((x) => (
                <li key={x.id} className="flex items-center justify-between gap-2 text-sm">
                  <span className="min-w-0 truncate">{x.matter ?? t("timer.noMatter")}</span>
                  <span className="flex shrink-0 items-center gap-2">
                    <span className="font-mono tabular-nums">{hrs(Math.round(x.elapsedSec / 60))}h</span>
                    <Badge color={x.status === "RUNNING" ? "green" : "amber"}>{x.status}</Badge>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      {/* Pending / billable by matter */}
      <Card className="p-4">
        <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">{t("diary.pendingByMatter")}</h3>
        {d.unbilled.byMatter.length === 0 ? (
          <p className="text-sm text-slate-400">{t("diary.nothingPending")}</p>
        ) : (
          <div className="space-y-2">
            {d.unbilled.byMatter.map((m) => {
              const pct = Math.round((m.minutes / (d.unbilled.minutes || 1)) * 100);
              return (
                <div key={m.matter}>
                  <div className="flex items-center justify-between text-sm">
                    <span className="min-w-0 truncate pr-2">{m.matter}</span>
                    <span className="shrink-0 tabular-nums text-slate-500">
                      {hrs(m.minutes)}h · {formatMoney(m.amount)}
                    </span>
                  </div>
                  <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                    <div className="h-full rounded-full bg-gradient-to-r from-brand-400 to-brand-700" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
}

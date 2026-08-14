"use client";
/*
 * Dentons KMN ERP
 * Copyright (c) 2026 Bouquet Innovation SA. All rights reserved.
 * Proprietary and confidential. Unauthorised copying, distribution, modification,
 * or use of this file, via any medium, is strictly prohibited.
 */
// Flexible time entry: a weekly grid (matters x days). Type minutes into cells
// and save the whole week in one call. Billed rows are locked. On small screens
// the grid scrolls horizontally with the matter column pinned.
import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, Plus, Save } from "lucide-react";
import { Button, Card } from "@/components/ui";
import { useT } from "@/lib/useT";
import { getJson } from "@/lib/usePerms";

interface Cell { id: string; minutes: number; billable: boolean; narrative: string | null; locked: boolean }
interface Row { matterId: string; matter: string; cells: Record<string, Cell> }
interface WeekData {
  start: string;
  days: string[];
  rows: Row[];
  totals: { minutes: number; billableMinutes: number; nonBillableMinutes: number; byDay: { day: string; minutes: number }[] };
}
interface MatterOpt { id: string; code: string; name: string }

const hrs = (m: number) => (m / 60).toFixed(2);
const shiftWeek = (iso: string, weeks: number) => {
  const d = new Date(iso + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + weeks * 7);
  return d.toISOString().slice(0, 10);
};

export function WeekGrid({ matters, canLog }: { matters: MatterOpt[]; canLog: boolean }) {
  const t = useT();
  const qc = useQueryClient();
  const [start, setStart] = useState<string>(() => new Date().toISOString().slice(0, 10));
  // Local edits: `${matterId}|${day}` -> minutes
  const [edits, setEdits] = useState<Record<string, number>>({});
  const [extraMatters, setExtraMatters] = useState<string[]>([]);
  const [msg, setMsg] = useState<string | null>(null);

  const week = useQuery({
    queryKey: ["week", start],
    queryFn: () => getJson<WeekData>(`/api/time/week?start=${start}`),
  });

  // Clear pending edits whenever a different week loads.
  useEffect(() => { setEdits({}); setExtraMatters([]); }, [start]);

  const data = week.data;
  const rows = useMemo(() => {
    const base = data?.rows ?? [];
    const extra = extraMatters
      .filter((id) => !base.some((r) => r.matterId === id))
      .map((id) => {
        const m = matters.find((x) => x.id === id);
        return { matterId: id, matter: m ? `${m.code} — ${m.name}` : id, cells: {} as Record<string, Cell> };
      });
    return [...base, ...extra];
  }, [data, extraMatters, matters]);

  const cellValue = (r: Row, day: string) => {
    const k = `${r.matterId}|${day}`;
    if (k in edits) return edits[k];
    return r.cells[day]?.minutes ?? 0;
  };

  const save = useMutation({
    mutationFn: async () => {
      const payload = Object.entries(edits).map(([k, minutes]) => {
        const [matterId, date] = k.split("|");
        const row = rows.find((r) => r.matterId === matterId);
        const existing = row?.cells[date];
        return {
          id: existing?.id,
          matterId,
          date,
          minutes,
          billable: existing?.billable ?? true,
          narrative: existing?.narrative ?? undefined,
        };
      });
      const res = await fetch("/api/time/week", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entries: payload }),
      });
      const b = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((b as { error?: string }).error || "failed");
      return b as { created: number; updated: number; deleted: number };
    },
    onSuccess: (b) => {
      setEdits({});
      setMsg(`${t("week.saved")} (+${b.created} / ~${b.updated} / -${b.deleted})`);
      qc.invalidateQueries({ queryKey: ["week"] });
      qc.invalidateQueries({ queryKey: ["time"] });
      qc.invalidateQueries({ queryKey: ["diary"] });
    },
    onError: (e: Error) => setMsg(e.message),
  });

  const dayTotal = (day: string) =>
    rows.reduce((s, r) => s + cellValue(r, day), 0);
  const grandTotal = rows.reduce((s, r) => s + (data?.days ?? []).reduce((a, d) => a + cellValue(r, d), 0), 0);
  const dirty = Object.keys(edits).length > 0;

  return (
    <Card className="p-4 sm:p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={() => setStart(shiftWeek(start, -1))} aria-label={t("week.prev")}>
            <ChevronLeft size={15} />
          </Button>
          <span className="text-sm font-medium">
            {t("week.weekOf")} {data?.start ?? "—"}
          </span>
          <Button size="sm" variant="outline" onClick={() => setStart(shiftWeek(start, 1))} aria-label={t("week.next")}>
            <ChevronRight size={15} />
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setStart(new Date().toISOString().slice(0, 10))}>
            {t("week.thisWeek")}
          </Button>
        </div>
        {canLog && (
          <Button size="sm" disabled={!dirty || save.isPending} onClick={() => save.mutate()}>
            <Save size={15} /> {t("week.save")}
          </Button>
        )}
      </div>

      {week.isLoading ? (
        <p className="text-sm text-slate-400">{t("common.loading")}</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-slate-500">
                <th className="sticky left-0 z-10 bg-white px-2 py-2 dark:bg-slate-900">{t("time.matter")}</th>
                {(data?.days ?? []).map((d) => (
                  <th key={d} className="px-2 py-2 text-center">
                    <div>{new Date(d + "T00:00:00Z").toLocaleDateString(undefined, { weekday: "short", timeZone: "UTC" })}</div>
                    <div className="font-normal text-slate-400">{d.slice(5)}</div>
                  </th>
                ))}
                <th className="px-2 py-2 text-right">{t("week.total")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {rows.length === 0 && (
                <tr><td colSpan={9} className="px-2 py-6 text-center text-slate-400">{t("week.empty")}</td></tr>
              )}
              {rows.map((r) => {
                const rowTotal = (data?.days ?? []).reduce((a, d) => a + cellValue(r, d), 0);
                return (
                  <tr key={r.matterId}>
                    <td className="sticky left-0 z-10 max-w-[220px] truncate bg-white px-2 py-1.5 font-medium dark:bg-slate-900" title={r.matter}>
                      {r.matter}
                    </td>
                    {(data?.days ?? []).map((d) => {
                      const locked = r.cells[d]?.locked;
                      return (
                        <td key={d} className="px-1 py-1 text-center">
                          <input
                            type="number"
                            min={0}
                            step={6}
                            inputMode="numeric"
                            disabled={!canLog || locked}
                            value={cellValue(r, d) || ""}
                            placeholder="0"
                            title={locked ? t("week.locked") : undefined}
                            onChange={(e) =>
                              setEdits((prev) => ({ ...prev, [`${r.matterId}|${d}`]: Math.max(0, Number(e.target.value) || 0) }))
                            }
                            className={`h-9 w-16 rounded-md border px-1 text-center text-sm tabular-nums outline-none focus:border-brand disabled:opacity-60 ${
                              locked
                                ? "border-slate-200 bg-slate-100 dark:border-slate-700 dark:bg-slate-800"
                                : "border-slate-300 bg-white dark:border-slate-700 dark:bg-slate-900"
                            }`}
                          />
                        </td>
                      );
                    })}
                    <td className="px-2 py-1.5 text-right font-medium tabular-nums">{hrs(rowTotal)}h</td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-slate-300 font-semibold dark:border-slate-600">
                <td className="sticky left-0 z-10 bg-white px-2 py-2 dark:bg-slate-900">{t("week.total")}</td>
                {(data?.days ?? []).map((d) => (
                  <td key={d} className="px-2 py-2 text-center tabular-nums">{hrs(dayTotal(d))}</td>
                ))}
                <td className="px-2 py-2 text-right tabular-nums">{hrs(grandTotal)}h</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      {canLog && (
        <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-slate-200/70 pt-3 dark:border-slate-800/70">
          <Plus size={14} className="text-slate-400" />
          <select
            className="h-9 rounded-md border border-slate-300 bg-white px-2 text-sm dark:border-slate-700 dark:bg-slate-900"
            value=""
            onChange={(e) => { if (e.target.value) setExtraMatters((p) => [...p, e.target.value]); }}
          >
            <option value="">{t("week.addMatter")}</option>
            {matters
              .filter((m) => !rows.some((r) => r.matterId === m.id))
              .map((m) => <option key={m.id} value={m.id}>{m.code} — {m.name}</option>)}
          </select>
          <span className="text-xs text-slate-400">{t("week.hint")}</span>
        </div>
      )}
      {msg && <p className="mt-2 text-sm text-slate-500">{msg}</p>}
    </Card>
  );
}

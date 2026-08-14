"use client";
/*
 * Dentons KMN ERP
 * Copyright (c) 2026 Bouquet Innovation SA. All rights reserved.
 * Proprietary and confidential. Unauthorised copying, distribution, modification,
 * or use of this file, via any medium, is strictly prohibited.
 */
// Embedded timers: start/pause/resume a live stopwatch and book it as time.
// Elapsed time is derived from the server's runningSince, so it stays correct
// across reloads, sleeps and devices. Also offers one-tap quick capture for
// short work (e.g. answering an email).
import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Play, Pause, Square, Trash2, Timer as TimerIcon, Zap } from "lucide-react";
import { Button, Input, Card, Badge } from "@/components/ui";
import { useT } from "@/lib/useT";
import { getJson } from "@/lib/usePerms";

interface TimerRow {
  id: string;
  status: string;
  source: string;
  narrative: string | null;
  matterId: string | null;
  matter: string | null;
  elapsedSec: number;
  billableMinutes: number;
  runningSince: string | null;
  accumulatedSec: number;
}
interface MatterOpt { id: string; code: string; name: string }

function fmt(sec: number) {
  const s = Math.max(0, Math.floor(sec));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = s % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(ss).padStart(2, "0")}`;
}
// Live seconds for a row: banked + (now - runningSince) when running.
function liveSeconds(t: TimerRow, nowMs: number) {
  if (t.status !== "RUNNING" || !t.runningSince) return t.accumulatedSec;
  return t.accumulatedSec + Math.max(0, Math.floor((nowMs - Date.parse(t.runningSince)) / 1000));
}

export function TimerPanel({ matters }: { matters: MatterOpt[] }) {
  const t = useT();
  const qc = useQueryClient();
  const [now, setNow] = useState(() => Date.now());
  const [matterId, setMatterId] = useState("");
  const [narrative, setNarrative] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [logFor, setLogFor] = useState<string | null>(null);

  const timers = useQuery({
    queryKey: ["timers"],
    queryFn: () => getJson<TimerRow[]>("/api/timers"),
    refetchInterval: 60_000,
  });

  // Tick locally once a second; the server remains the source of truth.
  useEffect(() => {
    const running = (timers.data ?? []).some((x) => x.status === "RUNNING");
    if (!running) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [timers.data]);

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["timers"] });
    qc.invalidateQueries({ queryKey: ["time"] });
    qc.invalidateQueries({ queryKey: ["diary"] });
    qc.invalidateQueries({ queryKey: ["week"] });
  };

  const call = async (url: string, body: unknown) => {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const b = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error((b as { error?: string }).error || "failed");
    return b;
  };

  const start = useMutation({
    mutationFn: () => call("/api/timers", { matterId: matterId || undefined, narrative: narrative || undefined, source: "APP" }),
    onSuccess: () => { setNarrative(""); setError(null); refresh(); },
    onError: (e: Error) => setError(e.message),
  });
  const act = useMutation({
    mutationFn: (v: { id: string; body: Record<string, unknown> }) => call(`/api/timers/${v.id}`, v.body),
    onSuccess: () => { setLogFor(null); setError(null); refresh(); },
    onError: (e: Error) => setError(e.message),
  });
  const quick = useMutation({
    mutationFn: (minutes: number) =>
      call("/api/time/quick", { matterId, minutes, narrative: narrative || undefined, billable: true, source: "APP" }),
    onSuccess: () => { setNarrative(""); setError(null); refresh(); },
    onError: (e: Error) => setError(e.message),
  });

  const rows = timers.data ?? [];
  const errText = (e: string) =>
    e === "matter_required" ? t("timer.needMatter")
    : e === "matter_closed" ? t("timer.matterClosed")
    : e === "invalid_matter" ? t("timer.needMatter")
    : e;

  return (
    <div className="space-y-4">
      {/* Start / quick capture */}
      <Card className="p-4 sm:p-5">
        <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-slate-500">
          <TimerIcon size={15} /> {t("timer.new")}
        </h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-12">
          <div className="sm:col-span-5">
            <label className="mb-1 block text-xs font-medium">{t("time.matter")}</label>
            <select
              className="h-10 w-full rounded-md border border-slate-300 bg-white px-2 text-sm dark:border-slate-700 dark:bg-slate-900"
              value={matterId}
              onChange={(e) => setMatterId(e.target.value)}
            >
              <option value="">—</option>
              {matters.map((m) => <option key={m.id} value={m.id}>{m.code} — {m.name}</option>)}
            </select>
          </div>
          <div className="sm:col-span-5">
            <label className="mb-1 block text-xs font-medium">{t("time.narrative")}</label>
            <Input value={narrative} onChange={(e) => setNarrative(e.target.value)} placeholder={t("timer.narrativePlaceholder")} />
          </div>
          <div className="flex items-end sm:col-span-2">
            <Button className="w-full" disabled={start.isPending} onClick={() => start.mutate()}>
              <Play size={15} /> {t("timer.start")}
            </Button>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-slate-200/70 pt-3 dark:border-slate-800/70">
          <span className="flex items-center gap-1.5 text-xs font-medium text-slate-500">
            <Zap size={14} className="text-cmr-yellow" /> {t("timer.quick")}
          </span>
          {[6, 12, 30, 60].map((m) => (
            <Button key={m} size="sm" variant="outline" disabled={!matterId || quick.isPending} onClick={() => quick.mutate(m)}>
              +{m}m
            </Button>
          ))}
          {!matterId && <span className="text-xs text-slate-400">{t("timer.needMatter")}</span>}
        </div>
        {error && <p className="mt-2 text-sm text-red-600">{errText(error)}</p>}
      </Card>

      {/* Open timers */}
      {rows.length === 0 ? (
        <p className="text-sm text-slate-400">{t("timer.none")}</p>
      ) : (
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          {rows.map((row) => {
            const sec = liveSeconds(row, now);
            const running = row.status === "RUNNING";
            return (
              <Card key={row.id} className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className={`font-mono text-2xl font-semibold tabular-nums ${running ? "text-brand-600 dark:text-brand-200" : "text-slate-500"}`}>
                        {fmt(sec)}
                      </span>
                      <Badge color={running ? "green" : "amber"}>{running ? t("timer.running") : t("timer.paused")}</Badge>
                      {row.source !== "APP" && <Badge color="brand">{row.source}</Badge>}
                    </div>
                    <div className="mt-1 truncate text-sm font-medium">{row.matter ?? t("timer.noMatter")}</div>
                    {row.narrative && <div className="truncate text-xs text-slate-500">{row.narrative}</div>}
                    <div className="mt-1 text-xs text-slate-400">
                      {t("timer.willBook")}: {Math.max(6, Math.ceil(sec / 60 / 6) * 6)} {t("timer.min")}
                    </div>
                  </div>
                  <div className="flex shrink-0 flex-col gap-2">
                    {running ? (
                      <Button size="sm" variant="outline" disabled={act.isPending} onClick={() => act.mutate({ id: row.id, body: { action: "pause" } })}>
                        <Pause size={14} /> {t("timer.pause")}
                      </Button>
                    ) : (
                      <Button size="sm" variant="outline" disabled={act.isPending} onClick={() => act.mutate({ id: row.id, body: { action: "resume" } })}>
                        <Play size={14} /> {t("timer.resume")}
                      </Button>
                    )}
                    <Button size="sm" onClick={() => setLogFor(logFor === row.id ? null : row.id)}>
                      <Square size={14} /> {t("timer.log")}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={act.isPending}
                      onClick={() => { if (confirm(t("timer.confirmDiscard"))) act.mutate({ id: row.id, body: { action: "discard" } }); }}
                    >
                      <Trash2 size={14} />
                    </Button>
                  </div>
                </div>

                {logFor === row.id && (
                  <LogForm
                    row={row}
                    matters={matters}
                    defaultMinutes={Math.max(6, Math.ceil(sec / 60 / 6) * 6)}
                    pending={act.isPending}
                    onCancel={() => setLogFor(null)}
                    onSubmit={(body) => act.mutate({ id: row.id, body: { action: "log", ...body } })}
                  />
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

function LogForm({
  row, matters, defaultMinutes, pending, onCancel, onSubmit,
}: {
  row: TimerRow;
  matters: MatterOpt[];
  defaultMinutes: number;
  pending: boolean;
  onCancel: () => void;
  onSubmit: (body: Record<string, unknown>) => void;
}) {
  const t = useT();
  const [minutes, setMinutes] = useState(defaultMinutes);
  const [matter, setMatter] = useState(row.matterId ?? "");
  const [narrative, setNarrative] = useState(row.narrative ?? "");
  const [rate, setRate] = useState(0);
  const [billable, setBillable] = useState(true);

  return (
    <div className="mt-4 grid grid-cols-1 gap-3 border-t border-slate-200/70 pt-3 sm:grid-cols-12 dark:border-slate-800/70">
      {!row.matterId && (
        <div className="sm:col-span-6">
          <label className="mb-1 block text-xs font-medium">{t("time.matter")}</label>
          <select
            className="h-9 w-full rounded-md border border-slate-300 bg-white px-2 text-sm dark:border-slate-700 dark:bg-slate-900"
            value={matter}
            onChange={(e) => setMatter(e.target.value)}
          >
            <option value="">—</option>
            {matters.map((m) => <option key={m.id} value={m.id}>{m.code} — {m.name}</option>)}
          </select>
        </div>
      )}
      <div className="sm:col-span-3">
        <label className="mb-1 block text-xs font-medium">{t("time.minutes")}</label>
        <Input className="h-9" type="number" value={minutes} onChange={(e) => setMinutes(Number(e.target.value))} />
      </div>
      <div className="sm:col-span-3">
        <label className="mb-1 block text-xs font-medium">{t("time.rate")}</label>
        <Input className="h-9" type="number" value={rate} onChange={(e) => setRate(Number(e.target.value))} />
      </div>
      <div className="sm:col-span-3">
        <label className="mb-1 block text-xs font-medium">{t("time.billable")}</label>
        <select
          className="h-9 w-full rounded-md border border-slate-300 bg-white px-2 text-sm dark:border-slate-700 dark:bg-slate-900"
          value={String(billable)}
          onChange={(e) => setBillable(e.target.value === "true")}
        >
          <option value="true">{t("common.yes")}</option>
          <option value="false">{t("common.no")}</option>
        </select>
      </div>
      <div className={row.matterId ? "sm:col-span-9" : "sm:col-span-12"}>
        <label className="mb-1 block text-xs font-medium">{t("time.narrative")}</label>
        <Input className="h-9" value={narrative} onChange={(e) => setNarrative(e.target.value)} />
      </div>
      <div className="flex items-end gap-2 sm:col-span-3">
        <Button
          size="sm"
          className="w-full"
          disabled={pending || minutes <= 0 || (!row.matterId && !matter)}
          onClick={() => onSubmit({ minutes, matterId: matter || undefined, narrative, rate, billable })}
        >
          {t("timer.book")}
        </Button>
        <Button size="sm" variant="ghost" onClick={onCancel}>{t("common.cancel")}</Button>
      </div>
    </div>
  );
}

"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button, Input, Card, Badge } from "@/components/ui";
import { useT } from "@/lib/useT";

interface TaskRow {
  id: string;
  title: string;
  priority: string;
  status: string;
  category: string | null;
  matter: string | null;
  client: string | null;
  dueDate: string | null;
  overdue: boolean;
  assignees: string[];
  subtasks: number;
  comments: number;
  completedAt: string | null;
}
interface Meta {
  categories: { key: string; name: string; isCourtDeadline: boolean }[];
  users: { id: string; fullName: string }[];
  matters: { id: string; code: string; name: string }[];
  clients: { id: string; name: string }[];
}

const prColor = (p: string) =>
  p === "CRITICAL" ? "red" : p === "HIGH" ? "amber" : p === "MEDIUM" ? "brand" : "slate";
const stColor = (s: string) =>
  s === "COMPLETED" ? "green" : s === "IN_PROGRESS" ? "brand" : s === "WAITING" ? "amber" : "slate";

export default function TasksPage() {
  const t = useT();
  const qc = useQueryClient();
  const [creating, setCreating] = useState(false);
  const [mine, setMine] = useState(true);
  const [overdueOnly, setOverdueOnly] = useState(false);
  const [status, setStatus] = useState("");
  const [priority, setPriority] = useState("");
  const [q, setQ] = useState("");

  const params = new URLSearchParams();
  if (mine) params.set("assignee", "me");
  if (overdueOnly) params.set("overdue", "1");
  if (status) params.set("status", status);
  if (priority) params.set("priority", priority);
  if (q) params.set("q", q);

  const tasks = useQuery({
    queryKey: ["tasks", params.toString()],
    queryFn: async () => {
      const res = await fetch(`/api/tasks?${params.toString()}`);
      if (!res.ok) throw new Error();
      return (await res.json()) as TaskRow[];
    },
  });
  // Unfiltered "mine" list drives the KPI cards.
  const mineAll = useQuery({
    queryKey: ["tasks", "kpis"],
    queryFn: async () => {
      const res = await fetch("/api/tasks?assignee=me");
      if (!res.ok) throw new Error();
      return (await res.json()) as TaskRow[];
    },
  });

  const kpis = useMemo(() => {
    const rows = mineAll.data ?? [];
    const now = new Date();
    const sod = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const eod = new Date(sod.getTime() + 86_400_000);
    const open = rows.filter((r) => !["COMPLETED", "ARCHIVED"].includes(r.status));
    return {
      open: open.length,
      dueToday: open.filter(
        (r) => r.dueDate && new Date(r.dueDate) >= sod && new Date(r.dueDate) < eod,
      ).length,
      overdue: open.filter((r) => r.overdue).length,
      done7: rows.filter(
        (r) =>
          r.status === "COMPLETED" &&
          r.completedAt &&
          Date.now() - new Date(r.completedAt).getTime() < 7 * 86_400_000,
      ).length,
    };
  }, [mineAll.data]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">{t("tasks.title")}</h1>
          <p className="text-sm text-slate-500">{t("tasks.subtitle")}</p>
        </div>
        <Button onClick={() => setCreating(true)}>+ {t("tasks.new")}</Button>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[
          [t("tasks.kpi.open"), kpis.open],
          [t("tasks.kpi.dueToday"), kpis.dueToday],
          [t("tasks.kpi.overdue"), kpis.overdue],
          [t("tasks.kpi.done7"), kpis.done7],
        ].map(([label, value]) => (
          <Card key={String(label)} className="p-4">
            <div className="text-2xl font-semibold">{value as number}</div>
            <div className="mt-0.5 text-xs text-slate-500">{label}</div>
          </Card>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" variant={mine ? "primary" : "outline"} onClick={() => setMine(true)}>
          {t("tasks.mine")}
        </Button>
        <Button size="sm" variant={!mine ? "primary" : "outline"} onClick={() => setMine(false)}>
          {t("tasks.all")}
        </Button>
        <Button
          size="sm"
          variant={overdueOnly ? "danger" : "outline"}
          onClick={() => setOverdueOnly((o) => !o)}
        >
          {t("tasks.overdueOnly")}
        </Button>
        <select
          className="h-8 rounded-md border border-slate-300 bg-white px-2 text-sm dark:border-slate-700 dark:bg-slate-900"
          value={status}
          onChange={(e) => setStatus(e.target.value)}
        >
          <option value="">{t("users.status")}: —</option>
          {["DRAFT", "ASSIGNED", "IN_PROGRESS", "WAITING", "COMPLETED", "ARCHIVED"].map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
        <select
          className="h-8 rounded-md border border-slate-300 bg-white px-2 text-sm dark:border-slate-700 dark:bg-slate-900"
          value={priority}
          onChange={(e) => setPriority(e.target.value)}
        >
          <option value="">{t("tasks.priority")}: —</option>
          {["LOW", "MEDIUM", "HIGH", "CRITICAL"].map((p) => (
            <option key={p} value={p}>{p}</option>
          ))}
        </select>
        <Input
          className="h-8 w-52"
          placeholder={t("common.search")}
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </div>

      <Card className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500 dark:bg-slate-800/50">
            <tr>
              <th className="px-4 py-3">{t("tasks.col.task")}</th>
              <th className="px-4 py-3">{t("tasks.category")}</th>
              <th className="px-4 py-3">{t("tasks.col.matter")}</th>
              <th className="px-4 py-3">{t("tasks.col.assignees")}</th>
              <th className="px-4 py-3">{t("tasks.priority")}</th>
              <th className="px-4 py-3">{t("tasks.col.due")}</th>
              <th className="px-4 py-3">{t("users.status")}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {tasks.isLoading && (
              <tr><td colSpan={7} className="px-4 py-6 text-center text-slate-400">{t("common.loading")}</td></tr>
            )}
            {tasks.data?.length === 0 && (
              <tr><td colSpan={7} className="px-4 py-6 text-center text-slate-400">—</td></tr>
            )}
            {tasks.data?.map((r) => (
              <tr key={r.id}>
                <td className="px-4 py-2.5">
                  <Link href={`/tasks/${r.id}`} className="font-medium text-brand hover:underline">
                    {r.title}
                  </Link>
                  {r.subtasks > 0 && (
                    <span className="ml-2 text-xs text-slate-400">☑ {r.subtasks}</span>
                  )}
                  {r.comments > 0 && (
                    <span className="ml-1 text-xs text-slate-400">💬 {r.comments}</span>
                  )}
                </td>
                <td className="px-4 py-2.5 text-slate-500">{r.category ?? "—"}</td>
                <td className="px-4 py-2.5 font-mono text-xs">{r.matter ?? "—"}</td>
                <td className="px-4 py-2.5 text-slate-500">
                  {r.assignees.length ? r.assignees.join(", ") : "—"}
                </td>
                <td className="px-4 py-2.5">
                  <Badge color={prColor(r.priority) as any}>{r.priority}</Badge>
                </td>
                <td className="px-4 py-2.5">
                  {r.dueDate ? (
                    <span className={r.overdue ? "font-semibold text-red-600" : "text-slate-500"}>
                      {new Date(r.dueDate).toLocaleDateString()}
                    </span>
                  ) : ("—")}
                </td>
                <td className="px-4 py-2.5">
                  <Badge color={stColor(r.status) as any}>{r.status}</Badge>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      {creating && (
        <NewTaskDialog
          onClose={() => setCreating(false)}
          onCreated={() => {
            setCreating(false);
            qc.invalidateQueries({ queryKey: ["tasks"] });
          }}
        />
      )}
    </div>
  );
}

function NewTaskDialog({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const t = useT();
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    title: "", description: "", categoryKey: "", priority: "MEDIUM",
    visibility: "PUBLIC", matterId: "", clientId: "", dueDate: "", billable: false,
  });
  const [assignees, setAssignees] = useState<string[]>([]);
  const set = (k: string, v: unknown) => setForm((f) => ({ ...f, [k]: v }));

  const meta = useQuery({
    queryKey: ["tasks-meta"],
    queryFn: async () => (await fetch("/api/tasks/meta")).json() as Promise<Meta>,
  });
  const isCourt = meta.data?.categories.find((c) => c.key === form.categoryKey)?.isCourtDeadline;

  const create = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, assigneeIds: assignees }),
      });
      if (!res.ok) {
        const b = await res.json().catch(() => ({}));
        throw new Error(b.error || "failed");
      }
    },
    onSuccess: onCreated,
    onError: (e: Error) => setError(e.message),
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <Card className="max-h-[90vh] w-full max-w-xl overflow-y-auto p-6">
        <h2 className="mb-4 text-lg font-semibold">{t("tasks.new")}</h2>
        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-sm font-medium">{t("tasks.col.task")}</label>
            <Input value={form.title} onChange={(e) => set("title", e.target.value)} />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">{t("tasks.desc")}</label>
            <Input value={form.description} onChange={(e) => set("description", e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-sm font-medium">{t("tasks.category")}</label>
              <select className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-900"
                value={form.categoryKey} onChange={(e) => set("categoryKey", e.target.value)}>
                <option value="">—</option>
                {meta.data?.categories.map((c) => (
                  <option key={c.key} value={c.key}>{c.name}{c.isCourtDeadline ? " ⚠" : ""}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">{t("tasks.priority")}</label>
              <select className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900"
                value={isCourt ? "CRITICAL" : form.priority} disabled={!!isCourt}
                onChange={(e) => set("priority", e.target.value)}>
                {["LOW", "MEDIUM", "HIGH", "CRITICAL"].map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">{t("tasks.matter")}</label>
              <select className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-900"
                value={form.matterId} onChange={(e) => set("matterId", e.target.value)}>
                <option value="">—</option>
                {meta.data?.matters.map((m) => <option key={m.id} value={m.id}>{m.code} — {m.name}</option>)}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">{t("tasks.client")}</label>
              <select className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-900"
                value={form.clientId} onChange={(e) => set("clientId", e.target.value)}>
                <option value="">—</option>
                {meta.data?.clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">{t("tasks.dueDate")}</label>
              <Input type="date" value={form.dueDate} onChange={(e) => set("dueDate", e.target.value)} />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">{t("tasks.visibility")}</label>
              <select className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-900"
                value={form.visibility} onChange={(e) => set("visibility", e.target.value)}>
                {["PUBLIC", "MATTER", "PRIVATE"].map((v) => <option key={v} value={v}>{v}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">{t("tasks.assignees")}</label>
            <div className="grid max-h-32 grid-cols-2 gap-1 overflow-y-auto rounded-md border border-slate-200 p-2 dark:border-slate-700">
              {meta.data?.users.map((u) => (
                <label key={u.id} className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={assignees.includes(u.id)}
                    onChange={(e) => setAssignees((s) => e.target.checked ? [...s, u.id] : s.filter((x) => x !== u.id))} />
                  {u.fullName}
                </label>
              ))}
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={form.billable}
              onChange={(e) => set("billable", e.target.checked)} />
            {t("tasks.billable")}
          </label>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex justify-end gap-2 pt-1">
            <Button variant="outline" onClick={onClose}>{t("common.cancel")}</Button>
            <Button disabled={form.title.length < 2 || create.isPending} onClick={() => create.mutate()}>
              {t("common.create")}
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}

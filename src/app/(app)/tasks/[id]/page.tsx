"use client";
import { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button, Input, Card, Badge } from "@/components/ui";
import { useT } from "@/lib/useT";
import { getJson } from "@/lib/usePerms";

interface Detail {
  id: string;
  title: string;
  description: string | null;
  priority: string;
  status: string;
  visibility: string;
  category: { name: string; isCourtDeadline: boolean } | null;
  matter: { id: string; code: string; name: string; client: string; responsiblePartner: string | null } | null;
  client: { id: string; name: string } | null;
  parent: { id: string; title: string } | null;
  dueDate: string | null;
  overdue: boolean;
  billable: boolean;
  estimatedMin: number | null;
  loggedMin: number;
  completedAt: string | null;
  canModify: boolean;
  subtasks: { id: string; title: string; status: string }[];
  assignees: { id: string; name: string }[];
  dependencies: { id: string; title: string; status: string }[];
  comments: { id: string; author: string; body: string; createdAt: string }[];
  attachments: { id: string; filename: string; mime: string; sizeBytes: number }[];
  reminders: { id: string; remindAt: string; channel: string; sent: boolean }[];
  activity: { action: string; actor: string; at: string }[];
}

const prColor = (p: string) =>
  p === "CRITICAL" ? "red" : p === "HIGH" ? "amber" : p === "MEDIUM" ? "brand" : "slate";

export default function TaskDetailPage() {
  const t = useT();
  const qc = useQueryClient();
  const { id } = useParams<{ id: string }>();
  const [tab, setTab] = useState<"comments" | "attachments" | "reminders" | "activity">("comments");
  const [error, setError] = useState<string | null>(null);

  const task = useQuery({
    queryKey: ["task", id],
    queryFn: async () => {
      const res = await fetch(`/api/tasks/${id}`);
      if (!res.ok) throw new Error();
      return (await res.json()) as Detail;
    },
  });
  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["task", id] });
    qc.invalidateQueries({ queryKey: ["tasks"] });
  };

  const act = useMutation({
    mutationFn: async (p: { path: string; body?: unknown }) => {
      const res = await fetch(`/api/tasks/${id}${p.path}`, {
        method: p.path === "" ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: p.body === undefined ? undefined : JSON.stringify(p.body),
      });
      if (!res.ok) {
        const b = await res.json().catch(() => ({}));
        throw new Error(b.error || "failed");
      }
    },
    onSuccess: () => { setError(null); refresh(); },
    onError: (e: Error) =>
      setError(
        e.message === "blocked_by_dependencies" ? t("tasks.blocked")
        : e.message === "open_subtasks" ? t("tasks.openSubtasks")
        : e.message,
      ),
  });

  const d = task.data;
  if (!d) return <p className="text-slate-400">{t("common.loading")}</p>;

  const openDeps = d.dependencies.filter((x) => x.status !== "COMPLETED").length;
  const openSubs = d.subtasks.filter((s) => !["COMPLETED", "ARCHIVED"].includes(s.status)).length;
  const active = !["COMPLETED", "ARCHIVED"].includes(d.status);

  return (
    <div className="space-y-6">
      <Link href="/tasks" className="text-sm text-brand hover:underline">← {t("tasks.title")}</Link>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-semibold">{d.title}</h1>
            <Badge color={prColor(d.priority) as any}>{d.priority}</Badge>
            <Badge color={d.status === "COMPLETED" ? "green" : "slate"}>{d.status}</Badge>
            {d.overdue && <Badge color="red">{t("tasks.overdueOnly")}</Badge>}
          </div>
          {d.matter && (
            <p className="mt-1 text-sm text-slate-500">
              <span className="font-mono">{d.matter.code}</span> · {d.matter.client}
              {d.matter.responsiblePartner && <> · {t("tasks.responsible")}: {d.matter.responsiblePartner}</>}
            </p>
          )}
          {d.parent && (
            <p className="mt-1 text-xs text-slate-400">
              ↑ <Link href={`/tasks/${d.parent.id}`} className="hover:underline">{d.parent.title}</Link>
            </p>
          )}
        </div>
        {d.canModify && (
          <div className="flex flex-wrap gap-2">
            {["DRAFT", "ASSIGNED", "WAITING"].includes(d.status) && (
              <Button size="sm" onClick={() => act.mutate({ path: "", body: { status: "IN_PROGRESS" } })}>
                {d.status === "WAITING" ? t("tasks.resume") : t("tasks.start")}
              </Button>
            )}
            {d.status === "IN_PROGRESS" && (
              <Button size="sm" variant="outline" onClick={() => act.mutate({ path: "", body: { status: "WAITING" } })}>
                {t("tasks.wait")}
              </Button>
            )}
            {["IN_PROGRESS", "WAITING"].includes(d.status) && (
              <Button size="sm" disabled={openDeps > 0 || openSubs > 0}
                onClick={() => act.mutate({ path: "/complete" })}>
                {t("tasks.complete")}
              </Button>
            )}
            {d.status === "COMPLETED" && (
              <Button size="sm" variant="outline" onClick={() => act.mutate({ path: "", body: { status: "IN_PROGRESS" } })}>
                {t("tasks.reopen")}
              </Button>
            )}
            {d.status !== "ARCHIVED" && (
              <Button size="sm" variant="ghost" onClick={() => act.mutate({ path: "/archive" })}>
                {t("tasks.archive")}
              </Button>
            )}
          </div>
        )}
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="space-y-6">
          <Card className="p-5">
            <div className="mb-2 flex flex-wrap gap-2 text-xs text-slate-500">
              {d.category && <Badge color="slate">{d.category.name}</Badge>}
              <Badge color="slate">{d.visibility}</Badge>
              {d.billable && <Badge color="brand">{t("tasks.billable")}</Badge>}
              {d.dueDate && (
                <span className={d.overdue ? "font-semibold text-red-600" : ""}>
                  {t("tasks.dueDate")}: {new Date(d.dueDate).toLocaleDateString()}
                </span>
              )}
              {d.completedAt && <span>{t("tasks.completedOn")}: {new Date(d.completedAt).toLocaleDateString()}</span>}
            </div>
            <p className="whitespace-pre-wrap text-sm text-slate-600 dark:text-slate-300">
              {d.description || "—"}
            </p>
            <p className="mt-3 text-xs text-slate-500">
              {t("tasks.assignees")}: {d.assignees.map((a) => a.name).join(", ") || "—"}
            </p>
          </Card>

          <SubtaskCard d={d} onChanged={refresh} />
          <DependencyCard d={d} onChanged={refresh} />

          {active && d.canModify && (
            <Card className="p-5">
              <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500">
                {t("tasks.logTime")}
              </h2>
              <div className="flex items-center gap-2">
                {[15, 30, 60].map((m) => (
                  <Button key={m} size="sm" variant="outline"
                    onClick={() => act.mutate({ path: "/log-time", body: { minutes: m } })}>
                    +{m}m
                  </Button>
                ))}
                <span className="ml-2 text-sm text-slate-500">
                  {t("tasks.logged")}: {Math.floor(d.loggedMin / 60)}h{String(d.loggedMin % 60).padStart(2, "0")}
                  {d.estimatedMin ? ` / ${Math.floor(d.estimatedMin / 60)}h${String(d.estimatedMin % 60).padStart(2, "0")}` : ""}
                </span>
              </div>
            </Card>
          )}
        </div>

        <Card className="p-5">
          <div className="mb-3 flex flex-wrap gap-2">
            {(["comments", "attachments", "reminders", "activity"] as const).map((k) => (
              <button key={k}
                className={"rounded-md px-3 py-1 text-sm font-medium " +
                  (tab === k ? "bg-brand text-white" : "border border-slate-300 dark:border-slate-700")}
                onClick={() => setTab(k)}>
                {t(`tasks.${k}` as any)}
              </button>
            ))}
          </div>
          {tab === "comments" && <CommentsPanel d={d} onChanged={refresh} />}
          {tab === "attachments" && <AttachmentsPanel d={d} onChanged={refresh} />}
          {tab === "reminders" && <RemindersPanel d={d} onChanged={refresh} />}
          {tab === "activity" && (
            <ul className="space-y-1 text-sm">
              {d.activity.map((a, i) => (
                <li key={i} className="flex justify-between border-b border-slate-100 py-1 dark:border-slate-800">
                  <span><Badge color="slate">{a.action}</Badge> <span className="text-slate-500">{a.actor}</span></span>
                  <span className="text-xs text-slate-400">{new Date(a.at).toLocaleString()}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}

function SubtaskCard({ d, onChanged }: { d: Detail; onChanged: () => void }) {
  const t = useT();
  const [title, setTitle] = useState("");
  const add = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, parentId: d.id, visibility: d.visibility }),
      });
      if (!res.ok) throw new Error();
    },
    onSuccess: () => { setTitle(""); onChanged(); },
  });
  return (
    <Card className="p-5">
      <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500">
        {t("tasks.subtasks")} ({d.subtasks.length})
      </h2>
      <ul className="mb-3 space-y-1 text-sm">
        {d.subtasks.map((s) => (
          <li key={s.id} className="flex items-center justify-between">
            <Link href={`/tasks/${s.id}`} className="hover:underline">
              {s.status === "COMPLETED" ? "☑" : "☐"} {s.title}
            </Link>
            <Badge color={s.status === "COMPLETED" ? "green" : "slate"}>{s.status}</Badge>
          </li>
        ))}
      </ul>
      {d.canModify && (
        <div className="flex gap-2">
          <Input className="h-9" placeholder={t("tasks.addSubtask")} value={title}
            onChange={(e) => setTitle(e.target.value)} />
          <Button size="sm" className="h-9" disabled={title.length < 2 || add.isPending}
            onClick={() => add.mutate()}>+</Button>
        </div>
      )}
    </Card>
  );
}

function DependencyCard({ d, onChanged }: { d: Detail; onChanged: () => void }) {
  const t = useT();
  const [depId, setDepId] = useState("");
  const options = useQuery({
    queryKey: ["tasks", "dep-options"],
    queryFn: () => getJson<{ id: string; title: string }[]>("/api/tasks?assignee="),
  });
  const add = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/tasks/${d.id}/dependencies`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dependsOnId: depId }),
      });
      if (!res.ok) { const b = await res.json().catch(() => ({})); throw new Error(b.error || "failed"); }
    },
    onSuccess: () => { setDepId(""); onChanged(); },
  });
  return (
    <Card className="p-5">
      <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500">
        {t("tasks.dependencies")} ({d.dependencies.length})
      </h2>
      <ul className="mb-3 space-y-1 text-sm">
        {d.dependencies.map((x) => (
          <li key={x.id} className="flex items-center justify-between">
            <Link href={`/tasks/${x.id}`} className="hover:underline">{x.title}</Link>
            <Badge color={x.status === "COMPLETED" ? "green" : "amber"}>{x.status}</Badge>
          </li>
        ))}
      </ul>
      {d.canModify && (
        <div className="flex gap-2">
          <select className="h-9 flex-1 rounded-md border border-slate-300 bg-white px-2 text-sm dark:border-slate-700 dark:bg-slate-900"
            value={depId} onChange={(e) => setDepId(e.target.value)}>
            <option value="">{t("tasks.addDependency")}…</option>
            {(options.data ?? []).filter((o) => o.id !== d.id).map((o) => (
              <option key={o.id} value={o.id}>{o.title}</option>
            ))}
          </select>
          <Button size="sm" className="h-9" disabled={!depId || add.isPending} onClick={() => add.mutate()}>+</Button>
        </div>
      )}
    </Card>
  );
}

function CommentsPanel({ d, onChanged }: { d: Detail; onChanged: () => void }) {
  const t = useT();
  const [body, setBody] = useState("");
  const add = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/tasks/${d.id}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body }),
      });
      if (!res.ok) throw new Error();
    },
    onSuccess: () => { setBody(""); onChanged(); },
  });
  return (
    <div>
      <div className="mb-3 flex gap-2">
        <Input className="h-9" placeholder="…" value={body} onChange={(e) => setBody(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && body.trim()) add.mutate(); }} />
        <Button size="sm" className="h-9" disabled={!body.trim() || add.isPending} onClick={() => add.mutate()}>
          {t("tasks.addComment")}
        </Button>
      </div>
      <ul className="space-y-2">
        {d.comments.map((c) => (
          <li key={c.id} className="rounded-md bg-slate-50 p-2 text-sm dark:bg-slate-800/50">
            <div className="mb-0.5 flex justify-between text-xs text-slate-500">
              <span className="font-medium">{c.author}</span>
              <span>{new Date(c.createdAt).toLocaleString()}</span>
            </div>
            <p className="whitespace-pre-wrap">{c.body}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}

function AttachmentsPanel({ d, onChanged }: { d: Detail; onChanged: () => void }) {
  const t = useT();
  const [err, setErr] = useState<string | null>(null);
  const upload = useMutation({
    mutationFn: async (file: File) => {
      const base64 = await new Promise<string>((resolve, reject) => {
        const r = new FileReader();
        r.onload = () => resolve(String(r.result).split(",")[1] ?? "");
        r.onerror = reject;
        r.readAsDataURL(file);
      });
      const res = await fetch(`/api/tasks/${d.id}/attachments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filename: file.name, mime: file.type || "application/octet-stream", base64 }),
      });
      if (!res.ok) { const b = await res.json().catch(() => ({})); throw new Error(b.error || "failed"); }
    },
    onSuccess: () => { setErr(null); onChanged(); },
    onError: (e: Error) => setErr(e.message === "file_too_large" ? "Max 2 MB." : e.message),
  });
  return (
    <div>
      <label className="mb-3 inline-flex cursor-pointer items-center rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800">
        {upload.isPending ? "…" : t("tasks.upload")}
        <input type="file" className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) upload.mutate(f); }} />
      </label>
      {err && <p className="mb-2 text-sm text-red-600">{err}</p>}
      <ul className="space-y-1 text-sm">
        {d.attachments.map((a) => (
          <li key={a.id}>
            <a className="text-brand hover:underline" href={`/api/tasks/attachments/${a.id}`}>
              {a.filename}
            </a>
            <span className="ml-2 text-xs text-slate-400">{Math.round(a.sizeBytes / 1024)} KB</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function RemindersPanel({ d, onChanged }: { d: Detail; onChanged: () => void }) {
  const t = useT();
  const [when, setWhen] = useState("");
  const add = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/tasks/${d.id}/reminders`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ remindAt: when, channel: "IN_APP" }),
      });
      if (!res.ok) throw new Error();
    },
    onSuccess: () => { setWhen(""); onChanged(); },
  });
  return (
    <div>
      <div className="mb-3 flex gap-2">
        <Input className="h-9" type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} />
        <Button size="sm" className="h-9" disabled={!when || add.isPending} onClick={() => add.mutate()}>
          {t("tasks.addReminder")}
        </Button>
      </div>
      <ul className="space-y-1 text-sm">
        {d.reminders.map((r) => (
          <li key={r.id} className="flex justify-between">
            <span>{new Date(r.remindAt).toLocaleString()} · {r.channel}</span>
            <Badge color={r.sent ? "green" : "slate"}>{r.sent ? "sent" : "pending"}</Badge>
          </li>
        ))}
      </ul>
    </div>
  );
}

"use client";
/*
 * Dentons KMN ERP
 * Copyright (c) 2026 Bouquet Innovation SA. All rights reserved.
 * Proprietary and confidential. Unauthorised copying, distribution, modification,
 * or use of this file, via any medium, is strictly prohibited.
 */
import { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button, Input, Card, Badge } from "@/components/ui";
import { useT } from "@/lib/useT";
import { COURT_TYPES, courtLocationGroups, formatCourt, type CourtType } from "@/lib/courts";

interface MatterDetail {
  id: string;
  code: string;
  name: string;
  status: string;
  clientId: string;
  client: string;
  clientType: string;
  practiceArea: string | null;
  partner: string | null;
  nature: string | null;
  adversary: string | null;
  mainLawyerId: string | null;
  mainLawyer: string | null;
  mainLawyerPosition: string | null;
  courtType: string | null;
  courtLocation: string | null;
  audienceAt: string | null;
  notes: string | null;
  office: string | null;
  entity: string | null;
  openedAt: string;
}
interface ClientDoc {
  id: string;
  kind: string;
  filename: string;
  mime: string;
  sizeBytes: number;
  notes: string | null;
  createdAt: string;
}
interface Meta {
  practiceAreas: { id: string; name: string }[];
  partners: { id: string; fullName: string }[];
  employees: { id: string; fullName: string; position: string | null }[];
}

const statusColor = (s: string) => (s === "OPEN" ? "green" : s === "ON_HOLD" ? "amber" : "slate");
const fmtBytes = (n: number) => (n < 1024 ? `${n} B` : n < 1024 * 1024 ? `${(n / 1024).toFixed(0)} KB` : `${(n / 1048576).toFixed(1)} MB`);
const fmtDateTime = (s: string | null) => (s ? new Date(s).toLocaleString() : "—");

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-xs font-medium uppercase tracking-wide text-slate-400">{label}</div>
      <div className="mt-0.5 text-sm">{children}</div>
    </div>
  );
}

export default function MatterDetailPage() {
  const t = useT();
  const qc = useQueryClient();
  const { id } = useParams<{ id: string }>();
  const [editing, setEditing] = useState(false);

  const me = useQuery({
    queryKey: ["me"],
    queryFn: async () => (await fetch("/api/me")).json() as Promise<{ permissions: string[] }>,
  });
  const canManage = (me.data?.permissions ?? []).includes("matter:manage");

  const q = useQuery({
    queryKey: ["matter", id],
    queryFn: async () => {
      const res = await fetch(`/api/matters/${id}`);
      if (!res.ok) throw new Error("failed");
      return (await res.json()) as MatterDetail;
    },
  });
  const m = q.data;

  const docs = useQuery({
    queryKey: ["client-docs", m?.clientId],
    enabled: !!m?.clientId,
    queryFn: async () => {
      const res = await fetch(`/api/clients/${m!.clientId}/documents`);
      if (!res.ok) throw new Error("failed");
      return (await res.json()) as ClientDoc[];
    },
  });

  if (q.isLoading) return <p className="text-sm text-slate-400">{t("common.loading")}</p>;
  if (q.isError || !m) return <p className="text-sm text-red-600">{t("matters.loadError")}</p>;

  const jurisdiction = formatCourt(m.courtType, m.courtLocation);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link href="/matters" className="text-sm text-slate-400 hover:text-slate-600">← {t("matters.title")}</Link>
          <h1 className="mt-1 flex items-center gap-3 text-2xl font-semibold">
            <span className="font-mono">{m.code}</span>
            <Badge color={statusColor(m.status)}>{m.status}</Badge>
          </h1>
          <p className="text-sm text-slate-500">{m.name}</p>
        </div>
        {canManage && <Button onClick={() => setEditing(true)}>{t("matters.editDetails")}</Button>}
      </div>

      {/* Summary */}
      <Card className="p-5">
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-500">{t("matters.summary")}</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Field label={t("matters.matterId")}><span className="font-mono">{m.code}</span></Field>
          <Field label={t("matters.client")}>
            <Link href="/clients" className="text-brand-700 hover:underline dark:text-brand-300">{m.client}</Link>
            <span className="ml-1 text-xs text-slate-400">({m.clientType})</span>
          </Field>
          <Field label={t("matters.nature")}>{m.nature || m.practiceArea || "—"}</Field>
          <Field label={t("matters.jurisdiction")}>{jurisdiction || <span className="text-slate-400">{t("matters.notLitigious")}</span>}</Field>
          <Field label={t("matters.adversary")}>{m.adversary || "—"}</Field>
          <Field label={t("matters.mainLawyer")}>
            {m.mainLawyer ? (
              <>{m.mainLawyer}{m.mainLawyerPosition ? <span className="text-xs text-slate-400"> · {m.mainLawyerPosition}</span> : null}</>
            ) : "—"}
          </Field>
          <Field label={t("matters.audienceAt")}>{fmtDateTime(m.audienceAt)}</Field>
          <Field label={t("matters.partner")}>{m.partner || "—"}</Field>
          <Field label={t("matters.area")}>{m.practiceArea || "—"}</Field>
        </div>
        <div className="mt-4">
          <div className="text-xs font-medium uppercase tracking-wide text-slate-400">{t("matters.notes")}</div>
          <p className="mt-1 whitespace-pre-wrap rounded-md bg-slate-50 p-3 text-sm dark:bg-slate-800/50">{m.notes || "—"}</p>
        </div>
      </Card>

      {/* Drill-through: client's attached files */}
      <Card className="overflow-x-auto">
        <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3 dark:border-slate-800">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">{t("matters.clientFiles")}</h2>
          <span className="text-xs text-slate-400">{t("matters.clientFilesHint")}</span>
        </div>
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500 dark:bg-slate-800/50">
            <tr>
              <th className="px-4 py-2.5">{t("matters.docName")}</th>
              <th className="px-4 py-2.5">{t("matters.docKind")}</th>
              <th className="px-4 py-2.5">{t("matters.docNotes")}</th>
              <th className="px-4 py-2.5 text-right">{t("matters.docSize")}</th>
              <th className="px-4 py-2.5 text-right">{t("common.actions")}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {docs.isLoading && <tr><td colSpan={5} className="px-4 py-6 text-center text-slate-400">{t("common.loading")}</td></tr>}
            {docs.data?.length === 0 && <tr><td colSpan={5} className="px-4 py-8 text-center text-slate-400">{t("matters.noFiles")}</td></tr>}
            {docs.data?.map((d) => (
              <tr key={d.id}>
                <td className="px-4 py-2.5 font-medium">{d.filename}</td>
                <td className="px-4 py-2.5"><Badge color="slate">{d.kind}</Badge></td>
                <td className="px-4 py-2.5 text-slate-500">{d.notes || "—"}</td>
                <td className="px-4 py-2.5 text-right text-slate-500">{fmtBytes(d.sizeBytes)}</td>
                <td className="px-4 py-2.5 text-right">
                  <a href={`/api/clients/documents/${d.id}`}>
                    <Button size="sm" variant="outline">{t("matters.openFile")}</Button>
                  </a>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      {editing && <EditMatterDialog matter={m} onClose={() => setEditing(false)} onSaved={() => { setEditing(false); qc.invalidateQueries({ queryKey: ["matter", id] }); qc.invalidateQueries({ queryKey: ["matters"] }); }} />}
    </div>
  );
}

function EditMatterDialog({ matter, onClose, onSaved }: { matter: MatterDetail; onClose: () => void; onSaved: () => void }) {
  const t = useT();
  const { register, handleSubmit, watch } = useForm({
    defaultValues: {
      status: matter.status,
      nature: matter.nature ?? "",
      adversary: matter.adversary ?? "",
      mainLawyerId: matter.mainLawyerId ?? "",
      courtType: matter.courtType ?? "",
      courtLocation: matter.courtLocation ?? "",
      // datetime-local wants "YYYY-MM-DDTHH:mm"
      audienceAt: matter.audienceAt ? new Date(matter.audienceAt).toISOString().slice(0, 16) : "",
      notes: matter.notes ?? "",
      responsiblePartnerId: "",
    },
  });
  const [error, setError] = useState<string | null>(null);
  const courtType = (watch("courtType") ?? "") as CourtType | "";

  const meta = useQuery({
    queryKey: ["matters-meta"],
    queryFn: async () => {
      const res = await fetch("/api/matters/meta");
      if (!res.ok) throw new Error("failed");
      return (await res.json()) as Meta;
    },
  });

  const save = useMutation({
    mutationFn: async (data: Record<string, unknown>) => {
      const res = await fetch(`/api/matters/${matter.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) { const b = await res.json().catch(() => ({})); throw new Error(b.error || "failed"); }
    },
    onSuccess: onSaved,
    onError: (e: Error) => setError(e.message),
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <Card className="max-h-[92vh] w-full max-w-2xl overflow-y-auto p-6">
        <h2 className="mb-4 text-lg font-semibold">{t("matters.editDetails")} · <span className="font-mono">{matter.code}</span></h2>
        <form onSubmit={handleSubmit((d) => save.mutate(d))} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-sm font-medium">{t("matters.status")}</label>
              <select className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-900" {...register("status")}>
                <option value="OPEN">OPEN</option>
                <option value="ON_HOLD">ON_HOLD</option>
                <option value="CLOSED">CLOSED</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">{t("matters.mainLawyer")}</label>
              <select className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-900" {...register("mainLawyerId")}>
                <option value="">—</option>
                {(meta.data?.employees ?? []).map((e) => (
                  <option key={e.id} value={e.id}>{e.fullName}{e.position ? ` (${e.position})` : ""}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">{t("matters.nature")}</label>
            <Input placeholder={t("matters.naturePlaceholder")} {...register("nature")} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-sm font-medium">{t("matters.courtType")}</label>
              <select className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-900" {...register("courtType")}>
                <option value="">{t("matters.notLitigious")}</option>
                {COURT_TYPES.map((c) => <option key={c.value} value={c.value}>{c.en}</option>)}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">{t("matters.courtLocation")}</label>
              <select className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900" disabled={!courtType} {...register("courtLocation")}>
                <option value="">—</option>
                {courtLocationGroups(courtType).map((g) => (
                  <optgroup key={g.region} label={g.region}>
                    {g.towns.map((town) => <option key={town} value={town}>{town}</option>)}
                  </optgroup>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-sm font-medium">{t("matters.adversary")}</label>
              <Input {...register("adversary")} />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">{t("matters.audienceAt")}</label>
              <Input type="datetime-local" {...register("audienceAt")} />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">{t("matters.notes")}</label>
            <textarea className="min-h-[80px] w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900" {...register("notes")} />
          </div>

          {error && <p className="text-sm text-red-600">{error === "invalid_main_lawyer" ? t("matters.invalidMainLawyer") : error}</p>}
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={onClose}>{t("common.cancel")}</Button>
            <Button type="submit" disabled={save.isPending}>{t("common.save")}</Button>
          </div>
        </form>
      </Card>
    </div>
  );
}

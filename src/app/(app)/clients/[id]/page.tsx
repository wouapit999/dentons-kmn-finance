"use client";
import { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button, Input, Card, Badge } from "@/components/ui";
import { useT } from "@/lib/useT";
import { useUi } from "@/lib/store";
import { formatMoney } from "@/lib/money";
import { CONFLICT_QUESTIONS, CLIENT_DOC_KINDS } from "@/lib/constants";

interface Portfolio {
  client: {
    id: string; name: string; type: string; email: string | null; taxId: string | null;
    kycStatus: string; amlRisk: string; conflictStatus: string; status: string;
  };
  billing: {
    invoiceCount: number; billed: number; paid: number; outstanding: number;
    overdue: number; unbilledFees: number; unbilledHours: number; unbilledDisbursements: number;
  };
  trustBalance: number | null;
  matters: { id: string; code: string; name: string; status: string; practiceArea: string | null; partner: string | null }[];
  invoices: { number: string; status: string; total: number; paid: number }[];
}
interface Doc {
  id: string; kind: string; filename: string; mime: string;
  sizeBytes: number; notes: string | null; createdAt: string;
}

const kycColor = (s: string) => (s === "VERIFIED" ? "green" : s === "REJECTED" ? "red" : "amber");
const riskColor = (s: string) => (s === "HIGH" ? "red" : s === "MEDIUM" ? "amber" : "slate");
const confColor = (s: string) =>
  s === "CLEAR" ? "green" : s === "POTENTIAL" ? "amber" : s === "BLOCKED" ? "red" : "slate";

export default function ClientFilePage() {
  const t = useT();
  const qc = useQueryClient();
  const { id } = useParams<{ id: string }>();
  const [conflictOpen, setConflictOpen] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const me = useQuery({
    queryKey: ["me"],
    queryFn: async () => (await fetch("/api/me")).json() as Promise<{ permissions: string[] }>,
  });
  const canManage = (me.data?.permissions ?? []).includes("client:manage");

  const pf = useQuery({
    queryKey: ["client-portfolio", id],
    queryFn: async () => {
      const res = await fetch(`/api/clients/${id}/portfolio`);
      if (!res.ok) throw new Error();
      return (await res.json()) as Portfolio;
    },
  });
  const docs = useQuery({
    queryKey: ["client-docs", id],
    queryFn: async () => {
      const res = await fetch(`/api/clients/${id}/documents`);
      if (!res.ok) throw new Error();
      return (await res.json()) as Doc[];
    },
  });
  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["client-portfolio", id] });
    qc.invalidateQueries({ queryKey: ["client-docs", id] });
    qc.invalidateQueries({ queryKey: ["clients"] });
  };

  const kyc = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/clients/${id}/kyc-verify`, { method: "POST" });
      const b = await res.json();
      if (!res.ok) throw new Error(b.error || "failed");
      return b as { kycStatus: string; riskLevel: string; source: string };
    },
    onSuccess: (b) => {
      setError(null);
      setNotice(`${t("file.kycDone")} — ${b.riskLevel} (${b.source})`);
      refresh();
    },
    onError: (e: Error) => { setNotice(null); setError(e.message); },
  });

  const d = pf.data;
  if (!d) return <p className="text-slate-400">{t("common.loading")}</p>;

  return (
    <div className="space-y-6">
      <Link href="/clients" className="text-sm text-brand hover:underline">← {t("clients.title")}</Link>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-semibold">{d.client.name}</h1>
            <Badge color="slate">{d.client.type}</Badge>
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-sm">
            <Badge color={kycColor(d.client.kycStatus)}>KYC: {d.client.kycStatus}</Badge>
            <Badge color={riskColor(d.client.amlRisk)}>AML: {d.client.amlRisk}</Badge>
            <Badge color={confColor(d.client.conflictStatus)}>{t("clients.conflict")}: {d.client.conflictStatus}</Badge>
            {d.client.taxId && <span className="text-slate-500">Tax ID: {d.client.taxId}</span>}
          </div>
        </div>
        {canManage && (
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => setConflictOpen(true)}>
              {t("file.runConflict")}
            </Button>
            <Button disabled={kyc.isPending} onClick={() => kyc.mutate()}>
              {kyc.isPending ? t("file.kycRunning") : t("file.runKyc")}
            </Button>
          </div>
        )}
      </div>
      {notice && <p className="text-sm text-green-600">{notice}</p>}
      {error && <p className="text-sm text-red-600">{error}</p>}
      {!canManage && <p className="text-xs italic text-slate-400">{t("file.readonly")}</p>}

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-6">
        {[
          [t("file.billed"), d.billing.billed],
          [t("file.paid"), d.billing.paid],
          [t("file.outstanding"), d.billing.outstanding],
          [t("file.overdue"), d.billing.overdue],
          [t("file.unbilled"), d.billing.unbilledFees + d.billing.unbilledDisbursements],
          [t("file.trust"), d.trustBalance ?? 0],
        ].map(([label, value]) => (
          <Card key={String(label)} className="p-4">
            <div className="text-lg font-semibold">{formatMoney(value as number)}</div>
            <div className="mt-0.5 text-xs text-slate-500">{label}</div>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="space-y-6">
          <Card className="overflow-hidden">
            <div className="border-b border-slate-100 px-4 py-3 text-sm font-semibold uppercase tracking-wide text-slate-500 dark:border-slate-800">
              {t("file.matters")} ({d.matters.length})
            </div>
            <table className="w-full text-sm">
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {d.matters.length === 0 && (
                  <tr><td className="px-4 py-4 text-center text-slate-400">—</td></tr>
                )}
                {d.matters.map((m) => (
                  <tr key={m.id}>
                    <td className="px-4 py-2 font-mono text-xs">{m.code}</td>
                    <td className="px-4 py-2">{m.name}</td>
                    <td className="px-4 py-2 text-slate-500">{m.partner ?? "—"}</td>
                    <td className="px-4 py-2 text-right">
                      <Badge color={m.status === "OPEN" ? "green" : "slate"}>{m.status}</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>

          <Card className="overflow-hidden">
            <div className="border-b border-slate-100 px-4 py-3 text-sm font-semibold uppercase tracking-wide text-slate-500 dark:border-slate-800">
              {t("file.invoices")} ({d.billing.invoiceCount})
            </div>
            <table className="w-full text-sm">
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {d.invoices.length === 0 && (
                  <tr><td className="px-4 py-4 text-center text-slate-400">—</td></tr>
                )}
                {d.invoices.map((i) => (
                  <tr key={i.number}>
                    <td className="px-4 py-2 font-mono text-xs">{i.number}</td>
                    <td className="px-4 py-2 text-right">{formatMoney(i.total)}</td>
                    <td className="px-4 py-2 text-right text-slate-500">{formatMoney(i.paid)}</td>
                    <td className="px-4 py-2 text-right">
                      <Badge color={i.status === "PAID" ? "green" : i.status === "PART_PAID" ? "amber" : "slate"}>
                        {i.status}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </div>

        <DocumentsPanel clientId={id} docs={docs.data ?? []} canManage={canManage} onChanged={refresh} />
      </div>

      {conflictOpen && (
        <ConflictDialog
          clientId={id}
          onClose={() => setConflictOpen(false)}
          onDone={(status) => {
            setConflictOpen(false);
            setNotice(`${t("file.conflictDone")} — ${status}`);
            refresh();
          }}
        />
      )}
    </div>
  );
}

function DocumentsPanel({
  clientId, docs, canManage, onChanged,
}: { clientId: string; docs: Doc[]; canManage: boolean; onChanged: () => void }) {
  const t = useT();
  const [kind, setKind] = useState("IDENTITY");
  const [notes, setNotes] = useState("");
  const [err, setErr] = useState<string | null>(null);

  const upload = useMutation({
    mutationFn: async (file: File) => {
      const base64 = await new Promise<string>((resolve, reject) => {
        const r = new FileReader();
        r.onload = () => resolve(String(r.result).split(",")[1] ?? "");
        r.onerror = reject;
        r.readAsDataURL(file);
      });
      const res = await fetch(`/api/clients/${clientId}/documents`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind, notes: notes || undefined, filename: file.name,
          mime: file.type || "application/octet-stream", base64,
        }),
      });
      if (!res.ok) { const b = await res.json().catch(() => ({})); throw new Error(b.error || "failed"); }
    },
    onSuccess: () => { setErr(null); setNotes(""); onChanged(); },
    onError: (e: Error) => setErr(e.message === "file_too_large" ? "Max 2 MB." : e.message),
  });

  return (
    <Card className="p-5">
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
        {t("file.docs")} ({docs.length})
      </h2>
      {canManage && (
        <div className="mb-4 flex flex-wrap items-end gap-2">
          <div>
            <label className="mb-1 block text-xs font-medium">{t("file.kind")}</label>
            <select
              className="h-9 rounded-md border border-slate-300 bg-white px-2 text-sm dark:border-slate-700 dark:bg-slate-900"
              value={kind} onChange={(e) => setKind(e.target.value)}
            >
              {CLIENT_DOC_KINDS.filter((k) => !k.endsWith("_REPORT")).map((k) => (
                <option key={k} value={k}>{k}</option>
              ))}
            </select>
          </div>
          <div className="flex-1 min-w-[140px]">
            <label className="mb-1 block text-xs font-medium">{t("file.notes")}</label>
            <Input className="h-9" value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
          <label className="inline-flex h-9 cursor-pointer items-center rounded-md bg-brand px-3 text-sm font-medium text-white hover:bg-brand-700">
            {upload.isPending ? "…" : t("file.upload")}
            <input type="file" className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) upload.mutate(f); }} />
          </label>
        </div>
      )}
      {err && <p className="mb-2 text-sm text-red-600">{err}</p>}
      <ul className="space-y-1.5 text-sm">
        {docs.length === 0 && <li className="text-slate-400">—</li>}
        {docs.map((doc) => (
          <li key={doc.id} className="flex items-center justify-between gap-2">
            <span className="min-w-0">
              <a className="text-brand hover:underline" href={`/api/clients/documents/${doc.id}`}>
                {doc.filename}
              </a>
              {doc.notes && <span className="ml-2 truncate text-xs text-slate-400">{doc.notes}</span>}
            </span>
            <span className="flex shrink-0 items-center gap-2">
              <Badge color={doc.kind.endsWith("_REPORT") ? "brand" : "slate"}>{doc.kind}</Badge>
              <span className="text-xs text-slate-400">{Math.round(doc.sizeBytes / 1024)} KB</span>
            </span>
          </li>
        ))}
      </ul>
    </Card>
  );
}

function ConflictDialog({
  clientId, onClose, onDone,
}: { clientId: string; onClose: () => void; onDone: (status: string) => void }) {
  const t = useT();
  const locale = useUi((s) => s.locale);
  const [answers, setAnswers] = useState<Record<string, { answer: boolean; details: string }>>(
    Object.fromEntries(CONFLICT_QUESTIONS.map((q) => [q.key, { answer: false, details: "" }])),
  );
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);

  const submit = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/clients/${clientId}/conflict-check`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          answers: CONFLICT_QUESTIONS.map((q) => ({
            key: q.key,
            answer: answers[q.key].answer,
            details: answers[q.key].details || undefined,
          })),
          notes: notes || undefined,
        }),
      });
      const b = await res.json();
      if (!res.ok) throw new Error(b.error || "failed");
      return b as { status: string };
    },
    onSuccess: (b) => onDone(b.status),
    onError: (e: Error) => setError(e.message),
  });

  const set = (key: string, patch: Partial<{ answer: boolean; details: string }>) =>
    setAnswers((a) => ({ ...a, [key]: { ...a[key], ...patch } }));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <Card className="max-h-[90vh] w-full max-w-2xl overflow-y-auto p-6">
        <h2 className="mb-1 text-lg font-semibold">{t("file.conflictTitle")}</h2>
        <p className="mb-4 text-sm text-slate-500">{t("file.conflictHint")}</p>
        <div className="space-y-4">
          {CONFLICT_QUESTIONS.map((q) => (
            <div key={q.key} className="rounded-md border border-slate-200 p-3 dark:border-slate-700">
              <p className="mb-2 text-sm font-medium">{locale === "fr" ? q.fr : q.en}</p>
              <div className="flex items-center gap-4 text-sm">
                <label className="flex items-center gap-1.5">
                  <input type="radio" checked={!answers[q.key].answer}
                    onChange={() => set(q.key, { answer: false })} /> No / Non
                </label>
                <label className="flex items-center gap-1.5">
                  <input type="radio" checked={answers[q.key].answer}
                    onChange={() => set(q.key, { answer: true })} /> Yes / Oui
                </label>
              </div>
              {answers[q.key].answer && (
                <Input className="mt-2 h-9" placeholder={t("file.details")}
                  value={answers[q.key].details}
                  onChange={(e) => set(q.key, { details: e.target.value })} />
              )}
            </div>
          ))}
          <div>
            <label className="mb-1 block text-sm font-medium">{t("file.notes")}</label>
            <Input value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={onClose}>{t("common.cancel")}</Button>
            <Button disabled={submit.isPending} onClick={() => submit.mutate()}>
              {t("file.submit")}
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}

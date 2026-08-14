"use client";
/*
 * Dentons KMN ERP
 * Copyright (c) 2026 Bouquet Innovation SA. All rights reserved.
 * Proprietary and confidential. Unauthorised copying, distribution, modification,
 * or use of this file, via any medium, is strictly prohibited.
 */
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button, Input, Card, Badge } from "@/components/ui";
import { useT } from "@/lib/useT";
import { formatMoney } from "@/lib/money";

interface Line {
  id: string;
  sourceType: string;
  description: string;
  minutes: number | null;
  originalAmount: number;
  adjustedAmount: number;
  included: boolean;
}
interface Comment { id: string; author: string; body: string; createdAt: string }
interface Detail {
  id: string;
  number: string;
  status: string;
  editable: boolean;
  client: string;
  matter: string;
  entity: string | null;
  currency: string;
  fxRate: number;
  vatRate: number;
  whtRate: number;
  notes: string | null;
  invoiceId: string | null;
  totals: { feeSubtotal: number; disbSubtotal: number; writeDown: number; subtotal: number; total: number };
  lines: Line[];
  comments: Comment[];
}

const statusColor = (s: string) =>
  s === "APPROVED" ? "green" : s === "IN_REVIEW" ? "amber" : s === "REJECTED" ? "red" : s === "BILLED" ? "brand" : "slate";

export default function ProformaDetailPage() {
  const t = useT();
  const qc = useQueryClient();
  const router = useRouter();
  const { id } = useParams<{ id: string }>();
  const [draft, setDraft] = useState<Record<string, { adjustedAmount?: number; included?: boolean }>>({});
  const [vatRate, setVatRate] = useState<number | null>(null);
  const [whtRate, setWhtRate] = useState<number | null>(null);
  const [comment, setComment] = useState("");
  const [error, setError] = useState<string | null>(null);

  const me = useQuery({
    queryKey: ["me"],
    queryFn: async () => (await fetch("/api/me")).json() as Promise<{ permissions: string[] }>,
  });
  const perms = me.data?.permissions ?? [];
  const canManage = perms.includes("proforma:manage");
  const canApprove = perms.includes("proforma:approve");

  const q = useQuery({
    queryKey: ["proforma", id],
    queryFn: async () => {
      const res = await fetch(`/api/proformas/${id}`);
      if (!res.ok) throw new Error("failed");
      return (await res.json()) as Detail;
    },
  });

  // Seed the local tax-rate editors once the proforma loads.
  useEffect(() => {
    if (q.data && vatRate === null) { setVatRate(q.data.vatRate); setWhtRate(q.data.whtRate); }
  }, [q.data, vatRate]);

  const save = useMutation({
    mutationFn: async () => {
      const lines = Object.entries(draft).map(([lid, v]) => ({ id: lid, ...v }));
      const res = await fetch(`/api/proformas/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lines, vatRate: vatRate ?? undefined, whtRate: whtRate ?? undefined }),
      });
      if (!res.ok) { const b = await res.json().catch(() => ({})); throw new Error(b.error || "failed"); }
    },
    onSuccess: () => { setDraft({}); qc.invalidateQueries({ queryKey: ["proforma", id] }); },
    onError: (e: Error) => setError(e.message),
  });

  const transition = useMutation({
    mutationFn: async (action: string) => {
      const res = await fetch(`/api/proformas/${id}/transition`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, comment: comment || undefined }),
      });
      if (!res.ok) { const b = await res.json().catch(() => ({})); throw new Error(b.error || "failed"); }
    },
    onSuccess: () => { setComment(""); qc.invalidateQueries({ queryKey: ["proforma", id] }); qc.invalidateQueries({ queryKey: ["proformas"] }); },
    onError: (e: Error) => setError(e.message),
  });

  const postComment = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/proformas/${id}/comments`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ body: comment }),
      });
      if (!res.ok) throw new Error("failed");
    },
    onSuccess: () => { setComment(""); qc.invalidateQueries({ queryKey: ["proforma", id] }); },
  });

  const convert = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/proformas/${id}/convert`, { method: "POST" });
      if (!res.ok) { const b = await res.json().catch(() => ({})); throw new Error(b.error || "failed"); }
      return (await res.json()) as { invoiceId: string };
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["proforma", id] }); router.push("/invoices"); },
    onError: (e: Error) => setError(e.message),
  });

  if (q.isLoading) return <p className="text-sm text-slate-400">{t("common.loading")}</p>;
  if (q.isError || !q.data) return <p className="text-sm text-red-600">{t("pf.loadError")}</p>;
  const p = q.data;
  const editable = p.editable && canManage;

  // Live totals reflecting unsaved edits.
  const effLine = (l: Line) => {
    const d = draft[l.id] ?? {};
    const included = d.included ?? l.included;
    const adjusted = included ? Math.min(d.adjustedAmount ?? l.adjustedAmount, l.originalAmount) : 0;
    return { included, adjusted };
  };
  let fee = 0, disb = 0, wd = 0;
  for (const l of p.lines) {
    const { included, adjusted } = effLine(l);
    if (!included) { wd += l.originalAmount; continue; }
    wd += l.originalAmount - adjusted;
    if (l.sourceType === "DISBURSEMENT") disb += adjusted; else fee += adjusted;
  }
  const subtotal = fee + disb;
  const vr = vatRate ?? p.vatRate, wr = whtRate ?? p.whtRate;
  const vat = Math.round(subtotal * (vr / 100) * 100) / 100;
  const wht = Math.round(fee * (wr / 100) * 100) / 100;
  const total = Math.round((subtotal + vat - wht) * 100) / 100;
  const dirty = Object.keys(draft).length > 0 || vr !== p.vatRate || wr !== p.whtRate;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-3">
            <button onClick={() => router.push("/proformas")} className="text-sm text-slate-400 hover:text-slate-600">← {t("pf.title")}</button>
          </div>
          <h1 className="mt-1 flex items-center gap-3 text-2xl font-semibold">
            <span className="font-mono">{p.number}</span>
            <Badge color={statusColor(p.status)}>{t(("pf.st." + p.status) as never)}</Badge>
          </h1>
          <p className="text-sm text-slate-500">{p.client} · {p.matter}{p.entity ? " · " + p.entity : ""}{p.currency !== "XAF" ? ` · ${p.currency} @ ${p.fxRate}` : ""}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {p.status === "DRAFT" && canManage && (
            <Button onClick={() => transition.mutate("submit")} disabled={dirty || transition.isPending}>{t("pf.submit")}</Button>
          )}
          {p.status === "IN_REVIEW" && canApprove && (
            <>
              <Button variant="outline" onClick={() => transition.mutate("reject")} disabled={transition.isPending}>{t("pf.reject")}</Button>
              <Button onClick={() => transition.mutate("approve")} disabled={transition.isPending}>{t("pf.approve")}</Button>
            </>
          )}
          {p.status === "REJECTED" && canManage && (
            <Button variant="outline" onClick={() => transition.mutate("reopen")} disabled={transition.isPending}>{t("pf.reopen")}</Button>
          )}
          {p.status === "APPROVED" && canApprove && !p.invoiceId && (
            <Button onClick={() => convert.mutate()} disabled={convert.isPending}>{t("pf.convert")}</Button>
          )}
          {p.invoiceId && (
            <Button variant="outline" onClick={() => router.push("/invoices")}>{t("pf.viewInvoice")}</Button>
          )}
        </div>
      </div>

      {dirty && editable && (
        <div className="flex items-center justify-between rounded-lg border border-amber-300 bg-amber-50 px-4 py-2 text-sm dark:border-amber-700 dark:bg-amber-900/20">
          <span>{t("pf.unsaved")}</span>
          <Button size="sm" onClick={() => save.mutate()} disabled={save.isPending}>{t("common.save")}</Button>
        </div>
      )}
      {error && <p className="text-sm text-red-600">{t(("err." + error) as never)}</p>}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Lines */}
        <Card className="overflow-x-auto lg:col-span-2">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500 dark:bg-slate-800/50">
              <tr>
                <th className="px-3 py-2.5">{t("pf.line")}</th>
                <th className="px-3 py-2.5 text-right">{t("pf.original")}</th>
                <th className="px-3 py-2.5 text-right">{t("pf.adjusted")}</th>
                <th className="px-3 py-2.5 text-center">{t("pf.include")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {p.lines.map((l) => {
                const { included, adjusted } = effLine(l);
                return (
                  <tr key={l.id} className={included ? "" : "opacity-50"}>
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-2">
                        <Badge color={l.sourceType === "TIME" ? "brand" : l.sourceType === "DISBURSEMENT" ? "slate" : "amber"}>{t(("pf.src." + l.sourceType) as never)}</Badge>
                        <span>{l.description}</span>
                      </div>
                    </td>
                    <td className="px-3 py-2 text-right text-slate-500">{formatMoney(l.originalAmount, p.currency)}</td>
                    <td className="px-3 py-2 text-right">
                      {editable ? (
                        <input
                          type="number"
                          className="h-8 w-28 rounded border border-slate-300 bg-white px-2 text-right text-sm dark:border-slate-700 dark:bg-slate-900"
                          value={adjusted}
                          disabled={!included}
                          max={l.originalAmount}
                          onChange={(e) => setDraft((d) => ({ ...d, [l.id]: { ...d[l.id], adjustedAmount: Number(e.target.value) } }))}
                        />
                      ) : formatMoney(adjusted, p.currency)}
                    </td>
                    <td className="px-3 py-2 text-center">
                      <input
                        type="checkbox"
                        checked={included}
                        disabled={!editable}
                        onChange={(e) => setDraft((d) => ({ ...d, [l.id]: { ...d[l.id], included: e.target.checked } }))}
                      />
                    </td>
                  </tr>
                );
              })}
              {p.lines.length === 0 && <tr><td colSpan={4} className="px-3 py-6 text-center text-slate-400">—</td></tr>}
            </tbody>
          </table>
        </Card>

        {/* Totals + tax */}
        <Card className="space-y-3 p-5">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">{t("pf.summary")}</h3>
          <div className="space-y-1 text-sm">
            <div className="flex justify-between"><span>{t("pf.fees")}</span><span>{formatMoney(fee, p.currency)}</span></div>
            <div className="flex justify-between"><span>{t("pf.disb")}</span><span>{formatMoney(disb, p.currency)}</span></div>
            <div className="flex justify-between text-amber-600"><span>{t("pf.writeDown")}</span><span>-{formatMoney(wd, p.currency)}</span></div>
            <div className="flex justify-between border-t border-slate-200 pt-1 dark:border-slate-700"><span>{t("pf.subtotal")}</span><span>{formatMoney(subtotal, p.currency)}</span></div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="mb-1 block text-xs font-medium">{t("inv.vatRate")}</label>
              <Input type="number" value={vr} disabled={!editable} onChange={(e) => setVatRate(Number(e.target.value))} />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium">{t("inv.whtRate")}</label>
              <Input type="number" value={wr} disabled={!editable} onChange={(e) => setWhtRate(Number(e.target.value))} />
            </div>
          </div>
          <div className="space-y-1 text-sm">
            <div className="flex justify-between text-slate-500"><span>{t("inv.vat")} ({vr}%)</span><span>{formatMoney(vat, p.currency)}</span></div>
            <div className="flex justify-between text-slate-500"><span>{t("inv.wht")} ({wr}%)</span><span>-{formatMoney(wht, p.currency)}</span></div>
            <div className="flex justify-between border-t border-slate-200 pt-1 text-base font-semibold dark:border-slate-700"><span>{t("pf.total")}</span><span>{formatMoney(total, p.currency)}</span></div>
          </div>
          {p.notes && <p className="rounded bg-slate-50 p-2 text-xs text-slate-500 dark:bg-slate-800/50">{p.notes}</p>}
        </Card>
      </div>

      {/* Collaboration thread */}
      <Card className="p-5">
        <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">{t("pf.discussion")}</h3>
        <div className="space-y-3">
          {p.comments.length === 0 && <p className="text-sm text-slate-400">{t("pf.noComments")}</p>}
          {p.comments.map((c) => (
            <div key={c.id} className="rounded-lg bg-slate-50 p-3 dark:bg-slate-800/40">
              <div className="mb-0.5 flex items-center justify-between text-xs text-slate-500">
                <span className="font-medium text-slate-700 dark:text-slate-300">{c.author}</span>
                <span>{new Date(c.createdAt).toLocaleString()}</span>
              </div>
              <p className="text-sm">{c.body}</p>
            </div>
          ))}
        </div>
        <div className="mt-3 flex gap-2">
          <Input value={comment} onChange={(e) => setComment(e.target.value)} placeholder={t("pf.commentPlaceholder")} />
          <Button variant="outline" onClick={() => postComment.mutate()} disabled={!comment.trim() || postComment.isPending}>{t("pf.comment")}</Button>
        </div>
        <p className="mt-1 text-xs text-slate-400">{t("pf.commentWorkflowHint")}</p>
      </Card>
    </div>
  );
}

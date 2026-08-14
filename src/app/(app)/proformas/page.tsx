"use client";
/*
 * Dentons KMN ERP
 * Copyright (c) 2026 Bouquet Innovation SA. All rights reserved.
 * Proprietary and confidential. Unauthorised copying, distribution, modification,
 * or use of this file, via any medium, is strictly prohibited.
 */
import { useState } from "react";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button, Input, Card, Badge } from "@/components/ui";
import { useT } from "@/lib/useT";
import { formatMoney } from "@/lib/money";

interface Proforma {
  id: string;
  number: string;
  status: string;
  client: string;
  matter: string;
  entity: string | null;
  currency: string;
  feeSubtotal: number;
  disbSubtotal: number;
  writeDown: number;
  total: number;
  lines: number;
  comments: number;
  invoiceId: string | null;
  createdAt: string;
}
interface MatterOpt { id: string; code: string; name: string }

const statusColor = (s: string) =>
  s === "APPROVED" ? "green" : s === "IN_REVIEW" ? "amber" : s === "REJECTED" ? "red" : s === "BILLED" ? "brand" : "slate";

export default function ProformasPage() {
  const t = useT();
  const qc = useQueryClient();
  const [creating, setCreating] = useState(false);

  const me = useQuery({
    queryKey: ["me"],
    queryFn: async () => (await fetch("/api/me")).json() as Promise<{ permissions: string[] }>,
  });
  const canManage = (me.data?.permissions ?? []).includes("proforma:manage");

  const list = useQuery({
    queryKey: ["proformas"],
    queryFn: async () => {
      const res = await fetch("/api/proformas");
      if (!res.ok) throw new Error("failed");
      return (await res.json()) as Proforma[];
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">{t("pf.title")}</h1>
          <p className="text-sm text-slate-500">{t("pf.subtitle")}</p>
        </div>
        {canManage && <Button onClick={() => setCreating(true)}>+ {t("pf.new")}</Button>}
      </div>

      <Card className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500 dark:bg-slate-800/50">
            <tr>
              <th className="px-4 py-3">{t("pf.number")}</th>
              <th className="px-4 py-3">{t("pf.client")}</th>
              <th className="px-4 py-3">{t("pf.matter")}</th>
              <th className="px-4 py-3 text-right">{t("pf.fees")}</th>
              <th className="px-4 py-3 text-right">{t("pf.writeDown")}</th>
              <th className="px-4 py-3 text-right">{t("pf.total")}</th>
              <th className="px-4 py-3">{t("pf.status")}</th>
              <th className="px-4 py-3 text-right">{t("common.actions")}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {list.isLoading && (
              <tr><td colSpan={8} className="px-4 py-6 text-center text-slate-400">{t("common.loading")}</td></tr>
            )}
            {list.data?.length === 0 && (
              <tr><td colSpan={8} className="px-4 py-8 text-center text-slate-400">{t("pf.empty")}</td></tr>
            )}
            {list.data?.map((p) => (
              <tr key={p.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/30">
                <td className="px-4 py-2.5 font-mono">
                  <Link href={`/proformas/${p.id}`} className="text-brand-700 hover:underline dark:text-brand-300">{p.number}</Link>
                </td>
                <td className="px-4 py-2.5">{p.client}</td>
                <td className="px-4 py-2.5 text-slate-500">{p.matter}</td>
                <td className="px-4 py-2.5 text-right">{formatMoney(p.feeSubtotal, p.currency)}</td>
                <td className="px-4 py-2.5 text-right text-amber-600">{p.writeDown ? "-" + formatMoney(p.writeDown, p.currency) : "—"}</td>
                <td className="px-4 py-2.5 text-right font-medium">{formatMoney(p.total, p.currency)}</td>
                <td className="px-4 py-2.5"><Badge color={statusColor(p.status)}>{t(("pf.st." + p.status) as never)}</Badge></td>
                <td className="px-4 py-2.5 text-right">
                  <Link href={`/proformas/${p.id}`}><Button size="sm" variant="outline">{t("pf.open")}</Button></Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      {creating && (
        <NewProformaDialog
          onClose={() => setCreating(false)}
          onCreated={() => { setCreating(false); qc.invalidateQueries({ queryKey: ["proformas"] }); }}
        />
      )}
    </div>
  );
}

function NewProformaDialog({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const t = useT();
  const [matterId, setMatterId] = useState("");
  const [periodFrom, setPeriodFrom] = useState("");
  const [periodTo, setPeriodTo] = useState("");
  const [vatRate, setVatRate] = useState(19.25);
  const [whtRate, setWhtRate] = useState(0);
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);

  const matters = useQuery({
    queryKey: ["matters"],
    queryFn: async () => {
      const res = await fetch("/api/matters");
      if (!res.ok) throw new Error("failed");
      return (await res.json()) as MatterOpt[];
    },
  });

  const create = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/proformas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ matterId, periodFrom: periodFrom || undefined, periodTo: periodTo || undefined, vatRate, whtRate, notes: notes || undefined }),
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
      <Card className="max-h-[90vh] w-full max-w-lg overflow-y-auto p-6">
        <h2 className="mb-1 text-lg font-semibold">{t("pf.new")}</h2>
        <p className="mb-4 text-sm text-slate-500">{t("pf.newHint")}</p>

        <label className="mb-1 block text-sm font-medium">{t("pf.matter")}</label>
        <select
          className="mb-4 h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-900"
          value={matterId} onChange={(e) => setMatterId(e.target.value)}
        >
          <option value="">—</option>
          {matters.data?.map((m) => <option key={m.id} value={m.id}>{m.code} — {m.name}</option>)}
        </select>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1 block text-xs font-medium">{t("pf.periodFrom")}</label>
            <Input type="date" value={periodFrom} onChange={(e) => setPeriodFrom(e.target.value)} />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium">{t("pf.periodTo")}</label>
            <Input type="date" value={periodTo} onChange={(e) => setPeriodTo(e.target.value)} />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium">{t("inv.vatRate")}</label>
            <Input type="number" value={vatRate} onChange={(e) => setVatRate(Number(e.target.value))} />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium">{t("inv.whtRate")}</label>
            <Input type="number" value={whtRate} onChange={(e) => setWhtRate(Number(e.target.value))} />
          </div>
        </div>

        <label className="mb-1 mt-3 block text-xs font-medium">{t("pf.notes")}</label>
        <textarea
          className="min-h-[60px] w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900"
          value={notes} onChange={(e) => setNotes(e.target.value)}
        />

        <p className="mt-3 text-xs text-slate-400">{t("pf.pullHint")}</p>
        {error && <p className="mt-2 text-sm text-red-600">{t(("err." + error) as never) || error}</p>}
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>{t("common.cancel")}</Button>
          <Button disabled={!matterId || create.isPending} onClick={() => create.mutate()}>{t("common.create")}</Button>
        </div>
      </Card>
    </div>
  );
}

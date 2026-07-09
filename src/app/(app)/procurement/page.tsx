"use client";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button, Input, Card, Badge } from "@/components/ui";
import { useT } from "@/lib/useT";
import { formatMoney } from "@/lib/money";

interface PR { id: string; number: string; description: string; amount: number; status: string; decisionNote: string | null; order: string | null }

const statusColor = (s: string) => (s === "APPROVED" ? "green" : s === "REJECTED" ? "red" : s === "ORDERED" ? "brand" : "amber");

export default function ProcurementPage() {
  const t = useT();
  const qc = useQueryClient();
  const [openNew, setOpenNew] = useState(false);

  const prs = useQuery({ queryKey: ["procurement"], queryFn: async () => (await fetch("/api/procurement")).json() as Promise<PR[]> });
  const me = useQuery({ queryKey: ["me"], queryFn: async () => (await fetch("/api/me")).json() as Promise<{ permissions: string[] }> });
  const canApprove = me.data?.permissions.includes("procure:approve");

  const act = useMutation({
    mutationFn: async (v: { id: string; action: "APPROVED" | "REJECTED" | "ORDER" }) => {
      const url = v.action === "ORDER" ? `/api/procurement/${v.id}/order` : `/api/procurement/${v.id}/decide`;
      const body = v.action === "ORDER" ? undefined : JSON.stringify({ decision: v.action });
      const r = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body });
      if (!r.ok) { const b = await r.json().catch(() => ({})); throw new Error(b.error || "failed"); }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["procurement"] }),
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-semibold">{t("proc.title")}</h1><p className="text-sm text-slate-500">{t("proc.subtitle")}</p></div>
        <Button onClick={() => setOpenNew(true)}>+ {t("proc.new")}</Button>
      </div>
      <Card className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500 dark:bg-slate-800/50">
            <tr><th className="px-4 py-3">#</th><th className="px-4 py-3">{t("proc.desc")}</th><th className="px-4 py-3 text-right">{t("proc.amount")}</th><th className="px-4 py-3">{t("inv.status")}</th><th className="px-4 py-3">PO</th><th className="px-4 py-3 text-right">{t("common.actions")}</th></tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {prs.isLoading && <tr><td colSpan={6} className="px-4 py-6 text-center text-slate-400">{t("common.loading")}</td></tr>}
            {prs.data?.length === 0 && <tr><td colSpan={6} className="px-4 py-6 text-center text-slate-400">—</td></tr>}
            {prs.data?.map((p) => (
              <tr key={p.id}>
                <td className="px-4 py-2.5 font-mono">{p.number}</td>
                <td className="px-4 py-2.5">{p.description}</td>
                <td className="px-4 py-2.5 text-right">{formatMoney(p.amount)}</td>
                <td className="px-4 py-2.5"><Badge color={statusColor(p.status)}>{p.status}</Badge></td>
                <td className="px-4 py-2.5 font-mono text-slate-500">{p.order ?? "—"}</td>
                <td className="px-4 py-2.5">
                  <div className="flex justify-end gap-2">
                    {canApprove && p.status === "PENDING" && (<>
                      <Button size="sm" onClick={() => act.mutate({ id: p.id, action: "APPROVED" })}>{t("proc.approve")}</Button>
                      <Button size="sm" variant="danger" onClick={() => act.mutate({ id: p.id, action: "REJECTED" })}>{t("proc.reject")}</Button>
                    </>)}
                    {canApprove && p.status === "APPROVED" && (
                      <Button size="sm" variant="outline" onClick={() => act.mutate({ id: p.id, action: "ORDER" })}>{t("proc.order")}</Button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
      {openNew && <NewPR onClose={() => setOpenNew(false)} onDone={() => { setOpenNew(false); qc.invalidateQueries({ queryKey: ["procurement"] }); }} />}
    </div>
  );
}

function NewPR({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const t = useT();
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState(0);
  const [err, setErr] = useState<string | null>(null);
  const create = useMutation({
    mutationFn: async () => { const r = await fetch("/api/procurement", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ description, amount }) }); if (!r.ok) throw new Error(); },
    onSuccess: onDone, onError: () => setErr("Could not create request."),
  });
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"><Card className="w-full max-w-md p-6">
      <h2 className="mb-4 text-lg font-semibold">{t("proc.new")}</h2>
      <div className="space-y-3">
        <div><label className="mb-1 block text-sm font-medium">{t("proc.desc")}</label><Input value={description} onChange={(e) => setDescription(e.target.value)} /></div>
        <div><label className="mb-1 block text-sm font-medium">{t("proc.amount")}</label><Input type="number" value={amount} onChange={(e) => setAmount(Number(e.target.value))} /></div>
        {err && <p className="text-sm text-red-600">{err}</p>}
        <div className="flex justify-end gap-2 pt-1"><Button variant="outline" onClick={onClose}>{t("common.cancel")}</Button><Button disabled={!description || amount <= 0 || create.isPending} onClick={() => create.mutate()}>{t("common.create")}</Button></div>
      </div>
    </Card></div>
  );
}

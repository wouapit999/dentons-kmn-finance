"use client";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button, Input, Card, Badge } from "@/components/ui";
import { useT } from "@/lib/useT";
import { formatMoney } from "@/lib/money";

interface BankAccount { id: string; name: string; bankName: string | null; glAccountCode: string; bookBalance: number; clearedBalance: number; transactions: number }
interface Meta { accounts: { code: string; name: string }[] }
interface Detail { id: string; name: string; bookBalance: number; clearedBalance: number; unreconciled: number; transactions: { id: string; date: string; type: string; amount: number; description: string; reconciled: boolean; signed: number }[] }

export default function BankPage() {
  const t = useT();
  const qc = useQueryClient();
  const [openNew, setOpenNew] = useState(false);
  const [txnFor, setTxnFor] = useState<BankAccount | null>(null);
  const [viewId, setViewId] = useState<string | null>(null);
  const accounts = useQuery({ queryKey: ["bank"], queryFn: async () => (await fetch("/api/bank")).json() as Promise<BankAccount[]> });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-semibold">{t("bank.title")}</h1><p className="text-sm text-slate-500">{t("bank.subtitle")}</p></div>
        <Button onClick={() => setOpenNew(true)}>+ {t("bank.new")}</Button>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {accounts.data?.map((a) => (
          <Card key={a.id} className="p-5">
            <div className="text-sm font-medium">{a.name}</div>
            <div className="text-xs text-slate-400">{a.bankName ?? ""} · {a.glAccountCode}</div>
            <div className="mt-2 text-2xl font-semibold">{formatMoney(a.bookBalance)}</div>
            <div className="text-xs text-slate-400">{t("bank.cleared")}: {formatMoney(a.clearedBalance)}</div>
            <div className="mt-3 flex gap-2">
              <Button size="sm" variant="outline" onClick={() => setTxnFor(a)}>{t("bank.record")}</Button>
              <Button size="sm" variant="ghost" onClick={() => setViewId(a.id)}>{t("bank.reconcile")}</Button>
            </div>
          </Card>
        ))}
        {accounts.data?.length === 0 && <p className="text-slate-400">—</p>}
      </div>
      {openNew && <NewAccount onClose={() => setOpenNew(false)} onDone={() => { setOpenNew(false); qc.invalidateQueries({ queryKey: ["bank"] }); }} />}
      {txnFor && <TxnDialog acct={txnFor} onClose={() => setTxnFor(null)} onDone={() => { setTxnFor(null); qc.invalidateQueries({ queryKey: ["bank"] }); }} />}
      {viewId && <ReconcileDialog id={viewId} onClose={() => setViewId(null)} onChange={() => qc.invalidateQueries({ queryKey: ["bank"] })} />}
    </div>
  );
}

function NewAccount({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const t = useT();
  const [form, setForm] = useState({ name: "", bankName: "", accountNumber: "", glAccountCode: "521000" });
  const [err, setErr] = useState<string | null>(null);
  const create = useMutation({
    mutationFn: async () => { const r = await fetch("/api/bank", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) }); if (!r.ok) throw new Error(); },
    onSuccess: onDone, onError: () => setErr("Could not open account."),
  });
  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"><Card className="w-full max-w-md p-6">
      <h2 className="mb-4 text-lg font-semibold">{t("bank.new")}</h2>
      <div className="space-y-3">
        <div><label className="mb-1 block text-sm font-medium">{t("gl.name")}</label><Input value={form.name} onChange={(e) => set("name", e.target.value)} /></div>
        <div className="grid grid-cols-2 gap-3">
          <div><label className="mb-1 block text-sm font-medium">Bank</label><Input value={form.bankName} onChange={(e) => set("bankName", e.target.value)} /></div>
          <div><label className="mb-1 block text-sm font-medium">Account no.</label><Input value={form.accountNumber} onChange={(e) => set("accountNumber", e.target.value)} /></div>
        </div>
      </div>
      {err && <p className="mt-2 text-sm text-red-600">{err}</p>}
      <div className="mt-4 flex justify-end gap-2"><Button variant="outline" onClick={onClose}>{t("common.cancel")}</Button><Button disabled={!form.name || create.isPending} onClick={() => create.mutate()}>{t("common.create")}</Button></div>
    </Card></div>
  );
}

function TxnDialog({ acct, onClose, onDone }: { acct: BankAccount; onClose: () => void; onDone: () => void }) {
  const t = useT();
  const [type, setType] = useState("CHARGE");
  const [amount, setAmount] = useState(0);
  const [description, setDescription] = useState("");
  const [counterpart, setCounterpart] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const meta = useQuery({ queryKey: ["bank-meta"], queryFn: async () => (await fetch("/api/bank/meta")).json() as Promise<Meta> });
  const save = useMutation({
    mutationFn: async () => { const r = await fetch("/api/bank/transactions", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ bankAccountId: acct.id, date: new Date().toISOString().slice(0, 10), type, amount, description, counterpartAccountCode: counterpart }) }); if (!r.ok) { const b = await r.json().catch(() => ({})); throw new Error(b.error || "failed"); } },
    onSuccess: onDone, onError: (e: Error) => setErr(e.message),
  });
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"><Card className="w-full max-w-md p-6">
      <h2 className="mb-1 text-lg font-semibold">{t("bank.record")}</h2>
      <p className="mb-4 text-sm text-slate-500">{acct.name}</p>
      <div className="space-y-3">
        <div><label className="mb-1 block text-sm font-medium">{t("common.type")}</label>
          <select className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-900" value={type} onChange={(e) => setType(e.target.value)}>
            <option value="CHARGE">CHARGE</option><option value="INTEREST">INTEREST</option><option value="TRANSFER_IN">TRANSFER_IN</option><option value="TRANSFER_OUT">TRANSFER_OUT</option>
          </select></div>
        <div><label className="mb-1 block text-sm font-medium">{t("common.amount")}</label><Input type="number" value={amount} onChange={(e) => setAmount(Number(e.target.value))} /></div>
        <div><label className="mb-1 block text-sm font-medium">{t("cash.counterpart")}</label>
          <select className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-900" value={counterpart} onChange={(e) => setCounterpart(e.target.value)}>
            <option value="">—</option>{meta.data?.accounts.map((a) => <option key={a.code} value={a.code}>{a.name}</option>)}
          </select></div>
        <div><label className="mb-1 block text-sm font-medium">{t("common.description")}</label><Input value={description} onChange={(e) => setDescription(e.target.value)} /></div>
        {err && <p className="text-sm text-red-600">{err}</p>}
        <div className="flex justify-end gap-2 pt-1"><Button variant="outline" onClick={onClose}>{t("common.cancel")}</Button><Button disabled={amount <= 0 || !counterpart || !description || save.isPending} onClick={() => save.mutate()}>{t("common.save")}</Button></div>
      </div>
    </Card></div>
  );
}

function ReconcileDialog({ id, onClose, onChange }: { id: string; onClose: () => void; onChange: () => void }) {
  const t = useT();
  const qc = useQueryClient();
  const detail = useQuery({ queryKey: ["bank", id], queryFn: async () => (await fetch(`/api/bank/${id}`)).json() as Promise<Detail> });
  const toggle = useMutation({
    mutationFn: async (v: { transactionId: string; reconciled: boolean }) => { const r = await fetch("/api/bank/reconcile", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(v) }); if (!r.ok) throw new Error(); },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["bank", id] }); onChange(); },
  });
  const d = detail.data;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"><Card className="max-h-[90vh] w-full max-w-2xl overflow-y-auto p-6">
      <div className="mb-4 flex items-center justify-between"><h2 className="text-lg font-semibold">{t("bank.reconcile")} · {d?.name ?? ""}</h2><Button size="sm" variant="ghost" onClick={onClose}>✕</Button></div>
      {!d ? <p className="text-slate-400">{t("common.loading")}</p> : (
        <>
          <div className="mb-4 grid grid-cols-3 gap-3 text-sm">
            <div className="rounded-md border border-slate-200 p-3 dark:border-slate-700"><div className="text-xs text-slate-500">{t("bank.book")}</div><div className="font-semibold">{formatMoney(d.bookBalance)}</div></div>
            <div className="rounded-md border border-slate-200 p-3 dark:border-slate-700"><div className="text-xs text-slate-500">{t("bank.cleared")}</div><div className="font-semibold">{formatMoney(d.clearedBalance)}</div></div>
            <div className="rounded-md border border-slate-200 p-3 dark:border-slate-700"><div className="text-xs text-slate-500">{t("bank.unreconciled")}</div><div className="font-semibold">{formatMoney(d.unreconciled)}</div></div>
          </div>
          <table className="w-full text-sm">
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {d.transactions.map((x) => (
                <tr key={x.id}>
                  <td className="py-2"><input type="checkbox" checked={x.reconciled} onChange={(e) => toggle.mutate({ transactionId: x.id, reconciled: e.target.checked })} /></td>
                  <td className="py-2 text-slate-500">{new Date(x.date).toLocaleDateString()}</td>
                  <td className="py-2"><Badge color="slate">{x.type}</Badge></td>
                  <td className="py-2">{x.description}</td>
                  <td className="py-2 text-right">{formatMoney(x.signed)}</td>
                </tr>
              ))}
              {d.transactions.length === 0 && <tr><td colSpan={5} className="py-6 text-center text-slate-400">—</td></tr>}
            </tbody>
          </table>
        </>
      )}
    </Card></div>
  );
}

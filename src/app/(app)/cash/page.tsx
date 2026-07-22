"use client";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button, Input, Card } from "@/components/ui";
import { useT } from "@/lib/useT";
import { usePerms, getJson } from "@/lib/usePerms";
import { formatMoney } from "@/lib/money";

interface CashAccount { id: string; name: string; glAccountCode: string; balance: number; currency: string; transactions: number }
interface Meta { accounts: { code: string; name: string }[] }

export default function CashPage() {
  const t = useT();
  const qc = useQueryClient();
  const [openNew, setOpenNew] = useState(false);
  const [txnFor, setTxnFor] = useState<CashAccount | null>(null);

  const { can } = usePerms();
  const accounts = useQuery({ queryKey: ["cash"], queryFn: () => getJson<CashAccount[]>("/api/cash") });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-semibold">{t("cash.title")}</h1><p className="text-sm text-slate-500">{t("cash.subtitle")}</p></div>
        {can("cash:manage") && <Button onClick={() => setOpenNew(true)}>+ {t("cash.new")}</Button>}
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {accounts.data?.map((a) => (
          <Card key={a.id} className="p-5">
            <div className="text-sm text-slate-500">{a.name}</div>
            <div className="mt-1 text-2xl font-semibold">{formatMoney(a.balance, a.currency)}</div>
            <div className="mt-1 text-xs text-slate-400">{a.glAccountCode} · {a.transactions} movements</div>
            {can("cash:manage") && <Button size="sm" variant="outline" className="mt-3" onClick={() => setTxnFor(a)}>{t("cash.record")}</Button>}
          </Card>
        ))}
        {accounts.data?.length === 0 && <p className="text-slate-400">—</p>}
      </div>
      {openNew && <NewAccount onClose={() => setOpenNew(false)} onDone={() => { setOpenNew(false); qc.invalidateQueries({ queryKey: ["cash"] }); }} />}
      {txnFor && <TxnDialog acct={txnFor} onClose={() => setTxnFor(null)} onDone={() => { setTxnFor(null); qc.invalidateQueries({ queryKey: ["cash"] }); }} />}
    </div>
  );
}

function NewAccount({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const t = useT();
  const [name, setName] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const create = useMutation({
    mutationFn: async () => { const r = await fetch("/api/cash", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name, glAccountCode: "571000" }) }); if (!r.ok) throw new Error(); },
    onSuccess: onDone, onError: () => setErr("Could not open account."),
  });
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"><Card className="w-full max-w-sm p-6">
      <h2 className="mb-4 text-lg font-semibold">{t("cash.new")}</h2>
      <label className="mb-1 block text-sm font-medium">{t("gl.name")}</label>
      <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Main petty cash" />
      {err && <p className="mt-2 text-sm text-red-600">{err}</p>}
      <div className="mt-4 flex justify-end gap-2"><Button variant="outline" onClick={onClose}>{t("common.cancel")}</Button><Button disabled={!name || create.isPending} onClick={() => create.mutate()}>{t("common.create")}</Button></div>
    </Card></div>
  );
}

function TxnDialog({ acct, onClose, onDone }: { acct: CashAccount; onClose: () => void; onDone: () => void }) {
  const t = useT();
  const [type, setType] = useState("OUT");
  const [amount, setAmount] = useState(0);
  const [description, setDescription] = useState("");
  const [counterpart, setCounterpart] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const meta = useQuery({ queryKey: ["cash-meta"], queryFn: () => getJson<Meta>("/api/cash/meta") });
  const save = useMutation({
    mutationFn: async () => {
      const r = await fetch("/api/cash/transactions", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ cashAccountId: acct.id, date: new Date().toISOString().slice(0, 10), type, amount, description, counterpartAccountCode: counterpart }) });
      if (!r.ok) { const b = await r.json().catch(() => ({})); throw new Error(b.error || "failed"); }
    },
    onSuccess: onDone, onError: (e: Error) => setErr(e.message === "insufficient_cash" ? "Insufficient cash balance." : e.message),
  });
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"><Card className="w-full max-w-md p-6">
      <h2 className="mb-1 text-lg font-semibold">{t("cash.record")}</h2>
      <p className="mb-4 text-sm text-slate-500">{acct.name} · {formatMoney(acct.balance, acct.currency)}</p>
      <div className="space-y-3">
        <div><label className="mb-1 block text-sm font-medium">{t("common.type")}</label>
          <select className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-900" value={type} onChange={(e) => setType(e.target.value)}>
            <option value="OUT">{t("cash.out")}</option><option value="IN">{t("cash.in")}</option>
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

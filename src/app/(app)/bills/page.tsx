"use client";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button, Input, Card, Badge } from "@/components/ui";
import { useT } from "@/lib/useT";
import { usePerms, getJson } from "@/lib/usePerms";
import { formatMoney } from "@/lib/money";

interface Bill {
  id: string;
  number: string;
  supplier: string;
  description: string;
  currency: string;
  subtotal: number;
  vatAmount: number;
  total: number;
  outstanding: number;
  status: string;
  posted: boolean;
}
interface Meta {
  suppliers: { id: string; name: string }[];
  expenseAccounts: { code: string; name: string }[];
}

const statusColor = (s: string) =>
  s === "PAID" ? "green" : s === "PART_PAID" ? "amber" : s === "POSTED" ? "brand" : "slate";

export default function BillsPage() {
  const t = useT();
  const { can } = usePerms();
  const qc = useQueryClient();
  const [creating, setCreating] = useState(false);
  const [payFor, setPayFor] = useState<Bill | null>(null);

  const bills = useQuery({
    queryKey: ["bills"],
    queryFn: () => getJson<Bill[]>("/api/bills"),
  });

  const post = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/bills/${id}/post`, { method: "POST" });
      if (!res.ok) throw new Error();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["bills"] }),
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">{t("bill.title")}</h1>
          <p className="text-sm text-slate-500">{t("bill.subtitle")}</p>
        </div>
        {can("ap:manage") && <Button onClick={() => setCreating(true)}>+ {t("bill.new")}</Button>}
      </div>

      <Card className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500 dark:bg-slate-800/50">
            <tr>
              <th className="px-4 py-3">{t("bill.number")}</th>
              <th className="px-4 py-3">{t("bill.supplier")}</th>
              <th className="px-4 py-3 text-right">{t("bill.amount")}</th>
              <th className="px-4 py-3 text-right">{t("bill.vat")}</th>
              <th className="px-4 py-3 text-right">{t("bill.total")}</th>
              <th className="px-4 py-3 text-right">{t("bill.outstanding")}</th>
              <th className="px-4 py-3">{t("inv.status")}</th>
              <th className="px-4 py-3 text-right">{t("common.actions")}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {bills.isLoading && (
              <tr><td colSpan={8} className="px-4 py-6 text-center text-slate-400">{t("common.loading")}</td></tr>
            )}
            {bills.data?.length === 0 && (
              <tr><td colSpan={8} className="px-4 py-6 text-center text-slate-400">—</td></tr>
            )}
            {bills.data?.map((b) => (
              <tr key={b.id}>
                <td className="px-4 py-2.5 font-mono">{b.number}</td>
                <td className="px-4 py-2.5">{b.supplier}</td>
                <td className="px-4 py-2.5 text-right">{formatMoney(b.subtotal, b.currency)}</td>
                <td className="px-4 py-2.5 text-right">{formatMoney(b.vatAmount, b.currency)}</td>
                <td className="px-4 py-2.5 text-right font-medium">{formatMoney(b.total, b.currency)}</td>
                <td className="px-4 py-2.5 text-right">{formatMoney(b.outstanding, b.currency)}</td>
                <td className="px-4 py-2.5"><Badge color={statusColor(b.status)}>{b.status}</Badge></td>
                <td className="px-4 py-2.5">
                  <div className="flex justify-end gap-2">
                    {!b.posted && can("ap:approve") && (
                      <Button size="sm" disabled={post.isPending} onClick={() => post.mutate(b.id)}>{t("bill.post")}</Button>
                    )}
                    {b.posted && b.outstanding > 0 && can("ap:approve") && (
                      <Button size="sm" variant="outline" onClick={() => setPayFor(b)}>{t("bill.pay")}</Button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      {creating && (
        <NewBillDialog onClose={() => setCreating(false)} onCreated={() => { setCreating(false); qc.invalidateQueries({ queryKey: ["bills"] }); }} />
      )}
      {payFor && (
        <PayDialog bill={payFor} onClose={() => setPayFor(null)} onDone={() => { setPayFor(null); qc.invalidateQueries({ queryKey: ["bills"] }); }} />
      )}
    </div>
  );
}

function NewBillDialog({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const t = useT();
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    supplierId: "", supplierRef: "", description: "", expenseAccountCode: "",
    amount: 0, vatRate: 19.25,
  });
  const today = new Date().toISOString().slice(0, 10);
  const due = new Date(Date.now() + 30 * 864e5).toISOString().slice(0, 10);

  const meta = useQuery({
    queryKey: ["bills-meta"],
    queryFn: () => getJson<Meta>("/api/bills/meta"),
  });

  const vat = Math.round(form.amount * (form.vatRate / 100) * 100) / 100;
  const total = Math.round((form.amount + vat) * 100) / 100;

  const create = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/bills", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, amount: Number(form.amount), date: today, dueDate: due }),
      });
      if (!res.ok) { const b = await res.json().catch(() => ({})); throw new Error(b.error || "failed"); }
    },
    onSuccess: onCreated,
    onError: (e: Error) => setError(e.message),
  });

  const set = (k: string, v: any) => setForm((f) => ({ ...f, [k]: v }));
  const noSuppliers = meta.data && meta.data.suppliers.length === 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <Card className="w-full max-w-lg p-6">
        <h2 className="mb-4 text-lg font-semibold">{t("bill.new")}</h2>
        {noSuppliers ? (
          <p className="text-sm text-amber-600">Create a supplier first.</p>
        ) : (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-sm font-medium">{t("bill.supplier")}</label>
                <select className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-900" value={form.supplierId} onChange={(e) => set("supplierId", e.target.value)}>
                  <option value="">—</option>
                  {meta.data?.suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">{t("bill.ref")}</label>
                <Input value={form.supplierRef} onChange={(e) => set("supplierRef", e.target.value)} />
              </div>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">{t("bill.desc")}</label>
              <Input value={form.description} onChange={(e) => set("description", e.target.value)} />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">{t("bill.account")}</label>
              <select className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-900" value={form.expenseAccountCode} onChange={(e) => set("expenseAccountCode", e.target.value)}>
                <option value="">—</option>
                {meta.data?.expenseAccounts.map((a) => <option key={a.code} value={a.code}>{a.name}</option>)}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-sm font-medium">{t("bill.amount")}</label>
                <Input type="number" value={form.amount} onChange={(e) => set("amount", Number(e.target.value))} />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">{t("inv.vatRate")}</label>
                <Input type="number" value={form.vatRate} onChange={(e) => set("vatRate", Number(e.target.value))} />
              </div>
            </div>
            <div className="space-y-1 rounded-md bg-slate-50 p-3 text-sm dark:bg-slate-800/50">
              <div className="flex justify-between text-slate-500"><span>{t("bill.vat")}</span><span>{formatMoney(vat)}</span></div>
              <div className="flex justify-between font-semibold"><span>{t("bill.total")}</span><span>{formatMoney(total)}</span></div>
            </div>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <div className="flex justify-end gap-2 pt-1">
              <Button variant="outline" onClick={onClose}>{t("common.cancel")}</Button>
              <Button disabled={!form.supplierId || !form.expenseAccountCode || form.amount <= 0 || create.isPending} onClick={() => create.mutate()}>{t("common.create")}</Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}

function PayDialog({ bill, onClose, onDone }: { bill: Bill; onClose: () => void; onDone: () => void }) {
  const t = useT();
  const [amount, setAmount] = useState(bill.outstanding);
  const [method, setMethod] = useState("BANK");
  const [reference, setReference] = useState("");
  const [error, setError] = useState<string | null>(null);

  const pay = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/vendor-payments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ billId: bill.id, date: new Date().toISOString().slice(0, 10), amount, method, reference: reference || undefined }),
      });
      if (!res.ok) { const b = await res.json().catch(() => ({})); throw new Error(b.error || "failed"); }
    },
    onSuccess: onDone,
    onError: (e: Error) => setError(e.message),
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <Card className="w-full max-w-sm p-6">
        <h2 className="mb-1 text-lg font-semibold">{t("pay.title")}</h2>
        <p className="mb-4 text-sm text-slate-500">{bill.number} · {t("bill.outstanding")}: {formatMoney(bill.outstanding, bill.currency)}</p>
        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-sm font-medium">{t("pay.amount")}</label>
            <Input type="number" value={amount} onChange={(e) => setAmount(Number(e.target.value))} />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">{t("pay.method")}</label>
            <select className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-900" value={method} onChange={(e) => setMethod(e.target.value)}>
              <option value="BANK">BANK</option>
              <option value="TRANSFER">TRANSFER</option>
              <option value="CHEQUE">CHEQUE</option>
              <option value="MOBILE">MOBILE</option>
              <option value="CASH">CASH</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">{t("pay.reference")}</label>
            <Input value={reference} onChange={(e) => setReference(e.target.value)} />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex justify-end gap-2 pt-1">
            <Button variant="outline" onClick={onClose}>{t("common.cancel")}</Button>
            <Button disabled={amount <= 0 || pay.isPending} onClick={() => pay.mutate()}>{t("common.save")}</Button>
          </div>
        </div>
      </Card>
    </div>
  );
}

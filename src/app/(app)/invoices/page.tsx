"use client";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button, Input, Card, Badge } from "@/components/ui";
import { useT } from "@/lib/useT";
import { formatMoney } from "@/lib/money";

interface Invoice {
  id: string;
  number: string;
  client: string;
  matter: string | null;
  date: string;
  currency: string;
  subtotal: number;
  vatAmount: number;
  whtAmount: number;
  total: number;
  amountPaid: number;
  outstanding: number;
  status: string;
  posted: boolean;
}
interface MatterOpt { id: string; code: string; name: string }
interface Unbilled {
  matter: { id: string; code: string; name: string; currency: string };
  time: { id: string; date: string; lawyer: string; hours: number; narrative: string | null; amount: number }[];
  disbursements: { id: string; date: string; description: string; amount: number }[];
}

const statusColor = (s: string) =>
  s === "PAID" ? "green" : s === "PART_PAID" ? "amber" : s === "POSTED" ? "brand" : "slate";

export default function InvoicesPage() {
  const t = useT();
  const qc = useQueryClient();
  const [creating, setCreating] = useState(false);
  const [receiptFor, setReceiptFor] = useState<Invoice | null>(null);

  const me = useQuery({
    queryKey: ["me"],
    queryFn: async () => (await fetch("/api/me")).json() as Promise<{ permissions: string[] }>,
  });
  const canCreate = me.data?.permissions.includes("invoice:create") ?? false;
  const canReceipt = me.data?.permissions.includes("payment:create") ?? false;
  const canPost = me.data?.permissions.includes("invoice:approve") ?? false;

  const invoices = useQuery({
    queryKey: ["invoices"],
    queryFn: async () => {
      const res = await fetch("/api/invoices");
      if (!res.ok) throw new Error("failed_to_load_invoices");
      return (await res.json()) as Invoice[];
    },
  });

  const post = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/invoices/${id}/post`, { method: "POST" });
      if (!res.ok) throw new Error();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["invoices"] }),
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">{t("inv.title")}</h1>
          <p className="text-sm text-slate-500">{t("inv.subtitle")}</p>
        </div>
        {canCreate && <Button onClick={() => setCreating(true)}>+ {t("inv.new")}</Button>}
      </div>

      <Card className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500 dark:bg-slate-800/50">
            <tr>
              <th className="px-4 py-3">{t("inv.number")}</th>
              <th className="px-4 py-3">{t("inv.client")}</th>
              <th className="px-4 py-3 text-right">{t("inv.subtotal")}</th>
              <th className="px-4 py-3 text-right">{t("inv.vat")}</th>
              <th className="px-4 py-3 text-right">{t("inv.total")}</th>
              <th className="px-4 py-3 text-right">{t("inv.outstanding")}</th>
              <th className="px-4 py-3">{t("inv.status")}</th>
              <th className="px-4 py-3 text-right">{t("common.actions")}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {invoices.isLoading && (
              <tr><td colSpan={8} className="px-4 py-6 text-center text-slate-400">{t("common.loading")}</td></tr>
            )}
            {invoices.data?.length === 0 && (
              <tr><td colSpan={8} className="px-4 py-6 text-center text-slate-400">—</td></tr>
            )}
            {invoices.data?.map((i) => (
              <tr key={i.id}>
                <td className="px-4 py-2.5 font-mono">{i.number}</td>
                <td className="px-4 py-2.5">{i.client}</td>
                <td className="px-4 py-2.5 text-right">{formatMoney(i.subtotal, i.currency)}</td>
                <td className="px-4 py-2.5 text-right">{formatMoney(i.vatAmount, i.currency)}</td>
                <td className="px-4 py-2.5 text-right font-medium">{formatMoney(i.total, i.currency)}</td>
                <td className="px-4 py-2.5 text-right">{formatMoney(i.outstanding, i.currency)}</td>
                <td className="px-4 py-2.5"><Badge color={statusColor(i.status)}>{i.status}</Badge></td>
                <td className="px-4 py-2.5">
                  <div className="flex justify-end gap-2">
                    {!i.posted && canPost && (
                      <Button size="sm" disabled={post.isPending} onClick={() => post.mutate(i.id)}>
                        {t("inv.post")}
                      </Button>
                    )}
                    {i.posted && i.outstanding > 0 && canReceipt && (
                      <Button size="sm" variant="outline" onClick={() => setReceiptFor(i)}>
                        {t("inv.receipt")}
                      </Button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      {creating && (
        <NewInvoiceDialog
          onClose={() => setCreating(false)}
          onCreated={() => {
            setCreating(false);
            qc.invalidateQueries({ queryKey: ["invoices"] });
          }}
        />
      )}
      {receiptFor && (
        <ReceiptDialog
          invoice={receiptFor}
          onClose={() => setReceiptFor(null)}
          onDone={() => {
            setReceiptFor(null);
            qc.invalidateQueries({ queryKey: ["invoices"] });
          }}
        />
      )}
    </div>
  );
}

function NewInvoiceDialog({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const t = useT();
  const [matterId, setMatterId] = useState("");
  const [selTime, setSelTime] = useState<string[]>([]);
  const [selDisb, setSelDisb] = useState<string[]>([]);
  const [vatRate, setVatRate] = useState(19.25);
  const [whtRate, setWhtRate] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const today = new Date().toISOString().slice(0, 10);
  const due = new Date(Date.now() + 30 * 864e5).toISOString().slice(0, 10);

  const matters = useQuery({
    queryKey: ["matters"],
    queryFn: async () => {
      const res = await fetch("/api/matters");
      if (!res.ok) throw new Error("failed");
      return (await res.json()) as MatterOpt[];
    },
  });
  const unbilled = useQuery({
    queryKey: ["unbilled", matterId],
    enabled: !!matterId,
    queryFn: async () => {
      const res = await fetch(`/api/billing/unbilled?matterId=${matterId}`);
      if (!res.ok) throw new Error("failed");
      return (await res.json()) as Unbilled;
    },
  });

  // Defensive: only ever treat these as arrays, so a failed/partial response
  // can never crash the render.
  const timeItems = Array.isArray(unbilled.data?.time) ? unbilled.data!.time : [];
  const disbItems = Array.isArray(unbilled.data?.disbursements) ? unbilled.data!.disbursements : [];
  const feeTotal = timeItems.filter((x) => selTime.includes(x.id)).reduce((s, x) => s + x.amount, 0);
  const disbTotal = disbItems.filter((x) => selDisb.includes(x.id)).reduce((s, x) => s + x.amount, 0);
  const subtotal = feeTotal + disbTotal;
  const vat = Math.round(subtotal * (vatRate / 100) * 100) / 100;
  const wht = Math.round(feeTotal * (whtRate / 100) * 100) / 100;
  const total = Math.round((subtotal + vat - wht) * 100) / 100;

  const create = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/invoices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          matterId,
          date: today,
          dueDate: due,
          vatRate,
          whtRate,
          timeEntryIds: selTime,
          disbursementIds: selDisb,
        }),
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
      <Card className="max-h-[90vh] w-full max-w-2xl overflow-y-auto p-6">
        <h2 className="mb-4 text-lg font-semibold">{t("inv.new")}</h2>

        <label className="mb-1 block text-sm font-medium">{t("inv.matter")}</label>
        <select
          className="mb-4 h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-900"
          value={matterId}
          onChange={(e) => { setMatterId(e.target.value); setSelTime([]); setSelDisb([]); }}
        >
          <option value="">—</option>
          {matters.data?.map((m) => <option key={m.id} value={m.id}>{m.code} — {m.name}</option>)}
        </select>

        {matterId && unbilled.isLoading && (
          <p className="text-sm text-slate-400">{t("common.loading")}</p>
        )}
        {matterId && unbilled.isError && (
          <p className="text-sm text-red-600">{t("inv.loadError")}</p>
        )}
        {matterId && unbilled.data && (
          <>
            {timeItems.length === 0 && disbItems.length === 0 && (
              <p className="text-sm text-amber-600">{t("inv.noUnbilled")}</p>
            )}
            {timeItems.length > 0 && (
              <div className="mb-3">
                <div className="mb-1 text-xs font-semibold uppercase text-slate-500">{t("inv.timeItems")}</div>
                {timeItems.map((x) => (
                  <label key={x.id} className="flex items-center gap-2 py-0.5 text-sm">
                    <input type="checkbox" checked={selTime.includes(x.id)}
                      onChange={(e) => setSelTime((s) => e.target.checked ? [...s, x.id] : s.filter((i) => i !== x.id))} />
                    <span className="flex-1">{x.hours}h · {x.narrative ?? "—"} · {x.lawyer}</span>
                    <span>{formatMoney(x.amount)}</span>
                  </label>
                ))}
              </div>
            )}
            {disbItems.length > 0 && (
              <div className="mb-3">
                <div className="mb-1 text-xs font-semibold uppercase text-slate-500">{t("inv.disbItems")}</div>
                {disbItems.map((x) => (
                  <label key={x.id} className="flex items-center gap-2 py-0.5 text-sm">
                    <input type="checkbox" checked={selDisb.includes(x.id)}
                      onChange={(e) => setSelDisb((s) => e.target.checked ? [...s, x.id] : s.filter((i) => i !== x.id))} />
                    <span className="flex-1">{x.description}</span>
                    <span>{formatMoney(x.amount)}</span>
                  </label>
                ))}
              </div>
            )}

            <div className="mt-4 grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-xs font-medium">{t("inv.vatRate")}</label>
                <Input type="number" value={vatRate} onChange={(e) => setVatRate(Number(e.target.value))} />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium">{t("inv.whtRate")}</label>
                <Input type="number" value={whtRate} onChange={(e) => setWhtRate(Number(e.target.value))} />
              </div>
            </div>

            <div className="mt-4 space-y-1 rounded-md bg-slate-50 p-3 text-sm dark:bg-slate-800/50">
              <div className="flex justify-between"><span>{t("inv.subtotal")}</span><span>{formatMoney(subtotal)}</span></div>
              <div className="flex justify-between text-slate-500"><span>{t("inv.vat")} ({vatRate}%)</span><span>{formatMoney(vat)}</span></div>
              <div className="flex justify-between text-slate-500"><span>{t("inv.wht")} ({whtRate}%)</span><span>-{formatMoney(wht)}</span></div>
              <div className="flex justify-between border-t border-slate-200 pt-1 font-semibold dark:border-slate-700"><span>{t("inv.total")}</span><span>{formatMoney(total)}</span></div>
            </div>
          </>
        )}

        {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>{t("common.cancel")}</Button>
          <Button disabled={total <= 0 || create.isPending} onClick={() => create.mutate()}>
            {t("common.create")}
          </Button>
        </div>
      </Card>
    </div>
  );
}

function ReceiptDialog({ invoice, onClose, onDone }: { invoice: Invoice; onClose: () => void; onDone: () => void }) {
  const t = useT();
  const [amount, setAmount] = useState(invoice.outstanding);
  const [method, setMethod] = useState("BANK");
  const [reference, setReference] = useState("");
  const [error, setError] = useState<string | null>(null);

  const save = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/receipts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          invoiceId: invoice.id,
          date: new Date().toISOString().slice(0, 10),
          amount,
          method,
          reference: reference || undefined,
        }),
      });
      if (!res.ok) {
        const b = await res.json().catch(() => ({}));
        throw new Error(b.error || "failed");
      }
    },
    onSuccess: onDone,
    onError: (e: Error) => setError(e.message),
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <Card className="w-full max-w-sm p-6">
        <h2 className="mb-1 text-lg font-semibold">{t("receipt.title")}</h2>
        <p className="mb-4 text-sm text-slate-500">{invoice.number} · {t("inv.outstanding")}: {formatMoney(invoice.outstanding, invoice.currency)}</p>
        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-sm font-medium">{t("receipt.amount")}</label>
            <Input type="number" value={amount} onChange={(e) => setAmount(Number(e.target.value))} />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">{t("receipt.method")}</label>
            <select className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-900" value={method} onChange={(e) => setMethod(e.target.value)}>
              <option value="BANK">BANK</option>
              <option value="TRANSFER">TRANSFER</option>
              <option value="CHEQUE">CHEQUE</option>
              <option value="MOBILE">MOBILE</option>
              <option value="CASH">CASH</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">{t("receipt.reference")}</label>
            <Input value={reference} onChange={(e) => setReference(e.target.value)} />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex justify-end gap-2 pt-1">
            <Button variant="outline" onClick={onClose}>{t("common.cancel")}</Button>
            <Button disabled={amount <= 0 || save.isPending} onClick={() => save.mutate()}>{t("common.save")}</Button>
          </div>
        </div>
      </Card>
    </div>
  );
}

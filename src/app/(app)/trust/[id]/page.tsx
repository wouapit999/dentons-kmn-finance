"use client";
import { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button, Input, Card, Badge } from "@/components/ui";
import { useT } from "@/lib/useT";
import { usePerms, getJson } from "@/lib/usePerms";
import { formatMoney } from "@/lib/money";

interface Detail {
  id: string;
  client: string;
  currency: string;
  balance: number;
  status: string;
  openInvoices: { id: string; number: string; outstanding: number }[];
  entries: { id: string; date: string; type: string; amount: number; runningBalance: number; reference: string | null }[];
}

const typeColor = (tp: string) => (tp === "DEPOSIT" ? "green" : tp === "APPLIED" ? "brand" : "amber");

export default function TrustDetailPage() {
  const t = useT();
  const qc = useQueryClient();
  const { id } = useParams<{ id: string }>();

  const { can } = usePerms();
  const acct = useQuery({
    queryKey: ["trust", id],
    queryFn: () => getJson<Detail>(`/api/trust/${id}`),
  });

  const [type, setType] = useState("DEPOSIT");
  const [amount, setAmount] = useState<number>(0);
  const [reference, setReference] = useState("");
  const [invoiceId, setInvoiceId] = useState("");
  const [error, setError] = useState<string | null>(null);

  const record = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/trust/${id}/transactions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type,
          amount,
          date: new Date().toISOString().slice(0, 10),
          reference: reference || undefined,
          invoiceId: type === "APPLIED" ? invoiceId : undefined,
        }),
      });
      if (!res.ok) {
        const b = await res.json().catch(() => ({}));
        throw new Error(b.error || "failed");
      }
    },
    onSuccess: () => {
      setAmount(0); setReference(""); setInvoiceId(""); setError(null);
      qc.invalidateQueries({ queryKey: ["trust", id] });
      qc.invalidateQueries({ queryKey: ["trust"] });
    },
    onError: (e: Error) => setError(e.message),
  });

  const d = acct.data;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/trust" className="text-sm text-brand hover:underline">← {t("trust.title")}</Link>
      </div>

      {d && (
        <>
          <div className="flex items-end justify-between">
            <div>
              <h1 className="text-2xl font-semibold">{d.client}</h1>
              <p className="text-sm text-slate-500">{t("trust.title")}</p>
            </div>
            <Card className="px-6 py-4 text-right">
              <div className="text-xs uppercase tracking-wide text-slate-500">{t("trust.balance")}</div>
              <div className="text-2xl font-semibold">{formatMoney(d.balance, d.currency)}</div>
            </Card>
          </div>

          {can("trust:manage") && (
          <Card className="p-5">
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">{t("trust.record")}</h2>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-5">
              <div>
                <label className="mb-1 block text-xs font-medium">{t("trust.type")}</label>
                <select className="h-9 w-full rounded-md border border-slate-300 bg-white px-2 text-sm dark:border-slate-700 dark:bg-slate-900" value={type} onChange={(e) => setType(e.target.value)}>
                  <option value="DEPOSIT">{t("trust.deposit")}</option>
                  <option value="PAYMENT">{t("trust.payment")}</option>
                  <option value="APPLIED">{t("trust.apply")}</option>
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium">{t("trust.amount")}</label>
                <Input className="h-9" type="number" value={amount} onChange={(e) => setAmount(Number(e.target.value))} />
              </div>
              {type === "APPLIED" ? (
                <div className="sm:col-span-2">
                  <label className="mb-1 block text-xs font-medium">{t("trust.invoice")}</label>
                  <select className="h-9 w-full rounded-md border border-slate-300 bg-white px-2 text-sm dark:border-slate-700 dark:bg-slate-900" value={invoiceId} onChange={(e) => setInvoiceId(e.target.value)}>
                    <option value="">—</option>
                    {d.openInvoices.map((i) => (
                      <option key={i.id} value={i.id}>{i.number} · {formatMoney(i.outstanding, d.currency)}</option>
                    ))}
                  </select>
                </div>
              ) : (
                <div className="sm:col-span-2">
                  <label className="mb-1 block text-xs font-medium">{t("trust.reference")}</label>
                  <Input className="h-9" value={reference} onChange={(e) => setReference(e.target.value)} />
                </div>
              )}
              <div className="flex items-end">
                <Button className="h-9 w-full" disabled={amount <= 0 || record.isPending || (type === "APPLIED" && !invoiceId)} onClick={() => record.mutate()}>
                  {t("trust.record")}
                </Button>
              </div>
            </div>
            {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
          </Card>
          )}

          <div>
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">{t("trust.ledger")}</h2>
            <Card className="overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500 dark:bg-slate-800/50">
                  <tr>
                    <th className="px-4 py-3">{t("trust.date")}</th>
                    <th className="px-4 py-3">{t("trust.type")}</th>
                    <th className="px-4 py-3">{t("trust.reference")}</th>
                    <th className="px-4 py-3 text-right">{t("trust.amount")}</th>
                    <th className="px-4 py-3 text-right">{t("trust.runningBalance")}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {d.entries.length === 0 && (
                    <tr><td colSpan={5} className="px-4 py-6 text-center text-slate-400">—</td></tr>
                  )}
                  {d.entries.map((e) => (
                    <tr key={e.id}>
                      <td className="px-4 py-2 text-slate-500">{new Date(e.date).toLocaleDateString()}</td>
                      <td className="px-4 py-2"><Badge color={typeColor(e.type)}>{e.type}</Badge></td>
                      <td className="px-4 py-2 text-slate-500">{e.reference ?? "—"}</td>
                      <td className="px-4 py-2 text-right">{e.type === "DEPOSIT" ? "+" : "−"}{formatMoney(e.amount, d.currency)}</td>
                      <td className="px-4 py-2 text-right font-medium">{formatMoney(e.runningBalance, d.currency)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}

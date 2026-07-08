"use client";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button, Input, Card, Badge } from "@/components/ui";
import { useT } from "@/lib/useT";
import { formatMoney } from "@/lib/money";

interface Disb {
  id: string;
  date: string;
  matter: string;
  description: string;
  amount: string;
  currency: string;
  billable: boolean;
  vendorName: string | null;
}
interface DisbData {
  summary: { billableTotal: number; count: number };
  rows: Disb[];
}
interface MatterOpt { id: string; code: string; name: string }

export default function DisbursementsPage() {
  const t = useT();
  const qc = useQueryClient();

  const data = useQuery({
    queryKey: ["disbursements"],
    queryFn: async () => (await fetch("/api/disbursements")).json() as Promise<DisbData>,
  });
  const matters = useQuery({
    queryKey: ["matters"],
    queryFn: async () => (await fetch("/api/matters")).json() as Promise<MatterOpt[]>,
  });

  const { register, handleSubmit, reset } = useForm();
  const [error, setError] = useState<string | null>(null);

  const record = useMutation({
    mutationFn: async (form: any) => {
      const payload = {
        matterId: form.matterId,
        date: form.date,
        description: form.description,
        amount: Number(form.amount),
        billable: form.billable !== "false",
        vendorName: form.vendorName || undefined,
        currency: "XAF",
      };
      const res = await fetch("/api/disbursements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const b = await res.json().catch(() => ({}));
        throw new Error(b.error || "failed");
      }
    },
    onSuccess: () => {
      reset();
      setError(null);
      qc.invalidateQueries({ queryKey: ["disbursements"] });
    },
    onError: (e: Error) => setError(e.message),
  });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">{t("disb.title")}</h1>
      <p className="-mt-4 text-sm text-slate-500">{t("disb.subtitle")}</p>

      <Card className="p-5 sm:max-w-xs">
        <div className="text-3xl font-semibold">{formatMoney(data.data?.summary.billableTotal ?? 0)}</div>
        <div className="mt-1 text-sm text-slate-500">{t("disb.summary")}</div>
      </Card>

      <Card className="p-5">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">{t("disb.new")}</h2>
        <form onSubmit={handleSubmit((d) => record.mutate(d))} className="grid grid-cols-1 gap-3 sm:grid-cols-6">
          <div className="sm:col-span-2">
            <label className="mb-1 block text-xs font-medium">{t("time.matter")}</label>
            <select className="h-9 w-full rounded-md border border-slate-300 bg-white px-2 text-sm dark:border-slate-700 dark:bg-slate-900" {...register("matterId", { required: true })}>
              <option value="">—</option>
              {matters.data?.map((m) => <option key={m.id} value={m.id}>{m.code} — {m.name}</option>)}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium">{t("time.date")}</label>
            <Input className="h-9" type="date" defaultValue={new Date().toISOString().slice(0, 10)} {...register("date", { required: true })} />
          </div>
          <div className="sm:col-span-2">
            <label className="mb-1 block text-xs font-medium">{t("disb.desc")}</label>
            <Input className="h-9" {...register("description", { required: true })} />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium">{t("disb.amount")}</label>
            <Input className="h-9" type="number" {...register("amount", { required: true })} />
          </div>
          <div className="sm:col-span-2">
            <label className="mb-1 block text-xs font-medium">{t("disb.vendor")}</label>
            <Input className="h-9" {...register("vendorName")} />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium">{t("disb.billable")}</label>
            <select className="h-9 w-full rounded-md border border-slate-300 bg-white px-2 text-sm dark:border-slate-700 dark:bg-slate-900" {...register("billable")} defaultValue="true">
              <option value="true">Yes</option>
              <option value="false">No</option>
            </select>
          </div>
          <div className="flex items-end sm:col-span-3">
            <Button type="submit" className="h-9" disabled={record.isPending}>{t("disb.new")}</Button>
          </div>
          {error && <p className="text-sm text-red-600 sm:col-span-6">{error}</p>}
        </form>
      </Card>

      <Card className="overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500 dark:bg-slate-800/50">
            <tr>
              <th className="px-4 py-3">{t("time.date")}</th>
              <th className="px-4 py-3">{t("time.matter")}</th>
              <th className="px-4 py-3">{t("disb.desc")}</th>
              <th className="px-4 py-3">{t("disb.vendor")}</th>
              <th className="px-4 py-3">{t("disb.billable")}</th>
              <th className="px-4 py-3 text-right">{t("disb.amount")}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {data.isLoading && (
              <tr><td colSpan={6} className="px-4 py-6 text-center text-slate-400">{t("common.loading")}</td></tr>
            )}
            {data.data?.rows.map((d) => (
              <tr key={d.id}>
                <td className="px-4 py-2 text-slate-500">{new Date(d.date).toLocaleDateString()}</td>
                <td className="px-4 py-2">{d.matter}</td>
                <td className="px-4 py-2">{d.description}</td>
                <td className="px-4 py-2 text-slate-500">{d.vendorName ?? "—"}</td>
                <td className="px-4 py-2">
                  <Badge color={d.billable ? "green" : "slate"}>{d.billable ? "Billable" : "Non-billable"}</Badge>
                </td>
                <td className="px-4 py-2 text-right">{formatMoney(d.amount, d.currency)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}

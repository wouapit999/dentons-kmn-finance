"use client";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button, Input, Card, Badge } from "@/components/ui";
import { useT } from "@/lib/useT";
import { usePerms, getJson } from "@/lib/usePerms";
import { formatMoney } from "@/lib/money";

interface TimeEntry {
  id: string;
  date: string;
  matter: string;
  lawyer: string;
  minutes: number;
  hours: number;
  billable: boolean;
  amount: string;
  currency: string;
  narrative: string | null;
}
interface TimeData {
  summary: { billableHours: number; billableAmount: number; count: number };
  entries: TimeEntry[];
}
interface MatterOpt { id: string; code: string; name: string }
interface Meta { partners: { id: string; fullName: string }[] }

export default function TimePage() {
  const t = useT();
  const { can } = usePerms();
  const qc = useQueryClient();

  const data = useQuery({
    queryKey: ["time"],
    queryFn: () => getJson<TimeData>("/api/time"),
  });
  const matters = useQuery({
    queryKey: ["matters"],
    queryFn: () => getJson<MatterOpt[]>("/api/matters"),
  });
  const meta = useQuery({
    queryKey: ["matters-meta"],
    queryFn: () => getJson<Meta>("/api/matters/meta"),
  });

  const { register, handleSubmit, reset } = useForm();
  const [error, setError] = useState<string | null>(null);

  const log = useMutation({
    mutationFn: async (form: any) => {
      const payload = {
        matterId: form.matterId,
        lawyerId: form.lawyerId || undefined,
        date: form.date,
        minutes: Number(form.minutes),
        rate: Number(form.rate) || 0,
        billable: form.billable === "true" || form.billable === true,
        narrative: form.narrative || undefined,
        currency: "XAF",
      };
      const res = await fetch("/api/time", {
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
      qc.invalidateQueries({ queryKey: ["time"] });
    },
    onError: (e: Error) => setError(e.message),
  });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">{t("time.title")}</h1>
      <p className="-mt-4 text-sm text-slate-500">{t("time.subtitle")}</p>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card className="p-5">
          <div className="text-3xl font-semibold">{data.data?.summary.billableHours ?? 0}</div>
          <div className="mt-1 text-sm text-slate-500">{t("time.summary.hours")}</div>
        </Card>
        <Card className="p-5">
          <div className="text-3xl font-semibold">{formatMoney(data.data?.summary.billableAmount ?? 0)}</div>
          <div className="mt-1 text-sm text-slate-500">{t("time.summary.amount")}</div>
        </Card>
        <Card className="p-5">
          <div className="text-3xl font-semibold">{data.data?.summary.count ?? 0}</div>
          <div className="mt-1 text-sm text-slate-500">{t("time.title")}</div>
        </Card>
      </div>

      {can("time:log") && (
      <Card className="p-5">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">{t("time.new")}</h2>
        <form onSubmit={handleSubmit((d) => log.mutate(d))} className="grid grid-cols-1 gap-3 sm:grid-cols-6">
          <div className="sm:col-span-2">
            <label className="mb-1 block text-xs font-medium">{t("time.matter")}</label>
            <select className="h-9 w-full rounded-md border border-slate-300 bg-white px-2 text-sm dark:border-slate-700 dark:bg-slate-900" {...register("matterId", { required: true })}>
              <option value="">—</option>
              {matters.data?.map((m) => <option key={m.id} value={m.id}>{m.code} — {m.name}</option>)}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium">{t("time.lawyer")}</label>
            <select className="h-9 w-full rounded-md border border-slate-300 bg-white px-2 text-sm dark:border-slate-700 dark:bg-slate-900" {...register("lawyerId")}>
              <option value="">(me)</option>
              {meta.data?.partners.map((p) => <option key={p.id} value={p.id}>{p.fullName}</option>)}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium">{t("time.date")}</label>
            <Input className="h-9" type="date" defaultValue={new Date().toISOString().slice(0, 10)} {...register("date", { required: true })} />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium">{t("time.minutes")}</label>
            <Input className="h-9" type="number" {...register("minutes", { required: true })} />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium">{t("time.rate")}</label>
            <Input className="h-9" type="number" {...register("rate")} />
          </div>
          <div className="sm:col-span-4">
            <label className="mb-1 block text-xs font-medium">{t("time.narrative")}</label>
            <Input className="h-9" {...register("narrative")} />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium">{t("time.billable")}</label>
            <select className="h-9 w-full rounded-md border border-slate-300 bg-white px-2 text-sm dark:border-slate-700 dark:bg-slate-900" {...register("billable")} defaultValue="true">
              <option value="true">Yes</option>
              <option value="false">No</option>
            </select>
          </div>
          <div className="flex items-end">
            <Button type="submit" className="h-9 w-full" disabled={log.isPending}>{t("time.new")}</Button>
          </div>
          {error && <p className="text-sm text-red-600 sm:col-span-6">{error}</p>}
        </form>
      </Card>
      )}

      <Card className="overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500 dark:bg-slate-800/50">
            <tr>
              <th className="px-4 py-3">{t("time.date")}</th>
              <th className="px-4 py-3">{t("time.matter")}</th>
              <th className="px-4 py-3">{t("time.lawyer")}</th>
              <th className="px-4 py-3 text-right">{t("time.hours")}</th>
              <th className="px-4 py-3">{t("time.billable")}</th>
              <th className="px-4 py-3 text-right">{t("time.amount")}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {data.isLoading && (
              <tr><td colSpan={6} className="px-4 py-6 text-center text-slate-400">{t("common.loading")}</td></tr>
            )}
            {data.data?.entries.map((e) => (
              <tr key={e.id}>
                <td className="px-4 py-2 text-slate-500">{new Date(e.date).toLocaleDateString()}</td>
                <td className="px-4 py-2">{e.matter}</td>
                <td className="px-4 py-2">{e.lawyer}</td>
                <td className="px-4 py-2 text-right">{e.hours}</td>
                <td className="px-4 py-2">
                  <Badge color={e.billable ? "green" : "slate"}>{e.billable ? "Billable" : "Non-billable"}</Badge>
                </td>
                <td className="px-4 py-2 text-right">{formatMoney(e.amount, e.currency)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}

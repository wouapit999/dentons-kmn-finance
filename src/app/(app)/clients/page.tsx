"use client";
import { useState } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button, Input, Card, Badge } from "@/components/ui";
import { useT } from "@/lib/useT";

interface Client {
  id: string;
  type: string;
  name: string;
  email: string | null;
  taxId: string | null;
  kycStatus: string;
  amlRisk: string;
  conflictStatus: string;
  matters: number;
}

const kycColor = (s: string) => (s === "VERIFIED" ? "green" : s === "REJECTED" ? "red" : "amber");
const amlColor = (s: string) => (s === "HIGH" ? "red" : s === "MEDIUM" ? "amber" : "slate");
const conflictColor = (s: string) =>
  s === "CLEAR" ? "green" : s === "POTENTIAL" ? "amber" : s === "BLOCKED" ? "red" : "slate";

export default function ClientsPage() {
  const t = useT();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);

  const clients = useQuery({
    queryKey: ["clients"],
    queryFn: async () => {
      const res = await fetch("/api/clients");
      if (!res.ok) throw new Error();
      return (await res.json()) as Client[];
    },
  });
  const me = useQuery({
    queryKey: ["me"],
    queryFn: async () => (await fetch("/api/me")).json() as Promise<{ permissions: string[] }>,
  });
  const canManage = me.data?.permissions.includes("client:manage") ?? false;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">{t("clients.title")}</h1>
          <p className="text-sm text-slate-500">{t("clients.subtitle")}</p>
        </div>
        {canManage && <Button onClick={() => setOpen(true)}>+ {t("clients.new")}</Button>}
      </div>

      <Card className="overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500 dark:bg-slate-800/50">
            <tr>
              <th className="px-4 py-3">{t("clients.type")}</th>
              <th className="px-4 py-3">{t("gl.name")}</th>
              <th className="px-4 py-3">{t("clients.kyc")}</th>
              <th className="px-4 py-3">{t("clients.aml")}</th>
              <th className="px-4 py-3">{t("clients.conflict")}</th>
              <th className="px-4 py-3">{t("clients.matters")}</th>
              <th className="px-4 py-3 text-right">{t("common.actions")}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {clients.isLoading && (
              <tr><td colSpan={7} className="px-4 py-6 text-center text-slate-400">{t("common.loading")}</td></tr>
            )}
            {clients.data?.map((c) => (
              <tr key={c.id}>
                <td className="px-4 py-2.5">
                  <Badge color="slate">{c.type}</Badge>
                </td>
                <td className="px-4 py-2.5 font-medium">{c.name}</td>
                <td className="px-4 py-2.5"><Badge color={kycColor(c.kycStatus)}>{c.kycStatus}</Badge></td>
                <td className="px-4 py-2.5"><Badge color={amlColor(c.amlRisk)}>{c.amlRisk}</Badge></td>
                <td className="px-4 py-2.5"><Badge color={conflictColor(c.conflictStatus)}>{c.conflictStatus}</Badge></td>
                <td className="px-4 py-2.5 text-slate-500">{c.matters}</td>
                <td className="px-4 py-2.5 text-right">
                  <Link href={`/clients/${c.id}`}>
                    <Button size="sm" variant="outline">{t("clients.openFile")}</Button>
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      {open && (
        <NewClientDialog
          onClose={() => setOpen(false)}
          onCreated={() => {
            setOpen(false);
            qc.invalidateQueries({ queryKey: ["clients"] });
          }}
        />
      )}
    </div>
  );
}

function NewClientDialog({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const t = useT();
  const { register, handleSubmit } = useForm();
  const [error, setError] = useState<string | null>(null);

  const create = useMutation({
    mutationFn: async (data: any) => {
      const res = await fetch("/api/clients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const b = await res.json().catch(() => ({}));
        if (res.status === 403) throw new Error("You don't have permission to create clients (needs a Partner or CFO role).");
        if (res.status === 422) throw new Error("Please check the fields (name, valid email).");
        throw new Error(b.error || "Could not create client.");
      }
    },
    onSuccess: onCreated,
    onError: (e: Error) => setError(e.message),
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <Card className="w-full max-w-md p-6">
        <h2 className="mb-4 text-lg font-semibold">{t("clients.new")}</h2>
        <form onSubmit={handleSubmit((d) => create.mutate(d))} className="space-y-3">
          <div>
            <label className="mb-1 block text-sm font-medium">{t("clients.type")}</label>
            <select className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-900" {...register("type")}>
              <option value="CORPORATE">CORPORATE</option>
              <option value="INDIVIDUAL">INDIVIDUAL</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">{t("gl.name")}</label>
            <Input {...register("name", { required: true })} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-sm font-medium">Email</label>
              <Input type="email" {...register("email")} />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Tax ID</label>
              <Input {...register("taxId")} />
            </div>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">{t("clients.aml")}</label>
            <select className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-900" {...register("amlRisk")}>
              <option value="LOW">LOW</option>
              <option value="MEDIUM">MEDIUM</option>
              <option value="HIGH">HIGH</option>
            </select>
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={onClose}>{t("common.cancel")}</Button>
            <Button type="submit" disabled={create.isPending}>{t("common.create")}</Button>
          </div>
        </form>
      </Card>
    </div>
  );
}

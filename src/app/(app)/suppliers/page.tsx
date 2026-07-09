"use client";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button, Input, Card } from "@/components/ui";
import { useT } from "@/lib/useT";

interface Supplier {
  id: string;
  name: string;
  email: string | null;
  taxId: string | null;
  bills: number;
}

export default function SuppliersPage() {
  const t = useT();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);

  const suppliers = useQuery({
    queryKey: ["suppliers"],
    queryFn: async () => (await fetch("/api/suppliers")).json() as Promise<Supplier[]>,
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">{t("sup.title")}</h1>
          <p className="text-sm text-slate-500">{t("sup.subtitle")}</p>
        </div>
        <Button onClick={() => setOpen(true)}>+ {t("sup.new")}</Button>
      </div>

      <Card className="overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500 dark:bg-slate-800/50">
            <tr>
              <th className="px-4 py-3">{t("gl.name")}</th>
              <th className="px-4 py-3">Email</th>
              <th className="px-4 py-3">Tax ID</th>
              <th className="px-4 py-3">{t("bill.title")}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {suppliers.isLoading && (
              <tr><td colSpan={4} className="px-4 py-6 text-center text-slate-400">{t("common.loading")}</td></tr>
            )}
            {suppliers.data?.length === 0 && (
              <tr><td colSpan={4} className="px-4 py-6 text-center text-slate-400">—</td></tr>
            )}
            {suppliers.data?.map((s) => (
              <tr key={s.id}>
                <td className="px-4 py-2.5 font-medium">{s.name}</td>
                <td className="px-4 py-2.5 text-slate-500">{s.email ?? "—"}</td>
                <td className="px-4 py-2.5 text-slate-500">{s.taxId ?? "—"}</td>
                <td className="px-4 py-2.5 text-slate-500">{s.bills}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      {open && (
        <NewSupplierDialog
          onClose={() => setOpen(false)}
          onCreated={() => { setOpen(false); qc.invalidateQueries({ queryKey: ["suppliers"] }); }}
        />
      )}
    </div>
  );
}

function NewSupplierDialog({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const t = useT();
  const { register, handleSubmit } = useForm();
  const [error, setError] = useState<string | null>(null);
  const create = useMutation({
    mutationFn: async (data: any) => {
      const res = await fetch("/api/suppliers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error();
    },
    onSuccess: onCreated,
    onError: () => setError("Could not create supplier."),
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <Card className="w-full max-w-md p-6">
        <h2 className="mb-4 text-lg font-semibold">{t("sup.new")}</h2>
        <form onSubmit={handleSubmit((d) => create.mutate(d))} className="space-y-3">
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

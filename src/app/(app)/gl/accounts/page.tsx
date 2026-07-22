"use client";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button, Input, Card, Badge } from "@/components/ui";
import { useT } from "@/lib/useT";
import { usePerms } from "@/lib/usePerms";

interface Account {
  id: string;
  code: string;
  name: string;
  type: string;
  syscohadaClass: string | null;
  ifrsCategory: string | null;
  isPostable: boolean;
}

const TYPE_COLOR: Record<string, "green" | "red" | "amber" | "brand" | "slate"> = {
  ASSET: "green",
  LIABILITY: "red",
  EQUITY: "brand",
  REVENUE: "amber",
  EXPENSE: "slate",
};

export default function AccountsPage() {
  const t = useT();
  const { can } = usePerms();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const accounts = useQuery({
    queryKey: ["accounts"],
    queryFn: async () => {
      const res = await fetch("/api/gl/accounts");
      if (!res.ok) throw new Error();
      return (await res.json()) as Account[];
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">{t("gl.accounts.title")}</h1>
          <p className="text-sm text-slate-500">{t("gl.accounts.subtitle")}</p>
        </div>
        {can("gl:manage") && <Button onClick={() => setOpen(true)}>+ {t("gl.accounts.new")}</Button>}
      </div>

      <Card className="overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500 dark:bg-slate-800/50">
            <tr>
              <th className="px-4 py-3">{t("gl.code")}</th>
              <th className="px-4 py-3">{t("gl.name")}</th>
              <th className="px-4 py-3">{t("gl.type")}</th>
              <th className="px-4 py-3">{t("gl.class")}</th>
              <th className="px-4 py-3">{t("gl.ifrs")}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {accounts.isLoading && (
              <tr><td colSpan={5} className="px-4 py-6 text-center text-slate-400">{t("common.loading")}</td></tr>
            )}
            {accounts.data?.map((a) => (
              <tr key={a.id}>
                <td className="px-4 py-2.5 font-mono">{a.code}</td>
                <td className="px-4 py-2.5 font-medium">{a.name}</td>
                <td className="px-4 py-2.5">
                  <Badge color={TYPE_COLOR[a.type] ?? "slate"}>{a.type}</Badge>
                </td>
                <td className="px-4 py-2.5 text-slate-500">{a.syscohadaClass ?? "—"}</td>
                <td className="px-4 py-2.5 text-slate-500">{a.ifrsCategory ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      {open && (
        <NewAccountDialog
          onClose={() => setOpen(false)}
          onCreated={() => {
            setOpen(false);
            qc.invalidateQueries({ queryKey: ["accounts"] });
          }}
        />
      )}
    </div>
  );
}

function NewAccountDialog({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const t = useT();
  const { register, handleSubmit } = useForm();
  const [error, setError] = useState<string | null>(null);

  const create = useMutation({
    mutationFn: async (data: any) => {
      const res = await fetch("/api/gl/accounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...data, isPostable: true }),
      });
      if (!res.ok) throw new Error("create_failed");
    },
    onSuccess: onCreated,
    onError: () => setError("Could not create account (check code/type)."),
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <Card className="w-full max-w-md p-6">
        <h2 className="mb-4 text-lg font-semibold">{t("gl.accounts.new")}</h2>
        <form onSubmit={handleSubmit((d) => create.mutate(d))} className="space-y-3">
          <div>
            <label className="mb-1 block text-sm font-medium">{t("gl.code")}</label>
            <Input placeholder="e.g. 706100" {...register("code", { required: true })} />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">{t("gl.name")}</label>
            <Input {...register("name", { required: true })} />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">{t("gl.type")}</label>
            <select
              className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-900"
              {...register("type", { required: true })}
            >
              <option value="ASSET">ASSET</option>
              <option value="LIABILITY">LIABILITY</option>
              <option value="EQUITY">EQUITY</option>
              <option value="REVENUE">REVENUE</option>
              <option value="EXPENSE">EXPENSE</option>
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-sm font-medium">{t("gl.class")}</label>
              <Input placeholder="7" {...register("syscohadaClass")} />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">{t("gl.ifrs")}</label>
              <Input placeholder="Revenue" {...register("ifrsCategory")} />
            </div>
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={onClose}>
              {t("common.cancel")}
            </Button>
            <Button type="submit" disabled={create.isPending}>{t("common.create")}</Button>
          </div>
        </form>
      </Card>
    </div>
  );
}

"use client";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button, Input, Card } from "@/components/ui";
import { useT } from "@/lib/useT";
import { usePerms, getJson } from "@/lib/usePerms";
import { formatMoney } from "@/lib/money";

interface Employee {
  id: string;
  employeeNo: string;
  fullName: string;
  position: string | null;
  baseSalary: number;
  housingAllowance: number;
  transportAllowance: number;
  cnpsNo: string | null;
}

export default function EmployeesPage() {
  const t = useT();
  const { can } = usePerms();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);

  const employees = useQuery({
    queryKey: ["employees"],
    queryFn: () => getJson<Employee[]>("/api/employees"),
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">{t("emp.title")}</h1>
          <p className="text-sm text-slate-500">{t("emp.subtitle")}</p>
        </div>
        {can("payroll:manage") && <Button onClick={() => setOpen(true)}>+ {t("emp.new")}</Button>}
      </div>

      <Card className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500 dark:bg-slate-800/50">
            <tr>
              <th className="px-4 py-3">{t("emp.no")}</th>
              <th className="px-4 py-3">{t("gl.name")}</th>
              <th className="px-4 py-3">{t("emp.position")}</th>
              <th className="px-4 py-3 text-right">{t("emp.base")}</th>
              <th className="px-4 py-3">{t("emp.cnps")}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {employees.isLoading && (
              <tr><td colSpan={5} className="px-4 py-6 text-center text-slate-400">{t("common.loading")}</td></tr>
            )}
            {employees.data?.length === 0 && (
              <tr><td colSpan={5} className="px-4 py-6 text-center text-slate-400">—</td></tr>
            )}
            {employees.data?.map((e) => (
              <tr key={e.id}>
                <td className="px-4 py-2.5 font-mono">{e.employeeNo}</td>
                <td className="px-4 py-2.5 font-medium">{e.fullName}</td>
                <td className="px-4 py-2.5 text-slate-500">{e.position ?? "—"}</td>
                <td className="px-4 py-2.5 text-right">{formatMoney(e.baseSalary)}</td>
                <td className="px-4 py-2.5 text-slate-500">{e.cnpsNo ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      {open && (
        <NewEmployeeDialog onClose={() => setOpen(false)} onCreated={() => { setOpen(false); qc.invalidateQueries({ queryKey: ["employees"] }); }} />
      )}
    </div>
  );
}

function NewEmployeeDialog({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const t = useT();
  const { register, handleSubmit } = useForm();
  const [error, setError] = useState<string | null>(null);

  const create = useMutation({
    mutationFn: async (data: any) => {
      const res = await fetch("/api/employees", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          employeeNo: data.employeeNo,
          fullName: data.fullName,
          position: data.position,
          baseSalary: Number(data.baseSalary) || 0,
          housingAllowance: Number(data.housingAllowance) || 0,
          transportAllowance: Number(data.transportAllowance) || 0,
          cnpsNo: data.cnpsNo,
        }),
      });
      if (!res.ok) throw new Error();
    },
    onSuccess: onCreated,
    onError: () => setError("Could not create employee (check employee no. is unique)."),
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <Card className="w-full max-w-lg p-6">
        <h2 className="mb-4 text-lg font-semibold">{t("emp.new")}</h2>
        <form onSubmit={handleSubmit((d) => create.mutate(d))} className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1 block text-sm font-medium">{t("emp.no")}</label>
            <Input {...register("employeeNo", { required: true })} />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">{t("emp.position")}</label>
            <Input {...register("position")} />
          </div>
          <div className="col-span-2">
            <label className="mb-1 block text-sm font-medium">{t("gl.name")}</label>
            <Input {...register("fullName", { required: true })} />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">{t("emp.base")}</label>
            <Input type="number" {...register("baseSalary", { required: true })} />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">{t("emp.cnps")}</label>
            <Input {...register("cnpsNo")} />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">{t("emp.housing")}</label>
            <Input type="number" {...register("housingAllowance")} />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">{t("emp.transport")}</label>
            <Input type="number" {...register("transportAllowance")} />
          </div>
          {error && <p className="col-span-2 text-sm text-red-600">{error}</p>}
          <div className="col-span-2 flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={onClose}>{t("common.cancel")}</Button>
            <Button type="submit" disabled={create.isPending}>{t("common.create")}</Button>
          </div>
        </form>
      </Card>
    </div>
  );
}

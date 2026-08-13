"use client";
/*
 * Dentons KMN ERP
 * Copyright (c) 2026 Bouquet Innovation SA. All rights reserved.
 * Proprietary and confidential. Unauthorised copying, distribution, modification,
 * or use of this file, via any medium, is strictly prohibited.
 */
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
  bankAccount: string | null;
}

export default function EmployeesPage() {
  const t = useT();
  const { can } = usePerms();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Employee | null>(null);
  const [rowError, setRowError] = useState<string | null>(null);
  const canManage = can("payroll:manage");

  const employees = useQuery({
    queryKey: ["employees"],
    queryFn: () => getJson<Employee[]>("/api/employees"),
  });

  const refresh = () => qc.invalidateQueries({ queryKey: ["employees"] });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/employees/${id}`, { method: "DELETE" });
      const b = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(b.error || "failed");
      return b as { archived?: boolean };
    },
    onSuccess: (b) => { setRowError(b.archived ? t("emp.archivedMsg") : null); refresh(); },
    onError: (e: Error) => setRowError(e.message),
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">{t("emp.title")}</h1>
          <p className="text-sm text-slate-500">{t("emp.subtitle")}</p>
        </div>
        {canManage && <Button onClick={() => setOpen(true)}>+ {t("emp.new")}</Button>}
      </div>

      {rowError && <p className="text-sm text-amber-600">{rowError}</p>}

      <Card className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500 dark:bg-slate-800/50">
            <tr>
              <th className="px-4 py-3">{t("emp.no")}</th>
              <th className="px-4 py-3">{t("gl.name")}</th>
              <th className="px-4 py-3">{t("emp.position")}</th>
              <th className="px-4 py-3 text-right">{t("emp.base")}</th>
              <th className="px-4 py-3">{t("emp.cnps")}</th>
              {canManage && <th className="px-4 py-3 text-right">{t("common.actions")}</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {employees.isLoading && (
              <tr><td colSpan={canManage ? 6 : 5} className="px-4 py-6 text-center text-slate-400">{t("common.loading")}</td></tr>
            )}
            {employees.data?.length === 0 && (
              <tr><td colSpan={canManage ? 6 : 5} className="px-4 py-6 text-center text-slate-400">—</td></tr>
            )}
            {employees.data?.map((e) => (
              <tr key={e.id}>
                <td className="px-4 py-2.5 font-mono">{e.employeeNo}</td>
                <td className="px-4 py-2.5 font-medium">{e.fullName}</td>
                <td className="px-4 py-2.5 text-slate-500">{e.position ?? "—"}</td>
                <td className="px-4 py-2.5 text-right">{formatMoney(e.baseSalary)}</td>
                <td className="px-4 py-2.5 text-slate-500">{e.cnpsNo ?? "—"}</td>
                {canManage && (
                  <td className="px-4 py-2.5">
                    <div className="flex justify-end gap-2">
                      <Button size="sm" variant="outline" onClick={() => setEditing(e)}>{t("common.edit")}</Button>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={remove.isPending}
                        onClick={() => { if (confirm(t("emp.confirmDelete"))) remove.mutate(e.id); }}
                      >
                        {t("common.delete")}
                      </Button>
                    </div>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      {open && (
        <EmployeeDialog onClose={() => setOpen(false)} onSaved={() => { setOpen(false); refresh(); }} />
      )}
      {editing && (
        <EmployeeDialog employee={editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); refresh(); }} />
      )}
    </div>
  );
}

// Shared create/edit dialog.
function EmployeeDialog({ employee, onClose, onSaved }: { employee?: Employee; onClose: () => void; onSaved: () => void }) {
  const t = useT();
  const isEdit = !!employee;
  const { register, handleSubmit } = useForm({
    defaultValues: employee
      ? {
          employeeNo: employee.employeeNo,
          fullName: employee.fullName,
          position: employee.position ?? "",
          baseSalary: employee.baseSalary,
          housingAllowance: employee.housingAllowance,
          transportAllowance: employee.transportAllowance,
          cnpsNo: employee.cnpsNo ?? "",
          bankAccount: employee.bankAccount ?? "",
        }
      : {},
  });
  const [error, setError] = useState<string | null>(null);

  const save = useMutation({
    mutationFn: async (data: any) => {
      const payload = {
        employeeNo: data.employeeNo,
        fullName: data.fullName,
        position: data.position,
        baseSalary: Number(data.baseSalary) || 0,
        housingAllowance: Number(data.housingAllowance) || 0,
        transportAllowance: Number(data.transportAllowance) || 0,
        cnpsNo: data.cnpsNo,
        bankAccount: data.bankAccount,
      };
      const res = await fetch(isEdit ? `/api/employees/${employee!.id}` : "/api/employees", {
        method: isEdit ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const b = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(b.error || "failed");
    },
    onSuccess: onSaved,
    onError: (e: Error) =>
      setError(e.message === "employee_no_exists" ? t("emp.noExists") : t("emp.saveError")),
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <Card className="w-full max-w-lg p-6">
        <h2 className="mb-4 text-lg font-semibold">{isEdit ? t("emp.edit") : t("emp.new")}</h2>
        <form onSubmit={handleSubmit((d) => save.mutate(d))} className="grid grid-cols-2 gap-3">
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
          <div className="col-span-2">
            <label className="mb-1 block text-sm font-medium">{t("emp.bank")}</label>
            <Input {...register("bankAccount")} />
          </div>
          {error && <p className="col-span-2 text-sm text-red-600">{error}</p>}
          <div className="col-span-2 flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={onClose}>{t("common.cancel")}</Button>
            <Button type="submit" disabled={save.isPending}>{isEdit ? t("common.save") : t("common.create")}</Button>
          </div>
        </form>
      </Card>
    </div>
  );
}

"use client";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button, Input, Card, Badge } from "@/components/ui";
import { useT } from "@/lib/useT";

interface Matter {
  id: string;
  code: string;
  name: string;
  status: string;
  client: string;
  practiceArea: string | null;
  partner: string | null;
}
interface MetaClient {
  id: string;
  name: string;
  kycStatus: string;
  conflictStatus: string;
}
interface Meta {
  clients: MetaClient[];
  practiceAreas: { id: string; name: string }[];
  partners: { id: string; fullName: string }[];
  suggestedCode?: string;
}

const isEligible = (c: MetaClient) => c.kycStatus === "VERIFIED" && c.conflictStatus !== "BLOCKED";

const statusColor = (s: string) => (s === "OPEN" ? "green" : s === "ON_HOLD" ? "amber" : "slate");

export default function MattersPage() {
  const t = useT();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);

  const matters = useQuery({
    queryKey: ["matters"],
    queryFn: async () => {
      const res = await fetch("/api/matters");
      if (!res.ok) throw new Error();
      return (await res.json()) as Matter[];
    },
  });
  const meta = useQuery({
    queryKey: ["matters-meta"],
    queryFn: async () => {
      const res = await fetch("/api/matters/meta");
      if (!res.ok) throw new Error("failed");
      return (await res.json()) as Meta;
    },
  });

  const me = useQuery({
    queryKey: ["me"],
    queryFn: async () => (await fetch("/api/me")).json() as Promise<{ permissions: string[] }>,
  });
  const canManage = me.data?.permissions.includes("matter:manage") ?? false;

  const [rowError, setRowError] = useState<string | null>(null);
  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["matters"] });
    qc.invalidateQueries({ queryKey: ["matters-meta"] });
  };

  const setStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const res = await fetch(`/api/matters/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) throw new Error(((await res.json().catch(() => ({}))) as any).error || "failed");
    },
    onSuccess: () => { setRowError(null); refresh(); },
    onError: (e: Error) => setRowError(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/matters/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error(((await res.json().catch(() => ({}))) as any).error || "failed");
    },
    onSuccess: () => { setRowError(null); refresh(); },
    onError: (e: Error) => setRowError(e.message),
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">{t("matters.title")}</h1>
          <p className="text-sm text-slate-500">{t("matters.subtitle")}</p>
        </div>
        <Button
          onClick={() => {
            // Always refetch options so clients created moments ago appear.
            qc.invalidateQueries({ queryKey: ["matters-meta"] });
            setOpen(true);
          }}
        >
          + {t("matters.new")}
        </Button>
      </div>

      <Card className="overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500 dark:bg-slate-800/50">
            <tr>
              <th className="px-4 py-3">{t("matters.code")}</th>
              <th className="px-4 py-3">{t("matters.name")}</th>
              <th className="px-4 py-3">{t("matters.client")}</th>
              <th className="px-4 py-3">{t("matters.area")}</th>
              <th className="px-4 py-3">{t("matters.partner")}</th>
              <th className="px-4 py-3">{t("matters.status")}</th>
              {canManage && <th className="px-4 py-3 text-right">{t("common.actions")}</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {matters.isLoading && (
              <tr><td colSpan={6} className="px-4 py-6 text-center text-slate-400">{t("common.loading")}</td></tr>
            )}
            {matters.data?.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-6 text-center text-slate-400">—</td></tr>
            )}
            {matters.data?.map((m) => (
              <tr key={m.id}>
                <td className="px-4 py-2.5 font-mono">{m.code}</td>
                <td className="px-4 py-2.5 font-medium">{m.name}</td>
                <td className="px-4 py-2.5">{m.client}</td>
                <td className="px-4 py-2.5 text-slate-500">{m.practiceArea ?? "—"}</td>
                <td className="px-4 py-2.5 text-slate-500">{m.partner ?? "—"}</td>
                <td className="px-4 py-2.5"><Badge color={statusColor(m.status)}>{m.status}</Badge></td>
                {canManage && (
                  <td className="px-4 py-2.5">
                    <div className="flex justify-end gap-2">
                      {m.status !== "CLOSED" && (
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={setStatus.isPending}
                          onClick={() => setStatus.mutate({ id: m.id, status: "CLOSED" })}
                        >
                          {t("matters.close")}
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={remove.isPending}
                        onClick={() => {
                          if (confirm(t("matters.confirmDelete"))) remove.mutate(m.id);
                        }}
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

      {rowError && (
        <p className="text-sm text-red-600">
          {rowError === "matter_has_activity" ? t("matters.hasActivity") : rowError}
        </p>
      )}

      {open && (
        <NewMatterDialog
          meta={meta.data}
          onClose={() => setOpen(false)}
          onCreated={() => {
            setOpen(false);
            qc.invalidateQueries({ queryKey: ["matters"] });
          }}
        />
      )}
    </div>
  );
}

function NewMatterDialog({
  meta,
  onClose,
  onCreated,
}: {
  meta?: Meta;
  onClose: () => void;
  onCreated: () => void;
}) {
  const t = useT();
  const { register, handleSubmit } = useForm();
  const [error, setError] = useState<string | null>(null);

  const create = useMutation({
    mutationFn: async (data: any) => {
      const res = await fetch("/api/matters", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const b = await res.json().catch(() => ({}));
        throw new Error(b.error || "failed");
      }
    },
    onSuccess: onCreated,
    onError: (e: Error) => setError(e.message),
  });

  // Turn server error codes into readable guidance.
  const errorText = (code: string) => {
    if (code === "matter_code_exists" || code === "duplicate_value") return t("matters.codeExists");
    if (code === "client_kyc_not_verified") return t("matters.kycPending");
    if (code === "client_conflict_blocked") return t("matters.conflictBlocked");
    return code;
  };

  const noClients = !meta || meta.clients.length === 0;
  const eligible = meta?.clients.filter(isEligible) ?? [];
  const ineligible = meta?.clients.filter((c) => !isEligible(c)) ?? [];

  const reason = (c: MetaClient) =>
    c.conflictStatus === "BLOCKED" ? t("matters.conflictBlocked") : t("matters.kycPending");

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <Card className="w-full max-w-md p-6">
        <h2 className="mb-4 text-lg font-semibold">{t("matters.new")}</h2>
        {noClients ? (
          <p className="text-sm text-amber-600">{t("matters.noEligible")}</p>
        ) : (
          <form onSubmit={handleSubmit((d) => create.mutate(d))} className="space-y-3">
            <div>
              <label className="mb-1 block text-sm font-medium">{t("matters.client")}</label>
              <select
                className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-900"
                defaultValue=""
                {...register("clientId", { required: true })}
              >
                <option value="" disabled>
                  {t("matters.selectClient")}
                </option>
                {eligible.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
                {ineligible.map((c) => (
                  <option key={c.id} value="" disabled>
                    {c.name} — {reason(c)}
                  </option>
                ))}
              </select>
              {ineligible.length > 0 && (
                <p className="mt-1 text-xs text-amber-600">{t("matters.kycHint")}</p>
              )}
              {eligible.length === 0 && (
                <p className="mt-1 text-xs text-red-600">{t("matters.noEligible")}</p>
              )}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-sm font-medium">{t("matters.code")}</label>
                {/* Assigned by the server on create — read-only so browser
                    autofill can never reintroduce an already-used code. */}
                <Input value={meta?.suggestedCode ?? "—"} readOnly tabIndex={-1} className="bg-slate-100 text-slate-500 dark:bg-slate-800" />
                <p className="mt-1 text-xs text-slate-400">{t("matters.codeAuto")}</p>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">{t("matters.area")}</label>
                <select className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-900" {...register("practiceAreaId")}>
                  <option value="">—</option>
                  {meta!.practiceAreas.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">{t("matters.name")}</label>
              <Input autoComplete="off" {...register("name", { required: true })} />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">{t("matters.partner")}</label>
              <select className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-900" {...register("responsiblePartnerId")}>
                <option value="">—</option>
                {meta!.partners.map((p) => <option key={p.id} value={p.id}>{p.fullName}</option>)}
              </select>
            </div>
            {error && <p className="text-sm text-red-600">{errorText(error)}</p>}
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={onClose}>{t("common.cancel")}</Button>
              <Button type="submit" disabled={create.isPending}>{t("common.create")}</Button>
            </div>
          </form>
        )}
      </Card>
    </div>
  );
}

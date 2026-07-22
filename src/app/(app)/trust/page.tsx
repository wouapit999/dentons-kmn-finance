"use client";
import { useState } from "react";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button, Card, Badge } from "@/components/ui";
import { useT } from "@/lib/useT";
import { usePerms, getJson } from "@/lib/usePerms";
import { formatMoney } from "@/lib/money";

interface TrustAccount {
  id: string;
  client: string;
  currency: string;
  balance: number;
  status: string;
  entries: number;
}

export default function TrustPage() {
  const t = useT();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);

  const { can } = usePerms();
  const accounts = useQuery({
    queryKey: ["trust"],
    queryFn: () => getJson<TrustAccount[]>("/api/trust"),
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">{t("trust.title")}</h1>
          <p className="text-sm text-slate-500">{t("trust.subtitle")}</p>
        </div>
        {can("trust:manage") && <Button onClick={() => setOpen(true)}>+ {t("trust.new")}</Button>}
      </div>

      <Card className="overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500 dark:bg-slate-800/50">
            <tr>
              <th className="px-4 py-3">{t("trust.client")}</th>
              <th className="px-4 py-3 text-right">{t("trust.balance")}</th>
              <th className="px-4 py-3">{t("trust.entries")}</th>
              <th className="px-4 py-3">{t("inv.status")}</th>
              <th className="px-4 py-3 text-right">{t("common.actions")}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {accounts.isLoading && (
              <tr><td colSpan={5} className="px-4 py-6 text-center text-slate-400">{t("common.loading")}</td></tr>
            )}
            {accounts.data?.length === 0 && (
              <tr><td colSpan={5} className="px-4 py-6 text-center text-slate-400">—</td></tr>
            )}
            {accounts.data?.map((a) => (
              <tr key={a.id}>
                <td className="px-4 py-2.5 font-medium">{a.client}</td>
                <td className="px-4 py-2.5 text-right font-medium">{formatMoney(a.balance, a.currency)}</td>
                <td className="px-4 py-2.5 text-slate-500">{a.entries}</td>
                <td className="px-4 py-2.5"><Badge color={a.status === "ACTIVE" ? "green" : "slate"}>{a.status}</Badge></td>
                <td className="px-4 py-2.5 text-right">
                  <Link href={`/trust/${a.id}`}>
                    <Button size="sm" variant="outline">{t("trust.open")}</Button>
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      {open && (
        <OpenAccountDialog
          onClose={() => setOpen(false)}
          onCreated={() => { setOpen(false); qc.invalidateQueries({ queryKey: ["trust"] }); }}
        />
      )}
    </div>
  );
}

function OpenAccountDialog({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const t = useT();
  const [clientId, setClientId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const meta = useQuery({
    queryKey: ["trust-meta"],
    queryFn: () => getJson<{ clients: { id: string; name: string }[] }>("/api/trust/meta"),
  });

  const create = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/trust", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientId }),
      });
      if (!res.ok) throw new Error();
    },
    onSuccess: onCreated,
    onError: () => setError("Could not open account."),
  });

  const noClients = meta.data && meta.data.clients.length === 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <Card className="w-full max-w-md p-6">
        <h2 className="mb-4 text-lg font-semibold">{t("trust.new")}</h2>
        {noClients ? (
          <p className="text-sm text-amber-600">{t("trust.noClients")}</p>
        ) : (
          <div className="space-y-3">
            <div>
              <label className="mb-1 block text-sm font-medium">{t("trust.client")}</label>
              <select className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-900" value={clientId} onChange={(e) => setClientId(e.target.value)}>
                <option value="">—</option>
                {meta.data?.clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <div className="flex justify-end gap-2 pt-1">
              <Button variant="outline" onClick={onClose}>{t("common.cancel")}</Button>
              <Button disabled={!clientId || create.isPending} onClick={() => create.mutate()}>{t("common.create")}</Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}

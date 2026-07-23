"use client";
import { useState } from "react";
import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button, Card, Badge } from "@/components/ui";
import { useT } from "@/lib/useT";

interface Client {
  id: string;
  clientNo: string | null;
  type: string;
  name: string;
  email: string | null;
  taxId: string | null;
  caseType: string | null;
  assignedLawyer: string | null;
  kycStatus: string;
  amlRisk: string;
  conflictStatus: string;
  matters: number;
}

const kycColor = (s: string) => (s === "VERIFIED" ? "green" : s === "REJECTED" ? "red" : "amber");
const amlColor = (s: string) => (s === "HIGH" ? "red" : s === "MEDIUM" ? "amber" : "slate");
const conflictColor = (s: string) =>
  s === "CLEAR" ? "green" : s === "POTENTIAL" ? "amber" : s === "BLOCKED" ? "red" : "slate";

// Client creation goes through the dedicated onboarding app (4-phase workflow:
// conflicts → compliance → engagement → handover). When onboarding completes,
// the client row is created in this database and shows up in the list below.
const ONBOARDING_URL =
  process.env.NEXT_PUBLIC_ONBOARDING_URL ?? "https://dentons-kmn-onboarding-app.vercel.app";

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
  const canManage = (me.data?.permissions ?? []).includes("client:manage");

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">{t("clients.title")}</h1>
          <p className="text-sm text-slate-500">{t("clients.subtitle")}</p>
        </div>
        {canManage && <Button onClick={() => setOpen(true)}>+ {t("clients.new")}</Button>}
      </div>

      <Card className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500 dark:bg-slate-800/50">
            <tr>
              <th className="px-4 py-3">{t("clients.no")}</th>
              <th className="px-4 py-3">{t("gl.name")}</th>
              <th className="px-4 py-3">{t("wiz.lawyer")}</th>
              <th className="px-4 py-3">{t("clients.kyc")}</th>
              <th className="px-4 py-3">{t("clients.aml")}</th>
              <th className="px-4 py-3">{t("clients.conflict")}</th>
              <th className="px-4 py-3 text-right">{t("common.actions")}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {clients.isLoading && (
              <tr><td colSpan={7} className="px-4 py-6 text-center text-slate-400">{t("common.loading")}</td></tr>
            )}
            {clients.data?.map((c) => (
              <tr key={c.id}>
                <td className="px-4 py-2.5 font-mono text-xs">{c.clientNo ?? "—"}</td>
                <td className="px-4 py-2.5">
                  <span className="font-medium">{c.name}</span>
                  <span className="ml-2"><Badge color="slate">{c.type}</Badge></span>
                </td>
                <td className="px-4 py-2.5 text-slate-500">{c.assignedLawyer ?? "—"}</td>
                <td className="px-4 py-2.5"><Badge color={kycColor(c.kycStatus)}>{c.kycStatus}</Badge></td>
                <td className="px-4 py-2.5"><Badge color={amlColor(c.amlRisk)}>{c.amlRisk}</Badge></td>
                <td className="px-4 py-2.5"><Badge color={conflictColor(c.conflictStatus)}>{c.conflictStatus}</Badge></td>
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
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          role="dialog" aria-modal="true" aria-label={t("clients.onboardTitle")}
        >
          <Card className="w-full max-w-md p-6">
            <h2 className="text-lg font-semibold">{t("clients.onboardTitle")}</h2>
            <p className="mt-2 text-sm text-slate-500">{t("clients.onboardBody")}</p>
            <div className="mt-5 flex flex-wrap items-center justify-end gap-2">
              <Button variant="outline" onClick={() => setOpen(false)}>{t("common.cancel")}</Button>
              <Button
                variant="outline"
                onClick={() => qc.invalidateQueries({ queryKey: ["clients"] })}
              >
                {t("clients.onboardRefresh")}
              </Button>
              <a href={`${ONBOARDING_URL}/matters/new`} target="_blank" rel="noreferrer">
                <Button>{t("clients.onboardStart")}</Button>
              </a>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}

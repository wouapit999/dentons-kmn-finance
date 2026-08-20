"use client";
/*
 * Dentons KMN ERP
 * Copyright (c) 2026 Bouquet Innovation SA. All rights reserved.
 * Proprietary and confidential. Unauthorised copying, distribution, modification,
 * or use of this file, via any medium, is strictly prohibited.
 */
import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Button, Input, Card, Badge } from "@/components/ui";
import { useT } from "@/lib/useT";
import { usePerms } from "@/lib/usePerms";

interface ResetResult {
  ok: boolean;
  scope: "operational" | "org";
  counts: Record<string, number>;
  total: number;
  sharedCounts: Record<string, number>;
  sharedErrors: Record<string, string>;
  sharedTotal: number;
  email: { to: string; sent: boolean; reason?: string; configured: boolean };
  backup: Record<string, unknown[]>;
  backupAt: string;
}

const PHRASE = {
  operational: "RESET FINANCIAL DATA",
  org: "RESET USERS AND EMPLOYEES",
} as const;

function downloadBackup(scope: string, data: unknown) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `dentons-kmn-backup-${scope}-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-")}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

function ResetCard({
  scope,
  title,
  danger,
  bullets,
  buttonLabel,
}: {
  scope: "operational" | "org";
  title: string;
  danger: string;
  bullets: string[];
  buttonLabel: string;
}) {
  const t = useT();
  const [confirm, setConfirm] = useState("");
  const [result, setResult] = useState<ResetResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const run = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/admin/reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scope, confirm }),
      });
      const b = await res.json();
      if (!res.ok) throw new Error(b.error || "failed");
      return b as ResetResult;
    },
    onSuccess: (b) => {
      setError(null);
      setResult(b);
      // Save the pre-delete backup ("archive") the server produced.
      downloadBackup(scope, { generatedAt: b.backupAt, scope: b.scope, data: b.backup });
      setConfirm("");
    },
    onError: (e: Error) => { setError(e.message); setResult(null); },
  });

  const armed = confirm.trim() === PHRASE[scope];

  return (
    <Card className="border-red-200 p-5 dark:border-red-900/50">
      <h2 className="text-base font-semibold text-red-700 dark:text-red-300">{title}</h2>
      <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{danger}</p>
      <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-slate-500">
        {bullets.map((b, i) => <li key={i}>{b}</li>)}
      </ul>

      <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 dark:border-red-900/50 dark:bg-red-950/20">
        <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-300">
          {t("reset.typeToConfirm")} <span className="font-mono font-semibold">{PHRASE[scope]}</span>
        </label>
        <Input value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder={PHRASE[scope]} autoComplete="off" />
        <Button
          className="mt-3 bg-red-600 hover:bg-red-700"
          disabled={!armed || run.isPending}
          onClick={() => { if (window.confirm(t("reset.finalConfirm"))) run.mutate(); }}
        >
          {run.isPending ? t("reset.working") : buttonLabel}
        </Button>
      </div>

      {error && <p className="mt-3 text-sm text-red-600">{error === "confirmation_mismatch" ? t("reset.mismatch") : error}</p>}

      {result && (
        <div className="mt-4 rounded-lg bg-slate-50 p-3 text-sm dark:bg-slate-800/50">
          <div className="mb-1 flex items-center gap-2">
            <Badge color="green">{t("reset.done")}</Badge>
            <span className="text-slate-500">{t("reset.totalAffected")}: {result.total}</span>
          </div>
          <div className="mb-2 text-xs text-slate-400">{t("reset.backupSaved")}</div>
          <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 text-xs sm:grid-cols-3">
            {Object.entries(result.counts).map(([k, v]) => (
              <div key={k} className="flex justify-between"><span className="text-slate-500">{k}</span><span className="font-medium">{v}</span></div>
            ))}
          </div>
          {Object.keys(result.sharedCounts).length > 0 && (
            <div className="mt-3 border-t border-slate-200 pt-2 dark:border-slate-700">
              <div className="mb-1 text-xs font-medium text-slate-500">{t("reset.sharedCleared")} ({result.sharedTotal})</div>
              <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 text-xs sm:grid-cols-3">
                {Object.entries(result.sharedCounts).map(([k, v]) => (
                  <div key={k} className="flex justify-between"><span className="text-slate-500">{k}</span><span className="font-medium">{v}</span></div>
                ))}
              </div>
            </div>
          )}
          <div className="mt-3 border-t border-slate-200 pt-2 text-xs dark:border-slate-700">
            {result.email.sent
              ? <span className="text-green-600">{t("reset.emailSent")} {result.email.to}</span>
              : <span className="text-amber-600">{t("reset.emailNotSent")} ({result.email.reason || (result.email.configured ? "provider_error" : "no_email_provider")})</span>}
          </div>
        </div>
      )}
    </Card>
  );
}

export default function AdminResetPage() {
  const t = useT();
  const { can } = usePerms();
  if (!can("system:reset")) {
    return <p className="text-sm text-slate-400">{t("reset.adminOnly")}</p>;
  }
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">{t("reset.title")}</h1>
        <p className="text-sm text-slate-500">{t("reset.subtitle")}</p>
      </div>

      <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950/20 dark:text-amber-200">
        {t("reset.sharedDbWarning")}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <ResetCard
          scope="operational"
          title={t("reset.opTitle")}
          danger={t("reset.opDanger")}
          bullets={[t("reset.opBullet1"), t("reset.opBullet2"), t("reset.opBullet4"), t("reset.opBullet3")]}
          buttonLabel={t("reset.opButton")}
        />
        <ResetCard
          scope="org"
          title={t("reset.orgTitle")}
          danger={t("reset.orgDanger")}
          bullets={[t("reset.orgBullet1"), t("reset.orgBullet4"), t("reset.orgBullet2"), t("reset.orgBullet3")]}
          buttonLabel={t("reset.orgButton")}
        />
      </div>
    </div>
  );
}

"use client";
import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button, Input, Card, Badge } from "@/components/ui";
import { useT } from "@/lib/useT";

interface Policy {
  minLength: number; requireUpper: boolean; requireLower: boolean;
  requireNumber: boolean; requireSpecial: boolean;
  historyCount: number; expiryDays: number; breachCheck: boolean;
}
interface SecUser {
  id: string; fullName: string; email: string; status: string;
  mfaEnabled: boolean; mustChangePassword: boolean; locked: boolean;
  lockedManually: boolean; failedLogins: number;
  passwordChangedAt: string | null; lastLoginAt: string | null;
}

export default function AdminSecurityPage() {
  const t = useT();
  const qc = useQueryClient();
  const [resetFor, setResetFor] = useState<SecUser | null>(null);

  const data = useQuery({
    queryKey: ["admin-security"],
    queryFn: async () => {
      const res = await fetch("/api/admin/security");
      if (!res.ok) throw new Error();
      return (await res.json()) as { policy: Policy; users: SecUser[] };
    },
  });
  const refresh = () => qc.invalidateQueries({ queryKey: ["admin-security"] });

  const act = useMutation({
    mutationFn: async (p: { id: string; body: Record<string, unknown> }) => {
      const res = await fetch(`/api/admin/security/${p.id}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(p.body) });
      if (!res.ok) { const b = await res.json().catch(() => ({})); throw new Error(b.error || "failed"); }
    },
    onSuccess: refresh,
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">{t("pwa.title")}</h1>
        <p className="text-sm text-slate-500">{t("pwa.subtitle")}</p>
      </div>

      {data.data && <PolicyCard policy={data.data.policy} onSaved={refresh} />}

      <Card className="overflow-x-auto">
        <div className="border-b border-slate-100 px-4 py-3 text-sm font-semibold uppercase tracking-wide text-slate-500 dark:border-slate-800">{t("pwa.users")}</div>
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500 dark:bg-slate-800/50">
            <tr>
              <th className="px-4 py-3">{t("gl.name")}</th>
              <th className="px-4 py-3">2FA</th>
              <th className="px-4 py-3">{t("users.status")}</th>
              <th className="px-4 py-3">Last sign-in</th>
              <th className="px-4 py-3 text-right">{t("common.actions")}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {data.isLoading && <tr><td colSpan={5} className="px-4 py-6 text-center text-slate-400">{t("common.loading")}</td></tr>}
            {data.data?.users.map((u) => (
              <tr key={u.id}>
                <td className="px-4 py-2.5">
                  <div className="font-medium">{u.fullName}</div>
                  <div className="text-xs text-slate-500">{u.email}</div>
                </td>
                <td className="px-4 py-2.5"><Badge color={u.mfaEnabled ? "green" : "slate"}>{u.mfaEnabled ? "ON" : "OFF"}</Badge></td>
                <td className="px-4 py-2.5">
                  <div className="flex flex-wrap gap-1">
                    <Badge color={u.status === "ACTIVE" ? "green" : "red"}>{u.status}</Badge>
                    {u.locked && <Badge color="red">{t("pwa.locked")}</Badge>}
                    {u.mustChangePassword && <Badge color="amber">{t("pwa.mustChange")}</Badge>}
                  </div>
                </td>
                <td className="px-4 py-2.5 text-xs text-slate-500">{u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleDateString() : "—"}</td>
                <td className="px-4 py-2.5">
                  <div className="flex flex-wrap justify-end gap-1">
                    <Button size="sm" variant="outline" onClick={() => setResetFor(u)}>{t("pwa.reset")}</Button>
                    <Button size="sm" variant="ghost" onClick={() => act.mutate({ id: u.id, body: { action: "forceChange" } })}>{t("pwa.force")}</Button>
                    {u.locked
                      ? <Button size="sm" variant="ghost" onClick={() => act.mutate({ id: u.id, body: { action: "unlock" } })}>{t("pwa.unlock")}</Button>
                      : <Button size="sm" variant="ghost" onClick={() => act.mutate({ id: u.id, body: { action: "lock" } })}>{t("pwa.lock")}</Button>}
                    {u.mfaEnabled && <Button size="sm" variant="ghost" onClick={() => act.mutate({ id: u.id, body: { action: "disableMfa" } })}>{t("pwa.disableMfa")}</Button>}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      {resetFor && <ResetDialog user={resetFor} onClose={() => setResetFor(null)} onDone={() => { setResetFor(null); refresh(); }} />}
    </div>
  );
}

function PolicyCard({ policy, onSaved }: { policy: Policy; onSaved: () => void }) {
  const t = useT();
  const [p, setP] = useState<Policy>(policy);
  const [saved, setSaved] = useState(false);
  useEffect(() => setP(policy), [policy]);
  const set = (k: keyof Policy, v: number | boolean) => setP((x) => ({ ...x, [k]: v }));
  const save = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/admin/security", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(p) });
      if (!res.ok) throw new Error();
    },
    onSuccess: () => { setSaved(true); onSaved(); setTimeout(() => setSaved(false), 2000); },
  });
  const Toggle = ({ k, label }: { k: keyof Policy; label: string }) => (
    <label className="flex items-center gap-2 text-sm">
      <input type="checkbox" checked={p[k] as boolean} onChange={(e) => set(k, e.target.checked)} /> {label}
    </label>
  );
  return (
    <Card className="p-5">
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">{t("pwa.policy")}</h2>
      <div className="grid gap-4 sm:grid-cols-3">
        <div>
          <label className="mb-1 block text-xs font-medium">{t("pwa.minLength")}</label>
          <Input type="number" value={p.minLength} onChange={(e) => set("minLength", Number(e.target.value))} />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium">{t("pwa.expiry")}</label>
          <Input type="number" value={p.expiryDays} onChange={(e) => set("expiryDays", Number(e.target.value))} />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium">{t("pwa.history")}</label>
          <Input type="number" value={p.historyCount} onChange={(e) => set("historyCount", Number(e.target.value))} />
        </div>
      </div>
      <div className="mt-4 grid gap-2 sm:grid-cols-3">
        <Toggle k="requireUpper" label={t("pwa.reqUpper")} />
        <Toggle k="requireLower" label={t("pwa.reqLower")} />
        <Toggle k="requireNumber" label={t("pwa.reqNumber")} />
        <Toggle k="requireSpecial" label={t("pwa.reqSpecial")} />
        <Toggle k="breachCheck" label={t("pwa.breach")} />
      </div>
      <div className="mt-4 flex items-center gap-3">
        <Button disabled={save.isPending} onClick={() => save.mutate()}>{t("pwa.savePolicy")}</Button>
        {saved && <span className="text-sm text-green-600">{t("pwa.saved")}</span>}
      </div>
    </Card>
  );
}

function ResetDialog({ user, onClose, onDone }: { user: SecUser; onClose: () => void; onDone: () => void }) {
  const t = useT();
  const [pw, setPw] = useState("");
  const [force, setForce] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const reset = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/admin/security/${user.id}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "reset", password: pw, mustChange: force }) });
      const b = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(b.error || "failed");
    },
    onSuccess: onDone,
    onError: (e: Error) => setErr(e.message),
  });
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <Card className="w-full max-w-md p-6">
        <h2 className="mb-1 text-lg font-semibold">{t("pwa.reset")}</h2>
        <p className="mb-4 text-sm text-slate-500">{user.fullName} · {user.email}</p>
        <div className="space-y-3">
          <Input type="text" placeholder={t("pwa.newPw")} value={pw} onChange={(e) => setPw(e.target.value)} />
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={force} onChange={(e) => setForce(e.target.checked)} /> {t("pwa.forceNext")}
          </label>
          {err && <p className="text-sm text-red-600">{err}</p>}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={onClose}>{t("common.cancel")}</Button>
            <Button disabled={pw.length < 12 || reset.isPending} onClick={() => reset.mutate()}>{t("pwa.reset")}</Button>
          </div>
        </div>
      </Card>
    </div>
  );
}

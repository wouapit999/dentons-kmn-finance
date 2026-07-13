"use client";
import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button, Input, Card, Badge } from "@/components/ui";
import { useT } from "@/lib/useT";

interface SecurityInfo {
  email: string;
  mfaEnabled: boolean;
  recoveryEmail: string | null;
  passwordChangedAt: string | null;
  sessions: { id: string; current: boolean; ip: string | null; userAgent: string | null; createdAt: string; expiresAt: string }[];
  loginHistory: { at: string; ip: string | null; success: boolean; reason: string | null }[];
  activity: { at: string; action: string }[];
}

export default function SecurityPage() {
  const t = useT();
  const qc = useQueryClient();
  const forced = useSearchParams().get("force") === "1";

  const info = useQuery({
    queryKey: ["me-security"],
    queryFn: async () => {
      const res = await fetch("/api/me/security");
      if (!res.ok) throw new Error();
      return (await res.json()) as SecurityInfo;
    },
  });
  const refresh = () => qc.invalidateQueries({ queryKey: ["me-security"] });
  const d = info.data;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">{t("sec.title")}</h1>
        <p className="text-sm text-slate-500">{t("sec.subtitle")}</p>
      </div>
      {forced && (
        <Card className="border-amber-300 bg-amber-50 p-4 text-sm font-medium text-amber-800 dark:border-amber-700 dark:bg-amber-900/30 dark:text-amber-200">
          {t("sec.forceBanner")}
        </Card>
      )}

      <ChangePasswordCard />
      {d && <MfaCard mfaEnabled={d.mfaEnabled} onChanged={refresh} />}
      {d && <RecoveryCard current={d.recoveryEmail} onChanged={refresh} />}
      {d && <SessionsCard sessions={d.sessions} onChanged={refresh} />}
      {d && <ActivityCard info={d} />}
    </div>
  );
}

function ChangePasswordCard() {
  const t = useT();
  const router = useRouter();
  const [cur, setCur] = useState("");
  const [nw, setNw] = useState("");
  const [cf, setCf] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const change = useMutation({
    mutationFn: async () => {
      if (nw !== cf) throw new Error(t("sec.mismatch"));
      const res = await fetch("/api/me/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword: cur, newPassword: nw }),
      });
      const b = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(b.error || "failed");
    },
    onSuccess: () => {
      setMsg(t("sec.pwChanged")); setErr(null);
      setTimeout(() => { router.push("/login"); router.refresh(); }, 1500);
    },
    onError: (e: Error) => { setErr(e.message); setMsg(null); },
  });

  return (
    <Card className="p-5">
      <h2 className="mb-1 text-sm font-semibold uppercase tracking-wide text-slate-500">{t("sec.changePw")}</h2>
      <p className="mb-3 text-xs text-slate-400">{t("sec.pwReq")}</p>
      <div className="grid max-w-md gap-3">
        <Input type="password" autoComplete="current-password" placeholder={t("sec.current")} value={cur} onChange={(e) => setCur(e.target.value)} />
        <Input type="password" autoComplete="new-password" placeholder={t("sec.new")} value={nw} onChange={(e) => setNw(e.target.value)} />
        <Input type="password" autoComplete="new-password" placeholder={t("sec.confirm")} value={cf} onChange={(e) => setCf(e.target.value)} />
        {err && <p className="text-sm text-red-600">{err}</p>}
        {msg && <p className="text-sm text-green-600">{msg}</p>}
        <div><Button disabled={!cur || nw.length < 12 || change.isPending} onClick={() => change.mutate()}>{t("sec.changePw")}</Button></div>
      </div>
    </Card>
  );
}

function MfaCard({ mfaEnabled, onChanged }: { mfaEnabled: boolean; onChanged: () => void }) {
  const t = useT();
  const [setup, setSetup] = useState<{ secret: string; otpauth: string } | null>(null);
  const [code, setCode] = useState("");
  const [pw, setPw] = useState("");
  const [err, setErr] = useState<string | null>(null);

  const call = useMutation({
    mutationFn: async (body: Record<string, unknown>) => {
      const res = await fetch("/api/me/mfa", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const b = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(b.error || "failed");
      return b;
    },
    onError: (e: Error) => setErr(e.message),
  });

  return (
    <Card className="p-5">
      <div className="mb-3 flex items-center gap-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">{t("sec.mfa")}</h2>
        <Badge color={mfaEnabled ? "green" : "slate"}>{mfaEnabled ? t("sec.mfaOn") : t("sec.mfaOff")}</Badge>
      </div>

      {mfaEnabled ? (
        <div className="grid max-w-md gap-2">
          <Input type="password" placeholder={t("sec.mfaPwDisable")} value={pw} onChange={(e) => setPw(e.target.value)} />
          {err && <p className="text-sm text-red-600">{err}</p>}
          <div><Button variant="danger" disabled={!pw || call.isPending} onClick={() => call.mutate({ action: "disable", password: pw }, { onSuccess: onChanged })}>{t("sec.mfaDisable")}</Button></div>
        </div>
      ) : setup ? (
        <div className="grid max-w-md gap-2">
          <p className="text-sm text-slate-500">{t("sec.mfaSetup")}</p>
          <div className="rounded-md bg-slate-50 p-2 dark:bg-slate-800/50">
            <div className="text-xs text-slate-500">{t("sec.mfaSecret")}</div>
            <code className="break-all text-sm font-semibold">{setup.secret}</code>
          </div>
          <Input inputMode="numeric" maxLength={6} placeholder={t("sec.mfaCode")} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} />
          {err && <p className="text-sm text-red-600">{err}</p>}
          <div><Button disabled={code.length !== 6 || call.isPending} onClick={() => call.mutate({ action: "enable", code }, { onSuccess: () => { setSetup(null); setCode(""); onChanged(); } })}>{t("sec.mfaConfirm")}</Button></div>
        </div>
      ) : (
        <Button onClick={() => { setErr(null); call.mutate({ action: "setup" }, { onSuccess: (b) => setSetup(b as { secret: string; otpauth: string }) }); }}>{t("sec.mfaEnable")}</Button>
      )}
    </Card>
  );
}

function RecoveryCard({ current, onChanged }: { current: string | null; onChanged: () => void }) {
  const t = useT();
  const [email, setEmail] = useState(current ?? "");
  const [saved, setSaved] = useState(false);
  const save = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/me/security", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ recoveryEmail: email || null }) });
      if (!res.ok) throw new Error();
    },
    onSuccess: () => { setSaved(true); onChanged(); setTimeout(() => setSaved(false), 2000); },
  });
  return (
    <Card className="p-5">
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">{t("sec.recovery")}</h2>
      <div className="flex max-w-md gap-2">
        <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
        <Button variant="outline" disabled={save.isPending} onClick={() => save.mutate()}>{saved ? "✓" : t("sec.recoverySave")}</Button>
      </div>
    </Card>
  );
}

function SessionsCard({ sessions, onChanged }: { sessions: SecurityInfo["sessions"]; onChanged: () => void }) {
  const t = useT();
  const revoke = useMutation({
    mutationFn: async (target: string) => {
      await fetch("/api/me/sessions/revoke", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ target }) });
    },
    onSuccess: onChanged,
  });
  return (
    <Card className="p-5">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">{t("sec.sessions")}</h2>
        {sessions.length > 1 && <Button size="sm" variant="outline" onClick={() => revoke.mutate("others")}>{t("sec.revokeOthers")}</Button>}
      </div>
      <ul className="space-y-1 text-sm">
        {sessions.map((s) => (
          <li key={s.id} className="flex items-center justify-between border-b border-slate-100 py-1.5 dark:border-slate-800">
            <span className="min-w-0">
              <span className="truncate">{s.ip ?? "—"}</span>
              {s.current && <Badge color="brand"> {t("sec.thisDevice")}</Badge>}
              <span className="ml-2 block truncate text-xs text-slate-400">{(s.userAgent ?? "").slice(0, 60)}</span>
            </span>
            {!s.current && <Button size="sm" variant="ghost" onClick={() => revoke.mutate(s.id)}>{t("sec.revoke")}</Button>}
          </li>
        ))}
      </ul>
    </Card>
  );
}

function ActivityCard({ info }: { info: SecurityInfo }) {
  const t = useT();
  return (
    <div className="grid gap-6 md:grid-cols-2">
      <Card className="p-5">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">{t("sec.loginHistory")}</h2>
        <ul className="space-y-1 text-sm">
          {info.loginHistory.map((h, i) => (
            <li key={i} className="flex justify-between">
              <span className={h.success ? "" : "text-red-600"}>{h.success ? "✓" : "✕"} {h.ip ?? "—"}</span>
              <span className="text-xs text-slate-400">{new Date(h.at).toLocaleString()}</span>
            </li>
          ))}
        </ul>
      </Card>
      <Card className="p-5">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">{t("sec.activity")}</h2>
        <ul className="space-y-1 text-sm">
          {info.activity.length === 0 && <li className="text-slate-400">—</li>}
          {info.activity.map((a, i) => (
            <li key={i} className="flex justify-between">
              <Badge color="slate">{a.action}</Badge>
              <span className="text-xs text-slate-400">{new Date(a.at).toLocaleString()}</span>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}

"use client";
import { Suspense, useState } from "react";
import { useForm } from "react-hook-form";
import { useRouter, useSearchParams } from "next/navigation";
import { Button, Input, Card } from "@/components/ui";
import { Logo } from "@/components/logo";
import { useT } from "@/lib/useT";
import { useUi } from "@/lib/store";
import type { LoginInput } from "@/lib/validation";

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const t = useT();
  const router = useRouter();
  const params = useSearchParams();
  const { locale, setLocale } = useUi();
  const { register, handleSubmit, formState } = useForm<LoginInput>();
  const [error, setError] = useState<string | null>(null);
  const [mfaToken, setMfaToken] = useState<string | null>(null);
  const [code, setCode] = useState("");

  function afterAuth(body: { locale?: string; mustChangePassword?: boolean }) {
    if (body.locale === "en" || body.locale === "fr") setLocale(body.locale);
    if (body.mustChangePassword) router.push("/security?force=1");
    else router.push(params.get("next") || "/dashboard");
    router.refresh();
  }

  async function onSubmit(data: LoginInput) {
    setError(null);
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!res.ok) { setError(t("login.error")); return; }
    const body = await res.json();
    if (body.mfaRequired) { setMfaToken(body.mfaToken); return; } // show 2FA step
    afterAuth(body);
  }

  async function submitMfa() {
    setError(null);
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mfaToken, code }),
    });
    if (!res.ok) { setError(t("login.mfaError")); return; }
    afterAuth(await res.json());
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-brand-50 to-slate-100 p-4 dark:from-slate-950 dark:to-slate-900">
      <Card className="w-full max-w-md p-8">
        <div className="mb-6 text-center">
          <Logo className="mx-auto mb-3 h-9 w-auto" />
          <h1 className="text-xl font-semibold">{t("login.title")}</h1>
          <p className="text-sm text-slate-500">ERP by Bouquet Innovation SA</p>
        </div>

        {mfaToken ? (
          <div className="space-y-4">
            <p className="text-sm text-slate-500">{t("login.mfaPrompt")}</p>
            <Input
              inputMode="numeric" autoComplete="one-time-code" maxLength={6}
              placeholder="123456" value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
              onKeyDown={(e) => { if (e.key === "Enter" && code.length === 6) submitMfa(); }}
              autoFocus
            />
            {error && <p className="text-sm text-red-600">{error}</p>}
            <Button className="w-full" disabled={code.length !== 6} onClick={submitMfa}>
              {t("login.verify")}
            </Button>
            <button className="w-full text-xs text-slate-500 hover:underline" onClick={() => { setMfaToken(null); setCode(""); setError(null); }}>
              {t("common.cancel")}
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium">{t("login.email")}</label>
              <Input type="email" autoComplete="username" {...register("email", { required: true })} />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">{t("login.password")}</label>
              <Input type="password" autoComplete="current-password" {...register("password", { required: true })} />
            </div>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <Button type="submit" className="w-full" disabled={formState.isSubmitting}>
              {t("login.submit")}
            </Button>
          </form>
        )}

        <div className="mt-6 flex items-center justify-center gap-2 text-xs text-slate-500">
          <span>{t("common.language")}:</span>
          <button
            onClick={() => setLocale("en")}
            className={locale === "en" ? "font-semibold text-brand" : ""}
          >
            EN
          </button>
          <span>/</span>
          <button
            onClick={() => setLocale("fr")}
            className={locale === "fr" ? "font-semibold text-brand" : ""}
          >
            FR
          </button>
        </div>
      </Card>
    </div>
  );
}

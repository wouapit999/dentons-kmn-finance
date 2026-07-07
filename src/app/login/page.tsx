"use client";
import { Suspense, useState } from "react";
import { useForm } from "react-hook-form";
import { useRouter, useSearchParams } from "next/navigation";
import { Button, Input, Card } from "@/components/ui";
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

  async function onSubmit(data: LoginInput) {
    setError(null);
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      setError(t("login.error"));
      return;
    }
    const body = await res.json();
    if (body.locale) setLocale(body.locale);
    router.push(params.get("next") || "/dashboard");
    router.refresh();
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-brand-50 to-slate-100 p-4 dark:from-slate-950 dark:to-slate-900">
      <Card className="w-full max-w-md p-8">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-lg bg-brand text-lg font-bold text-white">
            KMN
          </div>
          <h1 className="text-xl font-semibold">{t("login.title")}</h1>
          <p className="text-sm text-slate-500">{t("login.subtitle")}</p>
        </div>

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

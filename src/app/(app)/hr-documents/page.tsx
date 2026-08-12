"use client";
/*
 * Dentons KMN ERP
 * Copyright (c) 2026 Bouquet Innovation SA. All rights reserved.
 * Proprietary and confidential. Unauthorised copying, distribution, modification,
 * or use of this file, via any medium, is strictly prohibited.
 */
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button, Input, Card, Badge } from "@/components/ui";
import { useT } from "@/lib/useT";
import { useUi } from "@/lib/store";
import { usePerms, getJson } from "@/lib/usePerms";
import {
  HR_DOC_TYPES,
  DEFAULT_ADDRESS,
  todayIso,
  type HrDocField,
  type HrDocTypeSpec,
} from "@/lib/hr-docs";

interface Employee {
  id: string;
  employeeNo: string;
  fullName: string;
  position: string | null;
  baseSalary: number;
  housingAllowance: number;
  transportAllowance: number;
  cnpsNo: string | null;
  hireDate: string | null;
  currency: string;
}

interface RegisterRow {
  id: string;
  reference: string;
  docType: string;
  title: string;
  subjectName: string;
  issuedAt: string;
}

interface PreviewResult {
  reference: string;
  title: string;
  subtitle: string;
  markdown: string;
  footer: string;
  advisories: { en: string; fr: string }[];
}

interface MissingField {
  key: string;
  en: string;
  fr: string;
}

const GROUPS: { key: HrDocField["group"]; en: string; fr: string }[] = [
  { key: "subject", en: "Person concerned", fr: "Personne concernée" },
  { key: "details", en: "Particulars", fr: "Éléments du document" },
  { key: "issuance", en: "Purpose and issuance", fr: "Objet et établissement" },
  { key: "signatory", en: "Signatory and HR contact", fr: "Signataire et contact RH" },
];

function initialValues(spec: HrDocTypeSpec): Record<string, string> {
  const values: Record<string, string> = {};
  for (const f of spec.fields) values[f.key] = f.default ?? "";
  values.issue_date = todayIso();
  values.company_address = values.company_address || DEFAULT_ADDRESS;
  return values;
}

export default function HrDocumentsPage() {
  const t = useT();
  const locale = useUi((s) => s.locale);
  const { can } = usePerms();
  const qc = useQueryClient();
  const fr = locale === "fr";

  const [typeKey, setTypeKey] = useState<string>(HR_DOC_TYPES[0].key);
  const spec = useMemo(() => HR_DOC_TYPES.find((d) => d.key === typeKey)!, [typeKey]);
  const [values, setValues] = useState<Record<string, string>>(() => initialValues(HR_DOC_TYPES[0]));
  const [missing, setMissing] = useState<MissingField[]>([]);
  const [preview, setPreview] = useState<PreviewResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<null | "preview" | "pdf" | "docx">(null);

  const employees = useQuery({
    queryKey: ["employees"],
    queryFn: () => getJson<Employee[]>("/api/employees"),
  });

  const register = useQuery({
    queryKey: ["hr-documents"],
    queryFn: () => getJson<RegisterRow[]>("/api/hr-documents"),
  });

  const label = (f: { en: string; fr: string }) => (fr ? f.fr : f.en);

  function switchType(next: string) {
    const nextSpec = HR_DOC_TYPES.find((d) => d.key === next)!;
    setTypeKey(next);
    // Carry over anything the new type also asks for, so switching between two
    // attestations for the same person does not mean retyping the file.
    setValues((prev) => {
      const fresh = initialValues(nextSpec);
      for (const f of nextSpec.fields) {
        if (prev[f.key]) fresh[f.key] = prev[f.key];
        if (f.translatable && prev[`${f.key}_fr`]) fresh[`${f.key}_fr`] = prev[`${f.key}_fr`];
      }
      return fresh;
    });
    setPreview(null);
    setMissing([]);
    setError(null);
  }

  function set(key: string, value: string) {
    setValues((v) => ({ ...v, [key]: value }));
  }

  function applyEmployee(id: string) {
    const e = employees.data?.find((x) => x.id === id);
    if (!e) return;
    const gross = e.baseSalary + e.housingAllowance + e.transportAllowance;
    setValues((v) => ({
      ...v,
      employee_full_name: e.fullName,
      employee_position: e.position ?? v.employee_position ?? "",
      employee_no: e.employeeNo,
      employment_start_date: e.hireDate ?? v.employment_start_date ?? "",
      cnps_number: e.cnpsNo ?? v.cnps_number ?? "",
      gross_monthly_salary: gross ? String(gross) : (v.gross_monthly_salary ?? ""),
      salary_currency: e.currency || v.salary_currency || "XAF",
    }));
  }

  async function submit(action: "preview" | "issue", format: "pdf" | "docx" = "pdf") {
    setBusy(action === "preview" ? "preview" : format);
    setError(null);
    try {
      const res = await fetch("/api/hr-documents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ document_type: typeKey, fields: values, action, format }),
      });

      if (res.status === 422) {
        const data = await res.json();
        setMissing(data.missing ?? []);
        setPreview(null);
        return;
      }
      if (!res.ok) {
        setError(t("hrdoc.failed"));
        return;
      }

      setMissing([]);
      if (action === "preview") {
        setPreview((await res.json()) as PreviewResult);
        return;
      }

      const blob = await res.blob();
      const name =
        res.headers.get("Content-Disposition")?.match(/filename="(.+)"/)?.[1] ?? `document.${format}`;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = name;
      a.click();
      URL.revokeObjectURL(url);
      setPreview(null);
      qc.invalidateQueries({ queryKey: ["hr-documents"] });
    } catch {
      setError(t("hrdoc.failed"));
    } finally {
      setBusy(null);
    }
  }

  const inputClass =
    "h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-900";

  function renderField(f: HrDocField) {
    const value = values[f.key] ?? "";
    const common = { id: f.key, value, required: f.required };
    return (
      <div key={f.key} className={f.wide ? "sm:col-span-2" : ""}>
        <label htmlFor={f.key} className="mb-1 block text-sm font-medium">
          {label(f)}
          {f.required && <span className="ml-1 text-red-600">*</span>}
        </label>
        {f.kind === "select" ? (
          <select
            {...common}
            className={inputClass}
            onChange={(e) => set(f.key, e.target.value)}
          >
            <option value="">—</option>
            {f.options?.map((o) => (
              <option key={o.value} value={o.value}>
                {fr ? o.fr : o.en}
              </option>
            ))}
          </select>
        ) : f.kind === "textarea" ? (
          <textarea
            {...common}
            rows={3}
            className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900"
            onChange={(e) => set(f.key, e.target.value)}
          />
        ) : (
          <Input
            {...common}
            type={f.kind === "date" ? "date" : f.kind === "money" ? "number" : "text"}
            onChange={(e) => set(f.key, e.target.value)}
          />
        )}
        {f.translatable && (
          <div className="mt-1.5">
            <label htmlFor={`${f.key}_fr`} className="mb-1 block text-xs text-slate-500">
              {t("hrdoc.frenchWording")}
            </label>
            {f.kind === "textarea" ? (
              <textarea
                id={`${f.key}_fr`}
                rows={2}
                value={values[`${f.key}_fr`] ?? ""}
                className="w-full rounded-md border border-dashed border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900"
                onChange={(e) => set(`${f.key}_fr`, e.target.value)}
              />
            ) : (
              <Input
                id={`${f.key}_fr`}
                value={values[`${f.key}_fr`] ?? ""}
                className="border-dashed"
                onChange={(e) => set(`${f.key}_fr`, e.target.value)}
              />
            )}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">{t("hrdoc.title")}</h1>
        <p className="text-sm text-slate-500">{t("hrdoc.subtitle")}</p>
      </div>

      <Card className="p-5">
        <label htmlFor="document_type" className="mb-1 block text-sm font-medium">
          {t("hrdoc.type")}
        </label>
        <select
          id="document_type"
          className={`${inputClass} max-w-xl`}
          value={typeKey}
          onChange={(e) => switchType(e.target.value)}
        >
          {HR_DOC_TYPES.map((d) => (
            <option key={d.key} value={d.key}>
              {d.en} / {d.fr}
            </option>
          ))}
        </select>
        <p className="mt-2 text-sm text-slate-500">{fr ? spec.descriptionFr : spec.descriptionEn}</p>

        {employees.data && employees.data.length > 0 && spec.fields.some((f) => f.key === "employee_full_name") && (
          <div className="mt-4 max-w-xl">
            <label htmlFor="prefill" className="mb-1 block text-sm font-medium">
              {t("hrdoc.prefill")}
            </label>
            <select
              id="prefill"
              className={inputClass}
              defaultValue=""
              onChange={(e) => applyEmployee(e.target.value)}
            >
              <option value="">—</option>
              {employees.data.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.employeeNo} — {e.fullName}
                </option>
              ))}
            </select>
          </div>
        )}
      </Card>

      {missing.length > 0 && (
        <Card className="border-red-300 bg-red-50 p-4 dark:border-red-900 dark:bg-red-950/40">
          <p className="text-sm font-semibold text-red-800 dark:text-red-300">{t("hrdoc.missing")}</p>
          <ul className="mt-2 list-disc space-y-0.5 pl-5 text-sm text-red-800 dark:text-red-300">
            {missing.map((m) => (
              <li key={m.key}>{label(m)}</li>
            ))}
          </ul>
        </Card>
      )}

      {preview && preview.advisories.length > 0 && (
        <Card className="border-amber-300 bg-amber-50 p-4 dark:border-amber-900 dark:bg-amber-950/40">
          <p className="text-sm font-semibold text-amber-900 dark:text-amber-300">{t("hrdoc.advisories")}</p>
          <ul className="mt-2 list-disc space-y-0.5 pl-5 text-sm text-amber-900 dark:text-amber-300">
            {preview.advisories.map((a, i) => (
              <li key={i}>{label(a)}</li>
            ))}
          </ul>
        </Card>
      )}

      {error && <p className="text-sm text-red-600">{error}</p>}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit("preview");
        }}
        className="space-y-4"
      >
        {GROUPS.map((g) => {
          const fields = spec.fields.filter((f) => f.group === g.key);
          if (!fields.length) return null;
          return (
            <Card key={g.key} className="p-5">
              <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-500">
                {label(g)}
              </h2>
              <div className="grid gap-4 sm:grid-cols-2">{fields.map(renderField)}</div>
            </Card>
          );
        })}

        <div className="flex flex-wrap items-center gap-2">
          <Button type="submit" disabled={busy !== null}>
            {busy === "preview" ? t("common.loading") : t("hrdoc.check")}
          </Button>
          {can("payroll:manage") && (
            <>
              <Button
                type="button"
                variant="outline"
                disabled={busy !== null}
                onClick={() => submit("issue", "pdf")}
              >
                {busy === "pdf" ? t("common.loading") : t("hrdoc.issuePdf")}
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={busy !== null}
                onClick={() => submit("issue", "docx")}
              >
                {busy === "docx" ? t("common.loading") : t("hrdoc.issueDocx")}
              </Button>
            </>
          )}
          <span className="text-xs text-slate-500">{t("hrdoc.issueNote")}</span>
        </div>
      </form>

      {preview && (
        <Card className="p-5">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-lg font-semibold">{preview.title}</h2>
            <Badge color="brand">{preview.reference}</Badge>
          </div>
          <p className="mb-3 text-xs text-slate-500">{t("hrdoc.provisional")}</p>
          <pre className="max-h-[32rem] overflow-auto whitespace-pre-wrap rounded-md bg-slate-50 p-4 text-[13px] leading-relaxed dark:bg-slate-800/60">
            {preview.markdown}
          </pre>
          <p className="mt-3 text-xs text-slate-500">{preview.footer}</p>
        </Card>
      )}

      <Card className="overflow-x-auto">
        <h2 className="px-4 pt-4 text-sm font-semibold uppercase tracking-wide text-slate-500">
          {t("hrdoc.register")}
        </h2>
        <table className="mt-3 w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500 dark:bg-slate-800/50">
            <tr>
              <th className="px-4 py-3">{t("hrdoc.reference")}</th>
              <th className="px-4 py-3">{t("hrdoc.document")}</th>
              <th className="px-4 py-3">{t("hrdoc.subject")}</th>
              <th className="px-4 py-3">{t("hrdoc.issued")}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {register.isLoading && (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-center text-slate-400">
                  {t("common.loading")}
                </td>
              </tr>
            )}
            {register.data?.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-center text-slate-400">
                  —
                </td>
              </tr>
            )}
            {register.data?.map((r) => (
              <tr key={r.id}>
                <td className="px-4 py-2.5 font-mono text-xs">{r.reference}</td>
                <td className="px-4 py-2.5">{r.title}</td>
                <td className="px-4 py-2.5 text-slate-500">{r.subjectName || "—"}</td>
                <td className="px-4 py-2.5 text-slate-500">{r.issuedAt.slice(0, 10)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}

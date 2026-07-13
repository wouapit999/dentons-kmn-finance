"use client";
import { useState } from "react";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button, Input, Card, Badge } from "@/components/ui";
import { useT } from "@/lib/useT";
import { CLIENT_DOC_MIMES } from "@/lib/constants";

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
interface Meta {
  lawyers: { id: string; fullName: string }[];
  caseTypes: string[];
}

const kycColor = (s: string) => (s === "VERIFIED" ? "green" : s === "REJECTED" ? "red" : "amber");
const amlColor = (s: string) => (s === "HIGH" ? "red" : s === "MEDIUM" ? "amber" : "slate");
const conflictColor = (s: string) =>
  s === "CLEAR" ? "green" : s === "POTENTIAL" ? "amber" : s === "BLOCKED" ? "red" : "slate";

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
  const canManage = me.data?.permissions.includes("client:manage") ?? false;

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
        <IntakeWizard
          onClose={() => setOpen(false)}
          onCreated={() => {
            setOpen(false);
            qc.invalidateQueries({ queryKey: ["clients"] });
          }}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Step-by-step client intake wizard: Identity → Contact & engagement →
// Documents & review. Validation per step; documents are uploaded to the new
// client's file after creation and scanned for metadata server-side.
// ---------------------------------------------------------------------------

interface QueuedFile {
  file: File;
  kind: string;
  status: "queued" | "uploading" | "done" | "error";
  scan?: string | null;
}

const ACCEPT = ".pdf,.docx,.jpg,.jpeg,.png";
const MAX_BYTES = 2 * 1024 * 1024;

function IntakeWizard({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const t = useT();
  const [step, setStep] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    type: "CORPORATE", name: "", idNumber: "", taxId: "",
    email: "", phone: "", address: "", caseType: "", assignedLawyerId: "", amlRisk: "LOW",
  });
  const [files, setFiles] = useState<QueuedFile[]>([]);
  const [creating, setCreating] = useState(false);
  const [result, setResult] = useState<{ clientNo: string } | null>(null);
  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const meta = useQuery({
    queryKey: ["clients-meta"],
    queryFn: async () => (await fetch("/api/clients/meta")).json() as Promise<Meta>,
  });

  function validateStep(s: number): string | null {
    if (s === 1 && form.name.trim().length < 2) return t("wiz.nameRequired");
    if (s === 2 && form.email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(form.email))
      return "Enter a valid email / E-mail invalide.";
    return null;
  }
  function next() {
    const err = validateStep(step);
    if (err) { setError(err); return; }
    setError(null);
    setStep((s) => s + 1);
  }

  function addFiles(list: FileList | null) {
    if (!list) return;
    const added: QueuedFile[] = [];
    for (const file of Array.from(list)) {
      if (!(CLIENT_DOC_MIMES as readonly string[]).includes(file.type)) {
        setError(`${file.name}: ${t("wiz.badType")}`);
        continue;
      }
      if (file.size > MAX_BYTES) {
        setError(`${file.name}: ${t("wiz.tooLarge")}`);
        continue;
      }
      added.push({ file, kind: guessKind(file.name), status: "queued" });
    }
    if (added.length) setError(null);
    setFiles((f) => [...f, ...added]);
  }
  function guessKind(name: string): string {
    const n = name.toLowerCase();
    if (/(id|cni|passport|passeport)/.test(n)) return "IDENTITY";
    if (/(contract|contrat|engagement)/.test(n)) return "CONTRACT";
    if (/(ref|recommand)/.test(n)) return "REFERENCE";
    return "OTHER";
  }

  async function submit() {
    setCreating(true);
    setError(null);
    try {
      // 1) Create the client (server generates the unique client number).
      const res = await fetch("/api/clients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (res.status === 403) throw new Error("You don't have permission to create clients.");
        throw new Error(body?.issues ? "Please check the fields." : body.error || "Could not create client.");
      }
      // 2) Upload each document into the client's file (scanned server-side).
      for (let i = 0; i < files.length; i++) {
        setFiles((fs) => fs.map((f, idx) => (idx === i ? { ...f, status: "uploading" } : f)));
        try {
          const base64 = await new Promise<string>((resolve, reject) => {
            const r = new FileReader();
            r.onload = () => resolve(String(r.result).split(",")[1] ?? "");
            r.onerror = reject;
            r.readAsDataURL(files[i].file);
          });
          const up = await fetch(`/api/clients/${body.id}/documents`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              kind: files[i].kind,
              filename: files[i].file.name,
              mime: files[i].file.type,
              base64,
            }),
          });
          const upBody = await up.json().catch(() => ({}));
          setFiles((fs) =>
            fs.map((f, idx) =>
              idx === i ? { ...f, status: up.ok ? "done" : "error", scan: upBody.scan ?? null } : f,
            ),
          );
        } catch {
          setFiles((fs) => fs.map((f, idx) => (idx === i ? { ...f, status: "error" } : f)));
        }
      }
      setResult({ clientNo: body.clientNo });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setCreating(false);
    }
  }

  const steps = [t("wiz.step1"), t("wiz.step2"), t("wiz.step3")];
  const sel =
    "h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-900";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true" aria-label={t("clients.new")}>
      <Card className="max-h-[92vh] w-full max-w-xl overflow-y-auto p-6">
        <h2 className="mb-1 text-lg font-semibold">{t("clients.new")}</h2>
        <ol className="mb-5 flex items-center gap-2 text-xs" aria-label="Progress">
          {steps.map((label, i) => (
            <li key={label} className="flex items-center gap-2">
              <span
                aria-current={step === i + 1 ? "step" : undefined}
                className={
                  "flex h-6 w-6 items-center justify-center rounded-full font-semibold " +
                  (step > i + 1 ? "bg-green-600 text-white" : step === i + 1 ? "bg-brand text-white" : "bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-300")
                }
              >
                {step > i + 1 ? "✓" : i + 1}
              </span>
              <span className={step === i + 1 ? "font-medium" : "text-slate-500"}>{label}</span>
              {i < steps.length - 1 && <span className="text-slate-300">—</span>}
            </li>
          ))}
        </ol>

        {result ? (
          <div className="space-y-4 text-center">
            <p className="text-lg font-semibold text-green-600">{t("wiz.created")}</p>
            <p className="font-mono text-2xl">{result.clientNo}</p>
            <ul className="mx-auto max-w-sm space-y-1 text-left text-sm">
              {files.map((f, i) => (
                <li key={i} className="flex items-center justify-between gap-2">
                  <span className="truncate">{f.file.name}</span>
                  <Badge color={f.status === "done" ? "green" : "red"}>
                    {f.status === "done" ? (f.scan ? t("wiz.scanned") : "filed") : "error"}
                  </Badge>
                </li>
              ))}
            </ul>
            <Button onClick={onCreated}>OK</Button>
          </div>
        ) : (
          <>
            {step === 1 && (
              <fieldset className="space-y-3">
                <legend className="sr-only">{t("wiz.step1")}</legend>
                <div>
                  <label htmlFor="ctype" className="mb-1 block text-sm font-medium">{t("clients.type")}</label>
                  <select id="ctype" className={sel} value={form.type} onChange={(e) => set("type", e.target.value)}>
                    <option value="CORPORATE">CORPORATE</option>
                    <option value="INDIVIDUAL">INDIVIDUAL</option>
                  </select>
                </div>
                <div>
                  <label htmlFor="cname" className="mb-1 block text-sm font-medium">{t("gl.name")} *</label>
                  <Input id="cname" required aria-invalid={!!error && form.name.trim().length < 2}
                    value={form.name} onChange={(e) => set("name", e.target.value)} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label htmlFor="cid" className="mb-1 block text-sm font-medium">{t("wiz.idNumber")}</label>
                    <Input id="cid" value={form.idNumber} onChange={(e) => set("idNumber", e.target.value)} />
                  </div>
                  <div>
                    <label htmlFor="ctax" className="mb-1 block text-sm font-medium">Tax ID</label>
                    <Input id="ctax" value={form.taxId} onChange={(e) => set("taxId", e.target.value)} />
                  </div>
                </div>
              </fieldset>
            )}

            {step === 2 && (
              <fieldset className="space-y-3">
                <legend className="sr-only">{t("wiz.step2")}</legend>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label htmlFor="cemail" className="mb-1 block text-sm font-medium">Email</label>
                    <Input id="cemail" type="email" value={form.email} onChange={(e) => set("email", e.target.value)} />
                  </div>
                  <div>
                    <label htmlFor="cphone" className="mb-1 block text-sm font-medium">Phone</label>
                    <Input id="cphone" value={form.phone} onChange={(e) => set("phone", e.target.value)} />
                  </div>
                </div>
                <div>
                  <label htmlFor="caddr" className="mb-1 block text-sm font-medium">{t("wiz.address")}</label>
                  <Input id="caddr" value={form.address} onChange={(e) => set("address", e.target.value)} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label htmlFor="ccase" className="mb-1 block text-sm font-medium">{t("wiz.caseType")}</label>
                    <select id="ccase" className={sel} value={form.caseType} onChange={(e) => set("caseType", e.target.value)}>
                      <option value="">—</option>
                      {meta.data?.caseTypes.map((ct) => (
                        <option key={ct} value={ct}>{ct.replace(/_/g, " ")}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label htmlFor="claw" className="mb-1 block text-sm font-medium">{t("wiz.lawyer")}</label>
                    <select id="claw" className={sel} value={form.assignedLawyerId} onChange={(e) => set("assignedLawyerId", e.target.value)}>
                      <option value="">—</option>
                      {meta.data?.lawyers.map((l) => (
                        <option key={l.id} value={l.id}>{l.fullName}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div>
                  <label htmlFor="caml" className="mb-1 block text-sm font-medium">{t("clients.aml")}</label>
                  <select id="caml" className={sel} value={form.amlRisk} onChange={(e) => set("amlRisk", e.target.value)}>
                    <option value="LOW">LOW</option>
                    <option value="MEDIUM">MEDIUM</option>
                    <option value="HIGH">HIGH</option>
                  </select>
                </div>
              </fieldset>
            )}

            {step === 3 && (
              <div className="space-y-4">
                <p className="text-sm text-slate-500">{t("wiz.docsHint")}</p>
                <label className="inline-flex cursor-pointer items-center rounded-md border border-slate-300 px-4 py-2 text-sm font-medium hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800">
                  {t("wiz.addFiles")}
                  <input type="file" multiple accept={ACCEPT} className="hidden"
                    onChange={(e) => { addFiles(e.target.files); e.target.value = ""; }} />
                </label>
                <ul className="space-y-1 text-sm">
                  {files.map((f, i) => (
                    <li key={i} className="flex items-center justify-between gap-2">
                      <span className="truncate">{f.file.name}</span>
                      <span className="flex items-center gap-2">
                        <select
                          className="h-7 rounded border border-slate-300 bg-white px-1 text-xs dark:border-slate-700 dark:bg-slate-900"
                          value={f.kind}
                          onChange={(e) => setFiles((fs) => fs.map((x, idx) => (idx === i ? { ...x, kind: e.target.value } : x)))}
                          aria-label={`Document type for ${f.file.name}`}
                        >
                          {["IDENTITY", "REFERENCE", "CONTRACT", "OTHER"].map((k) => (
                            <option key={k} value={k}>{k}</option>
                          ))}
                        </select>
                        <button className="text-xs text-red-600 hover:underline"
                          onClick={() => setFiles((fs) => fs.filter((_, idx) => idx !== i))}>✕</button>
                      </span>
                    </li>
                  ))}
                </ul>
                <div className="rounded-md bg-slate-50 p-3 text-sm dark:bg-slate-800/50">
                  <p className="mb-1 font-semibold">{t("wiz.review")}</p>
                  <p>{form.name} · {form.type}{form.caseType ? ` · ${form.caseType.replace(/_/g, " ")}` : ""}</p>
                  <p className="text-slate-500">
                    {[form.email, form.phone, form.address].filter(Boolean).join(" · ") || "—"}
                  </p>
                  <p className="text-slate-500">
                    {meta.data?.lawyers.find((l) => l.id === form.assignedLawyerId)?.fullName ?? ""}
                    {files.length ? ` · ${files.length} file(s)` : ""}
                  </p>
                </div>
              </div>
            )}

            {error && <p role="alert" className="mt-3 text-sm text-red-600">{error}</p>}

            <div className="mt-5 flex justify-between">
              <Button variant="outline" onClick={step === 1 ? onClose : () => setStep((s) => s - 1)} disabled={creating}>
                {step === 1 ? t("common.cancel") : t("wiz.back")}
              </Button>
              {step < 3 ? (
                <Button onClick={next}>{t("wiz.next")}</Button>
              ) : (
                <Button disabled={creating} onClick={submit}>
                  {creating ? t("wiz.uploading") : t("wiz.finish")}
                </Button>
              )}
            </div>
          </>
        )}
      </Card>
    </div>
  );
}

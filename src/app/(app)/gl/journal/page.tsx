"use client";
import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button, Input, Card, Badge } from "@/components/ui";
import { useT } from "@/lib/useT";
import { formatMoney } from "@/lib/money";

interface Meta {
  journals: { id: string; code: string; name: string }[];
  periods: { id: string; name: string; status: string }[];
}
interface AccountOpt { id: string; code: string; name: string; isPostable: boolean }
interface Line { accountId: string; debit: string; credit: string; description: string }
interface EntryRow {
  id: string;
  entryNo: string;
  entryDate: string;
  description: string | null;
  journal: string;
  period: string;
  currency: string;
  lines: { account: string; debit: string; credit: string }[];
}

const emptyLine = (): Line => ({ accountId: "", debit: "", credit: "", description: "" });

export default function JournalPage() {
  const t = useT();
  const qc = useQueryClient();

  const meta = useQuery({
    queryKey: ["gl-meta"],
    queryFn: async () => (await fetch("/api/gl/journals")).json() as Promise<Meta>,
  });
  const accounts = useQuery({
    queryKey: ["accounts"],
    queryFn: async () => (await fetch("/api/gl/accounts")).json() as Promise<AccountOpt[]>,
  });
  const entries = useQuery({
    queryKey: ["gl-entries"],
    queryFn: async () => (await fetch("/api/gl/entries")).json() as Promise<EntryRow[]>,
  });

  const [journalId, setJournalId] = useState("");
  const [periodId, setPeriodId] = useState("");
  const [entryDate, setEntryDate] = useState(new Date().toISOString().slice(0, 10));
  const [description, setDescription] = useState("");
  const [lines, setLines] = useState<Line[]>([emptyLine(), emptyLine()]);
  const [error, setError] = useState<string | null>(null);

  const totals = useMemo(() => {
    const debit = lines.reduce((s, l) => s + (Number(l.debit) || 0), 0);
    const credit = lines.reduce((s, l) => s + (Number(l.credit) || 0), 0);
    return { debit, credit, balanced: Math.abs(debit - credit) < 0.0001 && debit > 0 };
  }, [lines]);

  const post = useMutation({
    mutationFn: async () => {
      const payload = {
        journalId,
        periodId,
        entryDate,
        description,
        currency: "XAF",
        lines: lines
          .filter((l) => l.accountId)
          .map((l) => ({
            accountId: l.accountId,
            debit: Number(l.debit) || 0,
            credit: Number(l.credit) || 0,
            description: l.description || undefined,
          })),
      };
      const res = await fetch("/api/gl/entries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "post_failed");
      }
    },
    onSuccess: () => {
      setLines([emptyLine(), emptyLine()]);
      setDescription("");
      setError(null);
      qc.invalidateQueries({ queryKey: ["gl-entries"] });
    },
    onError: (e: Error) => setError(e.message),
  });

  function setLine(i: number, patch: Partial<Line>) {
    setLines((ls) => ls.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));
  }

  const canPost = journalId && periodId && totals.balanced && !post.isPending;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">{t("gl.journal.title")}</h1>

      <Card className="p-5">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div>
            <label className="mb-1 block text-sm font-medium">{t("gl.field.journal")}</label>
            <select
              className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-900"
              value={journalId}
              onChange={(e) => setJournalId(e.target.value)}
            >
              <option value="">—</option>
              {meta.data?.journals.map((j) => (
                <option key={j.id} value={j.id}>{j.code} · {j.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">{t("gl.field.period")}</label>
            <select
              className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-900"
              value={periodId}
              onChange={(e) => setPeriodId(e.target.value)}
            >
              <option value="">—</option>
              {meta.data?.periods.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">{t("gl.field.date")}</label>
            <Input type="date" value={entryDate} onChange={(e) => setEntryDate(e.target.value)} />
          </div>
        </div>
        <div className="mt-4">
          <label className="mb-1 block text-sm font-medium">{t("gl.field.description")}</label>
          <Input value={description} onChange={(e) => setDescription(e.target.value)} />
        </div>

        <div className="mt-5 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="py-2 pr-2">{t("gl.field.account")}</th>
                <th className="py-2 px-2 text-right">{t("gl.field.debit")}</th>
                <th className="py-2 px-2 text-right">{t("gl.field.credit")}</th>
                <th className="py-2 pl-2">{t("gl.field.description")}</th>
              </tr>
            </thead>
            <tbody>
              {lines.map((l, i) => (
                <tr key={i}>
                  <td className="py-1 pr-2">
                    <select
                      className="h-9 w-full rounded-md border border-slate-300 bg-white px-2 text-sm dark:border-slate-700 dark:bg-slate-900"
                      value={l.accountId}
                      onChange={(e) => setLine(i, { accountId: e.target.value })}
                    >
                      <option value="">—</option>
                      {accounts.data?.filter((a) => a.isPostable).map((a) => (
                        <option key={a.id} value={a.id}>{a.code} — {a.name}</option>
                      ))}
                    </select>
                  </td>
                  <td className="py-1 px-2">
                    <Input
                      className="h-9 text-right"
                      type="number"
                      value={l.debit}
                      onChange={(e) => setLine(i, { debit: e.target.value, credit: "" })}
                    />
                  </td>
                  <td className="py-1 px-2">
                    <Input
                      className="h-9 text-right"
                      type="number"
                      value={l.credit}
                      onChange={(e) => setLine(i, { credit: e.target.value, debit: "" })}
                    />
                  </td>
                  <td className="py-1 pl-2">
                    <Input
                      className="h-9"
                      value={l.description}
                      onChange={(e) => setLine(i, { description: e.target.value })}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t border-slate-200 font-medium dark:border-slate-700">
                <td className="py-2 text-right pr-2">{t("gl.tb.total")}</td>
                <td className="py-2 px-2 text-right">{formatMoney(totals.debit)}</td>
                <td className="py-2 px-2 text-right">{formatMoney(totals.credit)}</td>
                <td className="py-2 pl-2">
                  <Badge color={totals.balanced ? "green" : "red"}>
                    {totals.balanced ? t("gl.balanced") : t("gl.notBalanced")}
                  </Badge>
                </td>
              </tr>
            </tfoot>
          </table>
        </div>

        {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

        <div className="mt-4 flex items-center gap-3">
          <Button variant="outline" size="sm" onClick={() => setLines((ls) => [...ls, emptyLine()])}>
            + {t("gl.addLine")}
          </Button>
          <div className="flex-1" />
          <Button disabled={!canPost} onClick={() => post.mutate()}>
            {t("gl.post")}
          </Button>
        </div>
      </Card>

      <div>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
          {t("gl.journal.recent")}
        </h2>
        <div className="space-y-3">
          {entries.data?.map((e) => (
            <Card key={e.id} className="p-4">
              <div className="mb-2 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-sm font-semibold">{e.entryNo}</span>
                  <Badge color="slate">{e.journal}</Badge>
                  <span className="text-xs text-slate-500">{e.period}</span>
                </div>
                <span className="text-xs text-slate-500">
                  {new Date(e.entryDate).toLocaleDateString()}
                </span>
              </div>
              {e.description && <p className="mb-2 text-sm text-slate-600 dark:text-slate-300">{e.description}</p>}
              <table className="w-full text-xs">
                <tbody>
                  {e.lines.map((l, i) => (
                    <tr key={i}>
                      <td className="py-0.5">{l.account}</td>
                      <td className="py-0.5 text-right">{Number(l.debit) ? formatMoney(l.debit, e.currency) : ""}</td>
                      <td className="py-0.5 text-right">{Number(l.credit) ? formatMoney(l.credit, e.currency) : ""}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}

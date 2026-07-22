"use client";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button, Card, Badge } from "@/components/ui";
import { useT } from "@/lib/useT";
import { usePerms, getJson } from "@/lib/usePerms";
import { formatMoney } from "@/lib/money";

type Tab = "income" | "balance" | "ar" | "ap";

function downloadCsv(filename: string, rows: (string | number)[][]) {
  const csv = rows
    .map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(","))
    .join("\r\n");
  const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export default function ReportsPage() {
  const t = useT();
  const { can } = usePerms();
  const [tab, setTab] = useState<Tab>("income");

  const tabs: { key: Tab; label: string }[] = [
    { key: "income", label: t("rep.income") },
    { key: "balance", label: t("rep.balance") },
    { key: "ar", label: t("rep.arAging") },
    { key: "ap", label: t("rep.apAging") },
  ];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">{t("rep.title")}</h1>
      <div className="flex flex-wrap gap-2">
        {tabs.map((tb) => (
          <button
            key={tb.key}
            onClick={() => setTab(tb.key)}
            className={
              "rounded-md px-3 py-1.5 text-sm font-medium " +
              (tab === tb.key
                ? "bg-brand text-white"
                : "border border-slate-300 hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800")
            }
          >
            {tb.label}
          </button>
        ))}
      </div>

      {tab === "income" && <IncomeStatement />}
      {tab === "balance" && <BalanceSheet />}
      {tab === "ar" && <Aging kind="ar" />}
      {tab === "ap" && <Aging kind="ap" />}
    </div>
  );
}

function Section({ title, children, onExport }: { title: string; children: React.ReactNode; onExport?: () => void }) {
  const t = useT();
  const { can } = usePerms();
  return (
    <Card className="p-5">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-lg font-semibold">{title}</h2>
        {onExport && can("report:export") && <Button size="sm" variant="outline" onClick={onExport}>{t("rep.export")}</Button>}
      </div>
      {children}
    </Card>
  );
}

const Row = ({ label, value, bold }: { label: string; value: number; bold?: boolean }) => (
  <div className={"flex justify-between py-1 " + (bold ? "border-t border-slate-200 font-semibold dark:border-slate-700" : "")}>
    <span>{label}</span>
    <span>{formatMoney(value)}</span>
  </div>
);

function IncomeStatement() {
  const t = useT();
  const q = useQuery({
    queryKey: ["rep-income"],
    queryFn: () => getJson<any>("/api/reports/income-statement"),
  });
  const d = q.data;
  return (
    <Section
      title={t("rep.income")}
      onExport={d ? () => downloadCsv("income-statement.csv", [
        ["Type", "Code", "Account", "Amount"],
        ...d.revenue.map((r: any) => ["Revenue", r.code, r.name, r.balance]),
        ...d.expense.map((r: any) => ["Expense", r.code, r.name, r.balance]),
        ["", "", "Net result", d.netResult],
      ]) : undefined}
    >
      {!d ? <p className="text-slate-400">{t("common.loading")}</p> : (
        <div className="max-w-xl space-y-4 text-sm">
          <div>
            <div className="mb-1 text-xs font-semibold uppercase text-slate-500">{t("rep.revenue")}</div>
            {d.revenue.map((r: any) => <Row key={r.code} label={`${r.code} ${r.name}`} value={r.balance} />)}
            <Row label={t("rep.revenue")} value={d.revenueTotal} bold />
          </div>
          <div>
            <div className="mb-1 text-xs font-semibold uppercase text-slate-500">{t("rep.expenses")}</div>
            {d.expense.map((r: any) => <Row key={r.code} label={`${r.code} ${r.name}`} value={r.balance} />)}
            <Row label={t("rep.expenses")} value={d.expenseTotal} bold />
          </div>
          <div className="rounded-md bg-slate-50 p-3 dark:bg-slate-800/50">
            <Row label={t("rep.netResult")} value={d.netResult} bold />
          </div>
        </div>
      )}
    </Section>
  );
}

function BalanceSheet() {
  const t = useT();
  const q = useQuery({
    queryKey: ["rep-balance"],
    queryFn: () => getJson<any>("/api/reports/balance-sheet"),
  });
  const d = q.data;
  return (
    <Section
      title={t("rep.balance")}
      onExport={d ? () => downloadCsv("balance-sheet.csv", [
        ["Section", "Code", "Account", "Amount"],
        ...d.assets.map((r: any) => ["Asset", r.code, r.name, r.balance]),
        ...d.liabilities.map((r: any) => ["Liability", r.code, r.name, r.balance]),
        ...d.equity.map((r: any) => ["Equity", r.code, r.name, r.balance]),
        ["", "", "Result for the period", d.netResult],
        ["", "", "Total assets", d.assetTotal],
        ["", "", "Total liabilities + equity", d.liabilitiesPlusEquity],
      ]) : undefined}
    >
      {!d ? <p className="text-slate-400">{t("common.loading")}</p> : (
        <div className="grid grid-cols-1 gap-6 text-sm md:grid-cols-2">
          <div>
            <div className="mb-1 text-xs font-semibold uppercase text-slate-500">{t("rep.assets")}</div>
            {d.assets.map((r: any) => <Row key={r.code} label={`${r.code} ${r.name}`} value={r.balance} />)}
            <Row label={t("rep.totalAssets")} value={d.assetTotal} bold />
          </div>
          <div className="space-y-4">
            <div>
              <div className="mb-1 text-xs font-semibold uppercase text-slate-500">{t("rep.liabilities")}</div>
              {d.liabilities.map((r: any) => <Row key={r.code} label={`${r.code} ${r.name}`} value={r.balance} />)}
              <Row label={t("rep.liabilities")} value={d.liabilityTotal} bold />
            </div>
            <div>
              <div className="mb-1 text-xs font-semibold uppercase text-slate-500">{t("rep.equity")}</div>
              {d.equity.map((r: any) => <Row key={r.code} label={`${r.code} ${r.name}`} value={r.balance} />)}
              <Row label={t("rep.resultPeriod")} value={d.netResult} />
              <Row label={t("rep.equity")} value={d.equityTotal} bold />
            </div>
            <div className="rounded-md bg-slate-50 p-3 dark:bg-slate-800/50">
              <Row label={t("rep.totalLE")} value={d.liabilitiesPlusEquity} bold />
              <div className="mt-1"><Badge color={d.balanced ? "green" : "red"}>{d.balanced ? t("rep.balanced") : "OUT OF BALANCE"}</Badge></div>
            </div>
          </div>
        </div>
      )}
    </Section>
  );
}

function Aging({ kind }: { kind: "ar" | "ap" }) {
  const t = useT();
  const q = useQuery({
    queryKey: ["rep-aging", kind],
    queryFn: async () =>
      getJson<any>(`/api/reports/${kind === "ar" ? "aged-receivables" : "aged-payables"}`),
  });
  const d = q.data;
  const nameCol = kind === "ar" ? t("inv.client") : t("bill.supplier");
  const bucketLabel = (b: string) =>
    b === "current" ? t("rep.current") : b === "d30" ? t("rep.d30") : b === "d60" ? t("rep.d60") : t("rep.d90");
  return (
    <Section
      title={kind === "ar" ? t("rep.arAging") : t("rep.apAging")}
      onExport={d ? () => downloadCsv(`${kind}-aging.csv`, [
        ["Ref", nameCol, "Due", "Bucket", "Outstanding"],
        ...d.rows.map((r: any) => [r.number, r.client ?? r.supplier, new Date(r.dueDate).toISOString().slice(0, 10), r.bucket, r.outstanding]),
      ]) : undefined}
    >
      {!d ? <p className="text-slate-400">{t("common.loading")}</p> : (
        <>
          <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-5">
            {(["current", "d30", "d60", "d90plus", "total"] as const).map((k) => (
              <div key={k} className="rounded-md border border-slate-200 p-3 dark:border-slate-700">
                <div className="text-xs text-slate-500">{k === "total" ? t("rep.total") : bucketLabel(k)}</div>
                <div className="font-semibold">{formatMoney(d.totals[k])}</div>
              </div>
            ))}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-2 py-2">Ref</th>
                  <th className="px-2 py-2">{nameCol}</th>
                  <th className="px-2 py-2">Due</th>
                  <th className="px-2 py-2 text-right">Outstanding</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {d.rows.length === 0 && <tr><td colSpan={4} className="px-2 py-6 text-center text-slate-400">—</td></tr>}
                {d.rows.map((r: any, i: number) => (
                  <tr key={i}>
                    <td className="px-2 py-1.5 font-mono">{r.number}</td>
                    <td className="px-2 py-1.5">{r.client ?? r.supplier}</td>
                    <td className="px-2 py-1.5 text-slate-500">{new Date(r.dueDate).toLocaleDateString()}</td>
                    <td className="px-2 py-1.5 text-right">{formatMoney(r.outstanding)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </Section>
  );
}

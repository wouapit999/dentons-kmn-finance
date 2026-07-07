"use client";
import { useQuery } from "@tanstack/react-query";
import { Card, Badge } from "@/components/ui";
import { useT } from "@/lib/useT";
import { formatMoney } from "@/lib/money";

interface TB {
  rows: { code: string; name: string; type: string; debit: number; credit: number }[];
  totalDebit: number;
  totalCredit: number;
  balanced: boolean;
}

export default function TrialBalancePage() {
  const t = useT();
  const tb = useQuery({
    queryKey: ["trial-balance"],
    queryFn: async () => {
      const res = await fetch("/api/gl/trial-balance");
      if (!res.ok) throw new Error();
      return (await res.json()) as TB;
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">{t("gl.tb.title")}</h1>
        {tb.data && (
          <Badge color={tb.data.balanced ? "green" : "red"}>
            {tb.data.balanced ? t("gl.tb.balanced") : t("gl.tb.unbalanced")}
          </Badge>
        )}
      </div>

      <Card className="overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500 dark:bg-slate-800/50">
            <tr>
              <th className="px-4 py-3">{t("gl.code")}</th>
              <th className="px-4 py-3">{t("gl.name")}</th>
              <th className="px-4 py-3 text-right">{t("gl.field.debit")}</th>
              <th className="px-4 py-3 text-right">{t("gl.field.credit")}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {tb.isLoading && (
              <tr><td colSpan={4} className="px-4 py-6 text-center text-slate-400">{t("common.loading")}</td></tr>
            )}
            {tb.data?.rows.length === 0 && (
              <tr><td colSpan={4} className="px-4 py-6 text-center text-slate-400">No posted entries yet.</td></tr>
            )}
            {tb.data?.rows.map((r) => (
              <tr key={r.code}>
                <td className="px-4 py-2 font-mono">{r.code}</td>
                <td className="px-4 py-2">{r.name}</td>
                <td className="px-4 py-2 text-right">{r.debit ? formatMoney(r.debit) : ""}</td>
                <td className="px-4 py-2 text-right">{r.credit ? formatMoney(r.credit) : ""}</td>
              </tr>
            ))}
          </tbody>
          {tb.data && (
            <tfoot>
              <tr className="border-t-2 border-slate-300 font-semibold dark:border-slate-600">
                <td className="px-4 py-3" colSpan={2}>{t("gl.tb.total")}</td>
                <td className="px-4 py-3 text-right">{formatMoney(tb.data.totalDebit)}</td>
                <td className="px-4 py-3 text-right">{formatMoney(tb.data.totalCredit)}</td>
              </tr>
            </tfoot>
          )}
        </table>
      </Card>
    </div>
  );
}

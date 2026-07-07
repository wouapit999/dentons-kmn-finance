"use client";
import { useQuery } from "@tanstack/react-query";
import { Card, Badge } from "@/components/ui";
import { useT } from "@/lib/useT";

interface AuditRow {
  id: string;
  createdAt: string;
  actor: string;
  action: string;
  entityType: string;
  entityId: string | null;
}

export default function AuditPage() {
  const t = useT();
  const logs = useQuery({
    queryKey: ["audit"],
    queryFn: async () => {
      const res = await fetch("/api/audit");
      if (!res.ok) throw new Error();
      return (await res.json()) as AuditRow[];
    },
  });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">{t("audit.title")}</h1>
      <Card className="overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500 dark:bg-slate-800/50">
            <tr>
              <th className="px-4 py-3">{t("audit.when")}</th>
              <th className="px-4 py-3">{t("audit.actor")}</th>
              <th className="px-4 py-3">{t("audit.action")}</th>
              <th className="px-4 py-3">{t("audit.entity")}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {logs.isLoading && (
              <tr><td colSpan={4} className="px-4 py-6 text-center text-slate-400">{t("common.loading")}</td></tr>
            )}
            {logs.data?.map((l) => (
              <tr key={l.id}>
                <td className="px-4 py-3 text-slate-500">
                  {new Date(l.createdAt).toLocaleString()}
                </td>
                <td className="px-4 py-3">{l.actor}</td>
                <td className="px-4 py-3">
                  <Badge color="slate">{l.action}</Badge>
                </td>
                <td className="px-4 py-3 text-slate-500">
                  {l.entityType}
                  {l.entityId ? ` · ${l.entityId.slice(0, 8)}` : ""}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}

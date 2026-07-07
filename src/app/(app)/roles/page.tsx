"use client";
import { useQuery } from "@tanstack/react-query";
import { Card, Badge } from "@/components/ui";
import { useT } from "@/lib/useT";

interface RoleRow {
  id: string;
  key: string;
  name: string;
  hierarchyLevel: number;
  isSystem: boolean;
  userCount: number;
  permissions: string[];
}

export default function RolesPage() {
  const t = useT();
  const roles = useQuery({
    queryKey: ["roles"],
    queryFn: async () => {
      const res = await fetch("/api/roles");
      if (!res.ok) throw new Error();
      return (await res.json()) as RoleRow[];
    },
  });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">{t("roles.title")}</h1>
      {roles.isLoading && <p className="text-slate-400">{t("common.loading")}</p>}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {roles.data?.map((r) => (
          <Card key={r.id} className="p-5">
            <div className="mb-2 flex items-center justify-between">
              <div>
                <h3 className="font-semibold">{r.name}</h3>
                <code className="text-xs text-slate-400">{r.key}</code>
              </div>
              <div className="flex items-center gap-2">
                {r.isSystem && <Badge color="slate">system</Badge>}
                <Badge color="brand">{r.userCount} users</Badge>
              </div>
            </div>
            <div className="mb-2 text-xs text-slate-500">
              {t("roles.permissions")} ({r.permissions.length})
            </div>
            <div className="flex flex-wrap gap-1">
              {r.permissions.map((p) => (
                <span
                  key={p}
                  className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[11px] text-slate-600 dark:bg-slate-800 dark:text-slate-300"
                >
                  {p}
                </span>
              ))}
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

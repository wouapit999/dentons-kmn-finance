import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Card, Badge } from "@/components/ui";
import { t } from "@/lib/i18n";
import type { Locale } from "@/lib/constants";

export const dynamic = "force-dynamic";

const PLANNED_MODULES = [
  "General Ledger",
  "Client & Matter Management",
  "Billing & Accounts Receivable",
  "Trust Accounting",
  "Accounts Payable",
  "Cash & Banking",
  "Procurement",
  "Fixed Assets",
  "Budgeting",
  "Payroll & Cameroon Tax",
  "Reporting & Dashboards",
];

export default async function DashboardPage() {
  const user = await getCurrentUser();
  const locale = (user?.locale ?? "en") as Locale;
  const companyId = user!.companyId;

  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const [activeUsers, roles, logins24h, auditCount] = await Promise.all([
    prisma.user.count({ where: { companyId, status: "ACTIVE", deletedAt: null } }),
    prisma.role.count({ where: { companyId } }),
    prisma.loginAttempt.count({ where: { success: true, createdAt: { gte: since } } }),
    prisma.auditLog.count({ where: { companyId } }),
  ]);

  const kpis = [
    { label: t(locale, "dashboard.kpi.users"), value: activeUsers },
    { label: t(locale, "dashboard.kpi.roles"), value: roles },
    { label: t(locale, "dashboard.kpi.logins"), value: logins24h },
    { label: t(locale, "dashboard.kpi.audit"), value: auditCount },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">{t(locale, "dashboard.title")}</h1>
        <p className="text-sm text-slate-500">
          {t(locale, "dashboard.welcome")}, {user?.fullName}.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {kpis.map((k) => (
          <Card key={k.label} className="p-5">
            <div className="text-3xl font-semibold">{k.value}</div>
            <div className="mt-1 text-sm text-slate-500">{k.label}</div>
          </Card>
        ))}
      </div>

      <Card className="p-5">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
          {t(locale, "dashboard.modules")}
        </h2>
        <div className="flex flex-wrap gap-2">
          {PLANNED_MODULES.map((m) => (
            <Badge key={m} color="slate">
              {m} · {t(locale, "dashboard.comingSoon")}
            </Badge>
          ))}
        </div>
        <p className="mt-4 text-xs text-slate-400">
          Auth / RBAC / Users is live. Remaining modules follow the roadmap in
          docs/04-roadmap.md.
        </p>
      </Card>
    </div>
  );
}

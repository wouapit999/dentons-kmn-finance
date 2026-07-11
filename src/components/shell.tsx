"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import {
  LayoutDashboard,
  Users,
  ShieldCheck,
  ScrollText,
  BookOpen,
  PenLine,
  Scale,
  Briefcase,
  FolderKanban,
  Clock,
  Receipt,
  FileText,
  Landmark,
  Truck,
  FileMinus,
  UserSquare,
  Wallet,
  BarChart3,
  Building2,
  Target,
  Coins,
  Banknote,
  ShoppingCart,
  Sparkles,
  Bot,
  ListTodo,
  LogOut,
  Moon,
  Sun,
} from "lucide-react";
import { useT } from "@/lib/useT";
import { useUi } from "@/lib/store";
import { cn, Button } from "@/components/ui";
import { NotificationsBell } from "@/components/notifications-bell";
import type { MessageKey } from "@/lib/i18n";
import type { Locale } from "@/lib/constants";

interface ShellProps {
  children: React.ReactNode;
  user: { fullName: string; email: string; locale: Locale; permissions: string[] };
}

export function Shell({ children, user }: ShellProps) {
  const t = useT();
  const path = usePathname();
  const router = useRouter();
  const { theme, toggleTheme, setLocale, locale } = useUi();

  // Sync store locale with the server-persisted user locale on first load.
  useEffect(() => {
    setLocale(user.locale);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const nav: { href: string; label: MessageKey; icon: React.ReactNode; perm?: string }[] = [
    { href: "/dashboard", label: "nav.dashboard", icon: <LayoutDashboard size={18} /> },
    { href: "/tasks", label: "nav.tasks", icon: <ListTodo size={18} /> }, // all users
    { href: "/clients", label: "nav.clients", icon: <Briefcase size={18} />, perm: "client:read" },
    { href: "/matters", label: "nav.matters", icon: <FolderKanban size={18} />, perm: "matter:read" },
    { href: "/time", label: "nav.time", icon: <Clock size={18} />, perm: "time:read" },
    { href: "/disbursements", label: "nav.disbursements", icon: <Receipt size={18} />, perm: "disbursement:read" },
    { href: "/invoices", label: "nav.invoices", icon: <FileText size={18} />, perm: "invoice:read" },
    { href: "/trust", label: "nav.trust", icon: <Landmark size={18} />, perm: "trust:read" },
    { href: "/suppliers", label: "nav.suppliers", icon: <Truck size={18} />, perm: "ap:read" },
    { href: "/bills", label: "nav.bills", icon: <FileMinus size={18} />, perm: "ap:read" },
    { href: "/procurement", label: "nav.procurement", icon: <ShoppingCart size={18} />, perm: "procure:read" },
    { href: "/cash", label: "nav.cash", icon: <Coins size={18} />, perm: "cash:read" },
    { href: "/bank", label: "nav.bank", icon: <Banknote size={18} />, perm: "bank:read" },
    { href: "/employees", label: "nav.employees", icon: <UserSquare size={18} />, perm: "payroll:read" },
    { href: "/payroll", label: "nav.payroll", icon: <Wallet size={18} />, perm: "payroll:read" },
    { href: "/assets", label: "nav.assets", icon: <Building2 size={18} />, perm: "asset:read" },
    { href: "/gl/accounts", label: "nav.accounts", icon: <BookOpen size={18} />, perm: "gl:read" },
    { href: "/gl/journal", label: "nav.journal", icon: <PenLine size={18} />, perm: "gl:read" },
    { href: "/gl/trial-balance", label: "nav.trialBalance", icon: <Scale size={18} />, perm: "gl:read" },
    { href: "/budgets", label: "nav.budgets", icon: <Target size={18} />, perm: "budget:read" },
    { href: "/reports", label: "nav.reports", icon: <BarChart3 size={18} />, perm: "report:read" },
    { href: "/insights", label: "nav.insights", icon: <Sparkles size={18} />, perm: "report:read" },
    { href: "/assistant", label: "nav.assistant", icon: <Bot size={18} />, perm: "report:read" },
    { href: "/users", label: "nav.users", icon: <Users size={18} />, perm: "user:read" },
    { href: "/roles", label: "nav.roles", icon: <ShieldCheck size={18} />, perm: "role:read" },
    { href: "/audit", label: "nav.audit", icon: <ScrollText size={18} />, perm: "audit:read" },
  ];

  async function changeLanguage(l: Locale) {
    setLocale(l);
    await fetch("/api/me/language", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ locale: l }),
    });
  }

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  return (
    <div className="flex min-h-screen">
      <aside className="flex w-60 flex-col border-r border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-center gap-2 px-5 py-4">
          <div className="flex h-9 w-9 items-center justify-center rounded-md bg-brand text-sm font-bold text-white">
            KMN
          </div>
          <div className="text-sm font-semibold leading-tight">Dentons KMN<br /><span className="text-xs font-normal text-slate-500">Finance</span></div>
        </div>
        <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-2">
          {nav
            .filter((n) => !n.perm || user.permissions.includes(n.perm))
            .map((n) => (
              <Link
                key={n.href}
                href={n.href}
                className={cn(
                  "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                  path === n.href
                    ? "bg-brand-50 text-brand-700 dark:bg-brand-900/40 dark:text-brand-100"
                    : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800",
                )}
              >
                {n.icon}
                {t(n.label)}
              </Link>
            ))}
        </nav>
        <div className="border-t border-slate-200 p-3 dark:border-slate-800">
          <div className="mb-2 px-2 text-xs">
            <div className="font-medium">{user.fullName}</div>
            <div className="truncate text-slate-500">{user.email}</div>
          </div>
          <Button variant="ghost" size="sm" className="w-full justify-start" onClick={logout}>
            <LogOut size={16} /> {t("nav.logout")}
          </Button>
        </div>
      </aside>

      <div className="flex flex-1 flex-col">
        <header className="flex h-14 items-center justify-end gap-3 border-b border-slate-200 bg-white px-6 dark:border-slate-800 dark:bg-slate-900">
          <NotificationsBell />
          <div className="flex items-center gap-1 text-xs">
            <button
              onClick={() => changeLanguage("en")}
              className={cn("rounded px-2 py-1", locale === "en" && "font-semibold text-brand")}
            >
              EN
            </button>
            <button
              onClick={() => changeLanguage("fr")}
              className={cn("rounded px-2 py-1", locale === "fr" && "font-semibold text-brand")}
            >
              FR
            </button>
          </div>
          <Button variant="ghost" size="sm" onClick={toggleTheme} aria-label="Toggle theme">
            {theme === "light" ? <Moon size={16} /> : <Sun size={16} />}
          </Button>
        </header>
        <main className="flex-1 overflow-auto p-6">{children}</main>
      </div>
    </div>
  );
}

"use client";
/*
 * Dentons KMN ERP
 * Copyright (c) 2026 Bouquet Innovation SA. All rights reserved.
 * Proprietary and confidential. Unauthorised copying, distribution, modification,
 * or use of this file, via any medium, is strictly prohibited.
 */
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
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
  ShieldAlert,
  KeyRound,
  LogOut,
  Moon,
  Sun,
  Menu,
  X,
  DatabaseBackup,
  FileSearch,
  FileStack,
  Plug,
} from "lucide-react";
import { useT } from "@/lib/useT";
import { useUi } from "@/lib/store";
import { cn, Button } from "@/components/ui";
import { NotificationsBell } from "@/components/notifications-bell";
import { Pinto } from "@/components/pinto";
import { Logo } from "@/components/logo";
import { NewsTicker } from "@/components/news-ticker";
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
  const [mobileNav, setMobileNav] = useState(false);

  // Sync store locale with the server-persisted user locale on first load.
  useEffect(() => {
    setLocale(user.locale);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Close the mobile drawer whenever the route changes.
  useEffect(() => {
    setMobileNav(false);
  }, [path]);

  const nav: { href: string; label: MessageKey; icon: React.ReactNode; perm?: string }[] = [
    { href: "/dashboard", label: "nav.dashboard", icon: <LayoutDashboard size={18} /> },
    { href: "/tasks", label: "nav.tasks", icon: <ListTodo size={18} /> }, // all users
    { href: "/clients", label: "nav.clients", icon: <Briefcase size={18} />, perm: "client:read" },
    { href: "/matters", label: "nav.matters", icon: <FolderKanban size={18} />, perm: "matter:read" },
    { href: "/documents", label: "nav.documents", icon: <FileSearch size={18} />, perm: "client:read" },
    { href: "/templates", label: "nav.templates", icon: <FileStack size={18} />, perm: "client:read" },
    { href: "/time", label: "nav.time", icon: <Clock size={18} />, perm: "time:read" },
    { href: "/disbursements", label: "nav.disbursements", icon: <Receipt size={18} />, perm: "disbursement:read" },
    { href: "/proformas", label: "nav.proformas", icon: <FileText size={18} />, perm: "proforma:read" },
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
    { href: "/analytics", label: "nav.analytics", icon: <BarChart3 size={18} />, perm: "analytics:read" },
    { href: "/entities", label: "nav.entities", icon: <Building2 size={18} />, perm: "proforma:read" },
    { href: "/reports", label: "nav.reports", icon: <BarChart3 size={18} />, perm: "report:read" },
    { href: "/insights", label: "nav.insights", icon: <Sparkles size={18} />, perm: "report:read" },
    { href: "/assistant", label: "nav.assistant", icon: <Bot size={18} />, perm: "report:read" },
    { href: "/users", label: "nav.users", icon: <Users size={18} />, perm: "user:read" },
    { href: "/admin/security", label: "nav.pwadmin", icon: <KeyRound size={18} />, perm: "security:admin" },
    { href: "/admin/ai", label: "nav.aiSettings", icon: <Sparkles size={18} />, perm: "user:manage" },
    { href: "/admin/integrations", label: "nav.integrations", icon: <Plug size={18} />, perm: "user:manage" },
    { href: "/admin/reset", label: "nav.reset", icon: <DatabaseBackup size={18} />, perm: "system:reset" },
    { href: "/roles", label: "nav.roles", icon: <ShieldCheck size={18} />, perm: "role:read" },
    { href: "/audit", label: "nav.audit", icon: <ScrollText size={18} />, perm: "audit:read" },
    { href: "/security", label: "nav.security", icon: <ShieldAlert size={18} /> }, // all users
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
      {/* Backdrop for the mobile drawer */}
      {mobileNav && (
        <div
          className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm lg:hidden"
          onClick={() => setMobileNav(false)}
          aria-hidden="true"
        />
      )}
      <aside
        className={cn(
          "glass fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r border-slate-200/70 transition-transform duration-200 dark:border-slate-800/70",
          "lg:static lg:z-auto lg:w-60 lg:translate-x-0",
          mobileNav ? "translate-x-0" : "-translate-x-full",
        )}
      >
        {/* Close button (mobile only) */}
        <button
          onClick={() => setMobileNav(false)}
          className="absolute right-3 top-3 rounded-md p-1.5 text-slate-500 hover:bg-slate-100 lg:hidden dark:hover:bg-slate-800"
          aria-label="Close menu"
        >
          <X size={18} />
        </button>
        <div className="relative overflow-hidden px-5 py-4">
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-brand-500/10 via-transparent to-cmr-green/10" />
          <div className="relative">
            <Logo className="h-7 w-auto" />
            <div className="mt-1.5 flex items-center gap-1.5 text-[11px] font-normal text-slate-500">
              ERP by Bouquet Innovation SA
            </div>
          </div>
        </div>
        <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-2">
          {nav
            .filter((n) => !n.perm || user.permissions.includes(n.perm))
            .map((n) => (
              <Link
                key={n.href}
                href={n.href}
                className={cn(
                  "nav-item flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium",
                  path === n.href
                    ? "nav-active bg-brand-50 text-brand-700 shadow-sm dark:bg-brand-900/40 dark:text-brand-100"
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

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="glass sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-slate-200/70 px-4 sm:px-6 dark:border-slate-800/70">
          <button
            onClick={() => setMobileNav(true)}
            className="rounded-md p-1.5 text-slate-600 hover:bg-slate-100 lg:hidden dark:text-slate-300 dark:hover:bg-slate-800"
            aria-label="Open menu"
          >
            <Menu size={20} />
          </button>
          <div className="ml-auto flex items-center gap-3">
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
          </div>
        </header>
        <NewsTicker />
        <main className="flex-1 overflow-auto p-4 sm:p-6">{children}</main>
      </div>
      <Pinto />
    </div>
  );
}

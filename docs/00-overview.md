# Dentons KMN ERP — Overview

> **Status:** **Built and deployed.** All 16 core modules plus the post-launch additions
> (Tasks, Client Intake & KYC, Security/Password Management, Pinto AI assistant) are live
> in production at `dentons-kmn-finance-three.vercel.app`.
> **This document set:** describes the system as designed **and as built**. Where the build
> deliberately simplified the original design, the deviation is stated explicitly —
> see [`01-architecture.md`](01-architecture.md) §8 for the full design-vs-built table.

---

## 1. What this system is

A production-grade **ERP / Financial Management system** purpose-built for **Dentons KMN**,
a law firm operating in Cameroon, with an architecture that scales to multi-office /
multi-country. Branded in-app as **"ERP by Bouquet Innovation SA"**. It combines:

- A **general accounting core** (double-entry GL, SYSCOHADA/OHADA chart of accounts, IFRS-reportable, period-scoped posting).
- **Law-firm-specific finance** (clients & matters, time & billing, **trust/client money accounting**, disbursements).
- **Operational finance** (AR, AP, cash, banking, procurement, fixed assets, budgeting).
- **Cameroon payroll & taxation** (IRPP/PAYE, CNPS, CAC, CRTV/RAV, Crédit Foncier, FNE) computed from one configurable rules file.
- Cross-cutting **RBAC, audit, i18n (EN/FR), reporting, notifications, tasks**.
- **AI features** (Anthropic Claude): invoice OCR, natural-language financial reporting, KYC internet screening, and **Pinto** — the in-app assistant that teaches the app, answers Cameroon/CEMAC/OHADA legal questions with web-search-verified citations, generates downloadable PDF/DOCX documents, and performs co-working actions (create/delegate/comment on tasks, file documents to client records) under the user's own permissions.

## 2. Guiding principles (all enforced in the shipped code)

| Principle | What it means here |
|---|---|
| **Correctness over features** | Money math is exact and server-computed; every posting is balanced (debits = credits) or rejected. |
| **Immutability of the record** | Posted journal entries are immutable; corrections are new entries, not edits. |
| **Everything is auditable** | `writeAudit()` records actor / action / before / after on every material change; append-only. |
| **Segregation of duties** | Server rejects self-approval (e.g. procurement); role split between create/approve/post permissions. |
| **Trust money is sacred** | Per-client trust ledger, mirrored by dedicated GL accounts; a client's trust balance can never go negative. |
| **Bilingual by construction** | Every user-facing string goes through the EN/FR catalog (`src/lib/i18n.ts`); switching language never logs you out. |
| **Multi-tenant ready** | `companyId` scoping on every business row and every query, even though the firm launches single-company. |

## 3. Scope of this document set

| File | Contents | State |
|---|---|---|
| [`00-overview.md`](00-overview.md) | This file. | As built |
| [`01-architecture.md`](01-architecture.md) | The shipped architecture, stack, request lifecycle, and the design-vs-built deviation table. | As built |
| [`02-data-model.md`](02-data-model.md) | Database conventions, core ERD, money model. | Design doc + as-built banner |
| [`03-security.md`](03-security.md) | AuthN/AuthZ, RBAC, 2FA, audit, approval integrity. | Design doc + as-built banner |
| [`04-roadmap.md`](04-roadmap.md) | Module inventory with delivery status, and what came after launch. | As built |
| [`modules/auth-rbac-users.md`](modules/auth-rbac-users.md) | Detailed design of the Auth / RBAC / Users module. | Design doc + as-built banner |
| [`modules/tasks.md`](modules/tasks.md) | Tasks module blueprint (matches the shipped module). | As built |
| [`DEPLOY-VERCEL.md`](DEPLOY-VERCEL.md) | Step-by-step production deployment guide. | As built |

## 4. Delivery reality — how it was actually built

The system was delivered **incrementally as vertical slices**, exactly as planned: each
module shipped with its schema, API routes, Zod validation, RBAC guards, EN/FR strings,
audit trail, and end-to-end verification before the next began. What changed from the original
plan is the **packaging**: instead of a pnpm/Turborepo monorepo with a NestJS API and
separate services, the entire system ships as **one Next.js 14 App Router application**
with Prisma — dramatically simpler to run and deploy while preserving every domain rule.
The reasoning and full deviation list live in [`01-architecture.md`](01-architecture.md) §8.

## 5. Key domain decisions (locked at design, honored in the build)

1. **Chart of accounts** follows an **OHADA/SYSCOHADA-aware** structure (Cameroon is an OHADA member state) while remaining **IFRS-reportable** — 31 accounts seeded in `src/lib/coa.ts`.
2. **Trust accounting** is a separate ledger space from the firm's own books (trust bank `522000` / client-trust liability `462000`), with per-client sub-ledgers and the non-negative invariant.
3. **Currency:** base/functional currency is **XAF**; amounts are stored as decimals and rounded server-side. (Multi-currency revaluation remains a documented extension point — see §8 of the architecture doc.)
4. **Tenancy:** `companyId` on every business table, enforced in every Prisma query via the authenticated user's scope.
5. **VAT 19.25%** and withholding tax on invoices; Cameroon payroll bands and rates centralized in `src/lib/payroll.ts`.

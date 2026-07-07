# Dentons KMN Finance Management System — Overview

> **Status:** Architecture & Planning (no application code yet).
> **This deliverable:** the technical design, data model, security model, module inventory, and phased roadmap that the eventual build will follow.

---

## 1. What this system is

A production-grade **Financial Management / ERP system** purpose-built for **Dentons KMN**, a law firm operating in Cameroon, with an architecture that scales to multi-office / multi-country. It combines:

- A **general accounting core** (double-entry GL, IFRS-compliant, multi-currency, period close with immutability).
- **Law-firm-specific finance** (matters, time & billing, **trust/client money accounting**, disbursements, partner economics).
- **Operational finance** (AR, AP, cash, banking, procurement, fixed assets).
- **Cameroon payroll & taxation** (PAYE, CNPS, CRTV, council tax, VAT, WHT) with a pluggable rules engine for future jurisdictions.
- Cross-cutting **workflow, approvals, audit, security, i18n (EN/FR), reporting, notifications**.

## 2. Guiding principles

| Principle | What it means here |
|---|---|
| **Correctness over features** | Money math is exact (integer minor units / `NUMERIC`), never floats. Ledger is append-only. |
| **Immutability of the record** | Once an accounting period is closed, its journals cannot be altered — only reversed in an open period. |
| **Everything is auditable** | Who / when / old / new / IP / device on every material change; immutable audit log. |
| **Segregation of duties** | Maker ≠ checker. Approval workflows are first-class, configurable, and enforced server-side. |
| **Trust money is sacred** | Client trust funds are physically and logically segregated; a client's trust balance can never go negative. |
| **Bilingual by construction** | Every user-facing string is translatable (EN/FR); language switch requires no re-login. |
| **Multi-tenant ready** | Company/office scoping on every business row from day one, even though we launch single-firm. |

## 3. Scope of *this* document set

| File | Contents |
|---|---|
| [`00-overview.md`](00-overview.md) | This file. |
| [`01-architecture.md`](01-architecture.md) | System architecture, tech stack rationale, monorepo layout, DDD/CQRS/event patterns, cross-cutting services. |
| [`02-data-model.md`](02-data-model.md) | Database strategy, conventions, core ERD, money & multi-currency model, audit/soft-delete/versioning. |
| [`03-security.md`](03-security.md) | AuthN/AuthZ, RBAC model, 2FA, session/device policy, encryption, immutable audit, approval integrity. |
| [`04-roadmap.md`](04-roadmap.md) | Full module inventory, dependency ordering, the 12-phase plan, and definition-of-done per module. |
| [`modules/auth-rbac-users.md`](modules/auth-rbac-users.md) | Deep design of the **first** module to build: Auth / RBAC / Users. |

## 4. A note on delivery reality

This is a large system (rough order: several hundred thousand lines across ~15–20 domains). It is built **incrementally**: a compiling monorepo foundation, then one **vertical slice** at a time — each slice includes migrations, domain logic, API, validation (Zod), RBAC enforcement, approval hooks, EN/FR i18n, audit trail, and tests — and each slice compiles and passes CI **before** the next begins. The roadmap in [`04-roadmap.md`](04-roadmap.md) sequences these slices so nothing is ever blocked.

## 5. Key domain decisions locked in this phase

1. **Chart of accounts** follows an **OHADA/SYSCOHADA-aware** structure (Cameroon is an OHADA member state) while remaining **IFRS-reportable**. Both classifications are modelled.
2. **Trust accounting** is a separate ledger space from the firm's own books, reconciled to dedicated trust bank accounts, with per-client and per-matter sub-ledgers.
3. **Currency:** base/functional currency is **XAF (Central African CFA franc)**; the system is multi-currency with revaluation and realized/unrealized FX gain/loss.
4. **Money storage:** `NUMERIC(20,4)` in PostgreSQL for amounts + explicit `currency` column; presentation rounding per currency's minor units (XAF has 0 decimals).
5. **Tenancy:** `company_id` (and `office_id` where relevant) on every business table; enforced via row-level scoping in the application layer, with Postgres RLS as defense-in-depth.

# Module Inventory & Phased Roadmap

## 1. How to read this

The system is built as **vertical slices**. A slice is "done" only when it meets the **Definition of Done** (§4). Slices are sequenced so each depends only on already-built ones (§3). The 12 phases (§2) map to your original phase plan.

## 2. The 12 phases

| Phase | Name | Output |
|---|---|---|
| 1 | **Requirements** | This doc set + confirmed acceptance criteria per module. |
| 2 | **Architecture** | `01-architecture.md`, ADRs, chosen stack pinned, coding standards. |
| 3 | **Database** | Prisma schema for core + conventions, migrations, seed, RLS policies. |
| 4 | **Backend foundation** | NestJS skeleton, DI wiring of cross-cutting packages, OpenAPI/GraphQL base, health/observability. |
| 5 | **Frontend foundation** | Next.js shell, design system on shadcn/ui, i18n (EN/FR), role-aware layouts, auth screens. |
| 6 | **Authentication + RBAC + Users** | **First real module** — see `modules/auth-rbac-users.md`. |
| 7 | **Finance modules** | GL → AR → AP → Cash → Banking → Procurement → Fixed Assets → Trust → Matter Billing → Budgeting (ordered in §3). |
| 8 | **Payroll & Tax** | Cameroon payroll engine (PAYE/CNPS/CRTV/council), payroll journal, statutory reports. |
| 9 | **Reporting** | Report engine + financial statements + operational/law-firm reports; PDF/XLSX/CSV/DOCX; Power BI APIs. |
| 10 | **Testing** | Unit/integration/e2e/load/security across all modules; CI gates green. |
| 11 | **Deployment** | Docker (dev+prod), K8s manifests, CI/CD pipeline, backups/DR runbook. |
| 12 | **Documentation** | Technical/API/dev/deploy/admin/user guides; ERD, architecture, sequence, use-case diagrams. |

> Phases 3–5 are the **foundation**; they are built once and then every Phase-7/8 slice reuses them. Testing (10), deployment (11), and docs (12) are **continuous**, not left to the end — each slice ships with its tests, its migrations, and its docs. The phase numbering reflects emphasis, not a waterfall.

## 3. Module dependency ordering (build sequence)

```
Foundation:
  0. Monorepo + CI + Docker + DB conventions + cross-cutting packages
     (auth engine, workflow, audit, i18n, money, contracts, ui)
  1. AUTH / RBAC / USERS          ◀── first module (Phase 6)
  2. Company / Office / Reference data (currencies, periods, departments, practice areas)

Accounting core:
  3. General Ledger (COA, journals, periods, trial balance, statements)

Client & revenue:
  4. Client Management (KYC/AML, conflict checks, engagements)
  5. Matter & Time (matters, time entries, disbursements)
  6. Billing / Accounts Receivable (fee notes, invoices, receipts, collections)
  7. Trust Accounting (segregated ledger, trust bank recon)   ◀── depends on 3,4,5

Operational finance:
  8. Accounts Payable (suppliers, bills, payments)
  9. Cash Management (petty cash, floats, counts)
 10. Banking (accounts, reconciliation, cheques, transfers)
 11. Procurement (requests → PO → GRN → payment)
 12. Fixed Assets (register, depreciation, disposals)
 13. Budgeting (budgets, revisions, variance, control)

People:
 14. Payroll & Cameroon Tax

Insight:
 15. Reporting & Dashboards (reads across all sub-ledgers)
 16. AI features (OCR, duplicate detection, forecasting, NL reporting) — additive, last
```

Each of the 16 is a slice with its own migrations, API, UI, tests. The **approval engine, audit, i18n, RBAC, and money** packages are consumed by every one.

## 4. Definition of Done (per module)

A module slice ships only when **all** are true:

- [ ] **Migrations** written and reversible; **seed** data for dev/demo.
- [ ] **Domain logic** pure and unit-tested; invariants enforced (DB constraints + code).
- [ ] **API** (REST + GraphQL where relevant) documented in OpenAPI/GraphQL schema.
- [ ] **Validation** — Zod schemas at every boundary, shared client/server.
- [ ] **Authorization** — permissions defined, guards applied, row-scoping + limits enforced server-side.
- [ ] **Approval workflow** integrated for any money-moving or sensitive action.
- [ ] **Audit trail** — mutations produce before/after audit entries.
- [ ] **i18n** — no hard-coded strings; EN + FR catalogs complete.
- [ ] **UI** — role-aware, responsive, dark/light, accessible, keyboard-navigable.
- [ ] **Tests** — unit + integration + at least one e2e happy path + key negative paths.
- [ ] **CI green** — lint, typecheck, tests, build all pass; migration applies cleanly.
- [ ] **Docs** — module README + API notes + any ADRs for non-obvious decisions.

## 5. Full module inventory (traceability to your brief)

Every area from the master prompt is accounted for and mapped to a slice:

| Brief area | Slice(s) |
|---|---|
| Users, RBAC, permissions, 2FA, sessions, devices, login history | **1 Auth/RBAC/Users** |
| Org structure, currencies, periods, settings | 2 Reference data |
| GL, COA, journals, trial balance, financial statements, multi-currency, FX | 3 General Ledger |
| Clients, KYC, AML, conflict checks, engagements, documents | 4 Client Management |
| Matters, time entries, billable/non-billable hours, disbursements | 5 Matter & Time |
| Billing (all types), invoices, credit/debit notes, VAT, WHT, AR, collections, statements, aging | 6 Billing/AR |
| Trust/client accounts, retainers, escrow, trust reconciliation | 7 Trust Accounting |
| Suppliers, vendor bills, POs, GRN, vendor payments, expense claims, AP | 8 Accounts Payable |
| Cash office, petty cash, floats, counts, reconciliation | 9 Cash Management |
| Bank accounts, reconciliation, cheques, transfers, SWIFT, bank statements | 10 Banking |
| Purchase requests → PO → vendor selection → receiving | 11 Procurement |
| Asset register, depreciation, transfers, disposals, maintenance | 12 Fixed Assets |
| Department/annual budgets, forecasts, revisions, variance | 13 Budgeting |
| Payroll engine, allowances, loans, PAYE/CNPS/CRTV/council/VAT/WHT, payslips | 14 Payroll & Tax |
| Dashboards (exec/finance/partner/cash/AR/AP/tax/payroll/trust), all reports, exports, Power BI | 15 Reporting |
| Invoice/receipt OCR, duplicate detection, forecasting, fraud detection, NL reporting | 16 AI features |
| Document management, global search, notifications, audit, API, settings | cross-cutting (built in foundation, extended per slice) |

## 6. Immediate next steps (when you approve moving from plan → build)

1. Scaffold the monorepo (pnpm + Turborepo) with the layout in `01-architecture.md`.
2. Stand up Docker Compose (Postgres, Redis, RabbitMQ) for local dev.
3. Author the Prisma schema for **core + auth**, first migration, and seed.
4. Build cross-cutting packages (`auth`, `audit`, `i18n`, `money`, `workflow`, `contracts`) as thin but real.
5. Deliver **Module 1: Auth / RBAC / Users** end-to-end per its design doc — the proof of the whole pattern.

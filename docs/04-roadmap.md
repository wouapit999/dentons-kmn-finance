# Module Inventory & Delivery Status

## 1. How to read this

The system was built as **vertical slices** — each slice shipped with its schema, API,
Zod validation, RBAC guards, EN/FR strings, audit trail, and end-to-end verification
before the next began. This document is the delivery ledger: what was planned, what
shipped, and what came after launch.

## 2. Core module status — all 16 delivered ✅

| # | Module | Status | Verification highlights |
|---|---|---|---|
| 1 | Auth / RBAC / Users | ✅ Live | 13 system roles; permission guards on every route; lockout; audited admin actions |
| 2 | General Ledger | ✅ Live | SYSCOHADA COA; balanced-or-rejected posting; immutable posted entries; trial balance ties |
| 3 | Client & Matter Management | ✅ Live | KYC/conflict compliance gate blocks matter opening (422) |
| 4 | Reference data | ✅ Live | Company, periods, practice areas, journals seeded idempotently |
| 5 | Time & Disbursements | ✅ Live | Server-computed value; closed-matter guard |
| 6 | Billing / AR | ✅ Live | VAT 19.25% + WHT; balanced AR posting; part-paid→paid; overpayment blocked |
| 7 | Trust Accounting | ✅ Live | Non-negative invariant; apply-to-invoice settles via one balanced entry |
| 8 | Accounts Payable | ✅ Live | Input VAT; bill→pay lifecycle; role split enforced |
| 9 | Cash Management | ✅ Live | Petty cash with non-negative guard |
| 10 | Banking | ✅ Live | Transactions + reconciliation (book vs cleared) |
| 11 | Procurement | ✅ Live | Request→approve→PO with maker≠checker (self-approval 422) |
| 12 | Fixed Assets | ✅ Live | Straight-line depreciation; disposal gain/loss posting |
| 13 | Budgeting | ✅ Live | Budget-vs-actual variance from POSTED lines |
| 14 | Payroll & Cameroon Tax | ✅ Live | CNPS/IRPP/CAC/CRTV/CFC/FNE verified by hand; balanced payroll journal |
| 15 | Reporting & Financial Statements | ✅ Live | IS, BS, aged AR/AP from POSTED lines; CSV export; balance sheet ties |
| 16 | Insights & AI | ✅ Live | Duplicate-bill detection, cash-flow forecast; OCR + NL reporting wired to Claude |

Full per-module verification details are in the [README](../README.md).

## 3. Post-launch additions (beyond the original 16)

| Addition | What it is |
|---|---|
| **Tasks module** (all users) | Create/assign/delegate, subtasks, dependencies (cycle-rejected), comments, attachments, reminders, recurring rules, court-deadline→CRITICAL, billable-task→TimeEntry sync, daily cron automation. Blueprint: [`modules/tasks.md`](modules/tasks.md). |
| **Client intake wizard + document vault** | 3-step onboarding (identity → engagement → documents) with metadata scanning; client file with portfolio, storage (lawyers write / others read), conflict questionnaire, AI KYC internet screening producing a filed report. |
| **Security & Password Management** | Self-service: change password (policy + HIBP breach check + history), TOTP 2FA, recovery email, session revocation, activity log. Admin: reset/force-change/lock/unlock/2FA-reset, policy editor. |
| **AI settings in-app** | IT Admin stores the Anthropic key AES-256-GCM-encrypted in the database (env fallback). |
| **Pinto assistant** | App guide + Cameroon/CEMAC/OHADA legal research (web-search-verified citations) + PDF/DOCX document generation + co-working actions (tasks, client filing) under the user's own permissions; refuses financial/IT actions by design. |
| **Branding** | Dentons KMN logo; "ERP by Bouquet Innovation SA". |
| **Data migration** | Users and data from the two legacy Vercel deployments consolidated into production. |

## 4. Definition of Done (as applied to every shipped slice)

- [x] Schema in `prisma/schema.prisma`, seeded idempotently.
- [x] Domain invariants enforced server-side inside transactions.
- [x] API routes wrapped in `handle()`, documented by their Zod schemas.
- [x] Zod validation at every boundary, shared client/server.
- [x] `requirePermission()` guards + `companyId` scoping on every query.
- [x] `writeAudit()` on every material mutation.
- [x] EN + FR catalog entries — no hard-coded strings.
- [x] Role-aware, responsive, dark/light UI.
- [x] End-to-end verification pass (documented per module in the README).
- [x] CI green (prisma generate → tsc --noEmit → next build).

## 5. Known extension points (not built, deliberately)

| Extension | Where it would land |
|---|---|
| Multi-currency + FX revaluation | `postJournal()` + a currency/rate table; presentation layer is already centralized. |
| Additional jurisdictions (payroll/tax) | A second rules module alongside `src/lib/payroll.ts`. |
| SSO / OIDC (e.g. Azure AD) | Replace credential verification in `/api/auth/login`; session layer unchanged. |
| Email/SMS notification channels | `notify()` currently writes in-app rows; channel dispatch is one integration away. |
| External file storage (S3/Blob) for large documents | Documents are base64-inline (2 MB cap) for zero-infra portability today. |
| Power BI / read-API exports | Reports are computed in `src/lib/reports.ts`; exposing them as read endpoints is additive. |

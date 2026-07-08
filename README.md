# Dentons KMN Finance Management System

Production-grade financial management / ERP for **Dentons KMN** (law firm, Cameroon; multi-office / multi-country ready).

Built with **Next.js 14 (App Router) · TypeScript · TailwindCSS · Prisma · React Query · Zustand · React Hook Form · Zod · jose (JWT)**.

## Status

**Modules 1 & 2 are live and working** — a real, compiling, deployable system, not a mockup.
Remaining modules follow the roadmap in [`docs/04-roadmap.md`](docs/04-roadmap.md).

**Module 1 — Auth / RBAC / Users**
- Email/password login with server sessions (JWT in an httpOnly, `Secure`, `SameSite` cookie), failed-login lockout, logout.
- **RBAC**: 13 seeded system roles, a permission registry (`resource:action`), server-enforced permission guards on every route.
- **IT-Admin user management**: create / activate / deactivate users, assign roles, reset passwords (all audited).
- **Immutable audit log** of material actions.
- **Bilingual EN/FR** UI with live language switching (no re-login), dark/light mode, responsive role-aware navigation.

**Module 2 — General Ledger**
- **Chart of Accounts**: SYSCOHADA/OHADA-based (Cameroon), IFRS-reportable, 31 seeded accounts; create accounts (`gl:manage`).
- **Journal entries**: double-entry posting enforced **balanced** (debits = credits), against **open periods** and **postable accounts** only, in a DB transaction with sequential entry numbers.
- **Immutable posted entries** + audit trail; **Trial Balance** report that ties out.
- 6 journals, a fiscal year with 12 monthly periods seeded.
- Verified: balanced entry posts ✓, unbalanced rejected (422) ✓, non-`gl:post` role denied (403) ✓.

**Module 3 — Client & Matter Management**
- **Client onboarding** with type (corporate/individual), **KYC status**, **AML risk**, and **conflict status**.
- **Conflict checks**: name-overlap search across clients and matters, recorded and auditable; flags CLEAR / POTENTIAL.
- **Matters**: opened against a client + practice area + responsible partner, with a **compliance gate** — a matter can only be opened for a **KYC-verified, non-conflict-blocked** client.
- Clients and Matters screens (EN/FR, dark mode); 6 practice areas + sample data seeded.
- Verified: KYC gate blocks matters (422) ✓, conflict check flags overlaps (POTENTIAL) ✓, `client:manage` enforced (403 without) ✓.

**Module 5 — Time & Disbursements**
- **Time entries** by matter and fee earner, billable/non-billable, with **server-computed value** (minutes ÷ 60 × rate) and a **billable-hours / value summary**.
- **Disbursements**: matter costs with vendor, billable flag, and billable-total summary.
- Guarded so time/costs can't be booked to a **closed** matter; `time:log` / `disbursement:log` enforced.
- Time Entries and Disbursements screens (EN/FR, dark mode); sample data seeded.
- Verified: value computed correctly (150 min @ 80,000 = 200,000) ✓, non-`time:log` role denied (403) ✓, invalid matter rejected (422) ✓.

**Module 6 — Billing / Accounts Receivable**
- **Invoices** built from unbilled time + disbursements (+ manual lines), with **Cameroon VAT (19.25%)** and **withholding tax**; billed items are locked so they can't be double-invoiced.
- **Post to the General Ledger**: a balanced entry (Dr AR + WHT receivable = Cr fees + disbursement recoveries + VAT collected), reusing the Module 2 ledger — the trial balance stays balanced.
- **Receipts** against posted invoices (bank/cash/cheque/transfer/mobile) post Dr Bank/Cash = Cr AR, track part-paid → paid, and block overpayment.
- Invoices screen with create/post/receipt flows (EN/FR, dark mode).
- Verified: totals exact (subtotal 487,500 → total 562,781.25) ✓, GL & trial balance tie ✓, part-paid→paid ✓, overpayment (422) ✓, `invoice:create` enforced (403) ✓.

**Module 7 — Trust Accounting** (law-firm compliance)
- **Segregated client money**: per-client trust ledger (append-only) mirrored in the GL by a dedicated **trust bank (522000)** and **client-trust-liability (462000)** account — never commingled with firm funds.
- **Non-negative invariant**: a client's trust balance can never go negative (payments/applications exceeding the balance are rejected).
- **Deposit / Payment / Apply-to-invoice**: applying held funds settles a firm invoice via one balanced entry (trust liability ↓, AR ↓, operating bank ↑, trust bank ↓) and records a `TRUST` receipt.
- Trust Accounts list + per-account ledger screens (EN/FR, dark mode).
- Verified: deposit updates balance ✓, over-withdrawal rejected (422) ✓, apply-to-invoice → invoice PAID + trial balance ties ✓, `trust:manage`/`trust:read` enforced (403) ✓.

## Run locally

```bash
npm install
cp .env.example .env          # then edit AUTH_SECRET
npm run db:reset              # create SQLite dev DB, apply schema, seed
npm run dev                  # http://localhost:3000
```

### Seeded logins
| Role | Email | Password |
|---|---|---|
| IT Administrator | `admin@dentonskmn.local` | `ChangeMe123!` |
| CFO | `cfo@dentonskmn.local` | `ChangeMe123!` |

> Change these immediately in any real deployment.

## Scripts

| Script | Purpose |
|---|---|
| `npm run dev` | Dev server |
| `npm run build` | Production build (`prisma generate` + `next build`) |
| `npm start` | Run the production build |
| `npm run db:push` | Apply the Prisma schema to the DB |
| `npm run db:seed` | Seed roles, permissions, bootstrap users |
| `npm run db:reset` | Recreate + reseed the dev DB |
| `npm run typecheck` | `tsc --noEmit` |

## Deploying (internal web app)

The app builds to a **standalone** server (`next.config.mjs` → `output: "standalone"`).

### Option A — Vercel (fastest)
See the step-by-step guide: **[docs/DEPLOY-VERCEL.md](docs/DEPLOY-VERCEL.md)**.
In short: provision Postgres (Vercel Postgres / Neon / Supabase), import the repo, set
`DB_PROVIDER=postgresql`, `DATABASE_URL`, and `AUTH_SECRET`. The repo's `vercel-build`
script handles the provider switch, schema push, and seed automatically.

### Option B — Docker (any host)
```bash
docker build -t dkmn-finance .
docker run -p 3000:3000 \
  -e DATABASE_URL="postgresql://user:pass@host:5432/dkmn" \
  -e AUTH_SECRET="$(openssl rand -base64 48)" \
  dkmn-finance
```
Put it behind HTTPS (NGINX / your platform's TLS). The session cookie is `Secure`, so it
**requires HTTPS** in production.

> **Dev vs prod database:** local dev uses SQLite for zero-config. For production use
> PostgreSQL (change the `datasource` provider in `prisma/schema.prisma`). All status fields
> are portable strings, so no schema rewrite is needed.

## Documentation

Full architecture, data model, security design, and the module roadmap live in [`docs/`](docs/).

| Doc | Contents |
|---|---|
| [docs/00-overview.md](docs/00-overview.md) | Scope, principles, domain decisions |
| [docs/01-architecture.md](docs/01-architecture.md) | Architecture, stack, patterns |
| [docs/02-data-model.md](docs/02-data-model.md) | Data model & conventions |
| [docs/03-security.md](docs/03-security.md) | Security & compliance design |
| [docs/04-roadmap.md](docs/04-roadmap.md) | Module inventory & 12-phase plan |
| [docs/modules/auth-rbac-users.md](docs/modules/auth-rbac-users.md) | This module's detailed design |

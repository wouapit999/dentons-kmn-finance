# Architecture — as built

## 1. Style

- **One Next.js 14 App Router application** — UI pages, API routes, and domain logic in a single deployable, written entirely in strict TypeScript.
- **Server-enforced domain rules** — every invariant (balanced postings, trust non-negativity, KYC gates, task dependency gates) lives in the API route handlers and shared `src/lib` helpers, never only in the UI.
- **Thin, consistent API layer** — every route handler is wrapped in `handle()` (translates domain/auth/validation errors into JSON responses) and guarded by `requirePermission()` / `requireUser()`. These two functions are deliberately the most-connected symbols in the codebase.
- **No premature infrastructure** — no message broker, no Redis, no microservices. The domain never needed them at this scale; what mattered (balanced ledger, RBAC, audit) is enforced in-process and transactionally.

## 2. Repository layout (actual)

```
dentons-kmn-finance/
├─ prisma/
│  ├─ schema.prisma          # All models (User/RBAC, GL, AR/AP, Trust, Payroll, Tasks, Security, Documents…)
│  └─ seed.ts                # Idempotent seed: roles, permissions, COA, periods, demo data
├─ scripts/
│  └─ db-provider.mjs        # Switches Prisma datasource: SQLite (dev) ↔ PostgreSQL (prod) via DB_PROVIDER
├─ src/
│  ├─ app/
│  │  ├─ (app)/…/page.tsx    # One folder per module screen (dashboard, clients, matters, time, invoices,
│  │  │                      #   trust, suppliers, bills, cash, bank, procurement, employees, payroll,
│  │  │                      #   assets, gl/*, budgets, reports, insights, assistant, tasks, users,
│  │  │                      #   roles, audit, security, admin/security)
│  │  ├─ api/…/route.ts      # REST endpoints per module (~60 routes), all wrapped in handle()
│  │  └─ login/page.tsx      # Login incl. the 2FA step
│  ├─ components/            # shell (sidebar/nav), ui primitives, Pinto chat widget, logo, notifications
│  └─ lib/
│     ├─ auth.ts             # Sessions (jose JWT in httpOnly Secure cookie), CurrentUser, permission guards
│     ├─ api.ts              # handle() error-translating wrapper
│     ├─ audit.ts            # writeAudit() — append-only audit log
│     ├─ constants.ts        # Permission registry (resource:action), 13 system roles, enums
│     ├─ gl.ts / coa.ts      # postJournal() balanced double-entry helper; SYSCOHADA chart of accounts
│     ├─ payroll.ts          # Cameroon payroll engine (CNPS, IRPP bands, CAC, CRTV, CFC, FNE)
│     ├─ reports.ts          # accountBalances() and statement builders from POSTED lines
│     ├─ tasks.ts            # Task visibility/transition/dependency-cycle rules + notifications
│     ├─ security.ts         # Password policy, HIBP breach check, TOTP (RFC 6238) — dependency-free
│     ├─ settings.ts         # AES-256-GCM-encrypted in-app settings (AI key), resolveAiConfig()
│     ├─ ai.ts               # nlReport(), extractInvoice() OCR, kycScreen() with web search
│     ├─ pinto.ts            # Pinto agentic chat loop (app KB + CEMAC/OHADA legal KB + tools)
│     ├─ pinto-tools.ts      # Co-working tools (create/delegate/comment tasks, save doc to client)
│     ├─ pinto-doc.ts        # Document drafting (memos, jurisprudence notes, contracts)
│     ├─ docgen.ts           # Markdown → PDF (pdf-lib) / DOCX (docx) rendering
│     ├─ i18n.ts             # Full EN/FR message catalogs
│     └─ validation.ts       # Zod schemas shared by client and server
├─ docs/                     # This documentation set
└─ .github/workflows/ci.yml  # CI: prisma generate → tsc --noEmit → next build (SQLite)
```

## 3. Technology stack (actual)

| Layer | Choice | Why |
|---|---|---|
| Framework | **Next.js 14 (App Router) + React 18 + TypeScript** | One codebase for UI and API; SSR dashboards; file-system routing per module. |
| Styling/UI | **TailwindCSS** + hand-rolled shadcn-style primitives | Consistent enterprise UI, dark/light, EN/FR. |
| Client state | **Zustand** (UI) + **React Query** (server state) | Local UI state vs cached server data with invalidation. |
| Forms | **React Hook Form + Zod** | The same Zod schemas validate on the server — one source of truth. |
| ORM/DB | **Prisma** — SQLite in dev/CI, **PostgreSQL (Neon) in production** | `scripts/db-provider.mjs` switches the datasource via `DB_PROVIDER`; all enum-like fields are portable strings. |
| Auth | **jose** JWT sessions in httpOnly `Secure` cookies + DB session rows | Stateless verification with server-side revocation; MFA-pending tokens for the 2FA step. |
| Passwords / 2FA | **bcryptjs** hashing; **TOTP (RFC 6238)** and **HIBP k-anonymity** breach check implemented dependency-free in `src/lib/security.ts` | No native binaries — deploys anywhere Node runs. |
| AI | **@anthropic-ai/sdk** (Claude) | OCR, NL reporting, KYC screening (server-side web search tool), Pinto assistant. Key stored AES-256-GCM-encrypted in-app or via env. |
| Documents | **pdf-lib** + **docx** (pure JS) | PDF/DOCX generation on serverless — no headless browser, no native deps. |
| Deployment | **Vercel** (standalone output; daily cron at `/api/cron/tasks`) | `vercel-build` runs provider switch → generate → `db push` → idempotent seed → build. |
| CI | **GitHub Actions** | typecheck + build gate on SQLite. |

## 4. Cross-cutting services (as shipped)

Built once in `src/lib`, consumed by every module:

1. **RBAC** — permission registry (`resource:action`) in `constants.ts`; 13 seeded system roles; `requirePermission()` on every protected route; screen nav filtered by the same permissions.
2. **Audit** — `writeAudit()` after every material mutation; append-only `AuditLog` viewed at `/audit`.
3. **i18n** — `useT()` hook + full EN/FR catalogs; language switch persists per user without re-login.
4. **Money & posting** — `postJournal()` accepts only balanced line sets against open periods and postable accounts, in one DB transaction.
5. **Validation** — Zod at every boundary (`validation.ts`), shared client/server.
6. **Notifications** — in-app `Notification` rows + bell; produced by tasks, cron, and assignments.
7. **Tasks & workflow** — dependency-gated, visibility-filtered task system with recurring rules; procurement carries maker≠checker approval.

## 5. Request lifecycle (a money-moving command, as shipped)

```
Client (React Hook Form + Zod)
  → POST /api/... (Next.js route handler)
    → handle(async () => {
        requirePermission("invoice:approve")        // session + RBAC
        schema.parse(await req.json())               // Zod boundary validation
        domain checks (open period, unbilled items, balance guards…)
        prisma.$transaction( postJournal(balanced lines) + state updates )
        writeAudit({ actor, action, before, after })
      })
  ← JSON (i18n keys client-side; errors as { error } with 4xx status)
```

Double-posting is prevented by status guards inside the transaction (e.g. an invoice can
only move DRAFT→POSTED once); posting and state change commit atomically.

## 6. Multi-office / multi-country readiness

- `companyId` on every business row, injected from the authenticated user's scope in every query.
- Cameroon tax and payroll rules are isolated in `payroll.ts` / `constants.ts` (rates, bands, VAT) — adding a jurisdiction means a new rules module, not core changes.
- Locale is per-user (EN/FR); currency presentation is centralized.

## 7. AI subsystem

- `resolveAiConfig()` prefers the **in-app AES-256-GCM-encrypted key** (set by IT Admin under AI Settings) and falls back to the `ANTHROPIC_API_KEY` env var.
- **Pinto** (`pinto.ts`) runs an agentic loop: web search for legal accuracy (CEMAC/OHADA/Cameroon codes), plus whitelisted co-working tools that act **under the signed-in user's own permissions**. By design there are **no tools for financial engagement or IT administration** — Pinto refuses and redirects instead.
- Document generation (`pinto-doc.ts` → `docgen.ts`) produces formal PDF/DOCX (memos, jurisprudence notes, contracts) downloadable from the chat widget or filed directly into a client's record (lawyers only).

## 8. Design → build deviations (honest ledger)

The original design (kept in `02-data-model.md`, `03-security.md`, `modules/auth-rbac-users.md`)
targeted a larger distributed footprint. The build intentionally simplified:

| Original design | As built | Why |
|---|---|---|
| pnpm/Turborepo monorepo: `apps/` + `services/` (NestJS API, ledger, payroll, worker) + `packages/*` | One Next.js app; shared logic in `src/lib/*` | Single deployable fits the firm's scale; removes service orchestration entirely. |
| REST **+ GraphQL** | REST only | No consumer needed GraphQL flexibility. |
| Redis (sessions, locks, idempotency), BullMQ/RabbitMQ events | DB transactions + status guards; Vercel Cron for scheduled work | Transactional guards give the same correctness in-process; no queue infra to operate. |
| argon2id password hashing | **bcryptjs** | Pure-JS (no native builds) on serverless; strong work factor. |
| Postgres RLS as defense-in-depth | Application-layer `companyId` scoping only | RLS unavailable on SQLite dev path; every query is scoped via the auth layer. |
| Multi-currency + FX revaluation | XAF single-currency | Firm operates in XAF; multi-currency remains a documented extension point. |
| CQRS read-models / projections | Direct reads from POSTED lines | Report volumes don't justify projections. |
| Docker/K8s/NGINX infra | Vercel (standalone build also supports Docker) | Managed platform; `output: "standalone"` keeps the Docker option open. |
| Puppeteer/exceljs report exports | CSV export + pdf-lib/docx generation | Pure-JS serverless-safe equivalents. |

Everything the deviations *removed* was infrastructure; **no accounting, compliance, or
security invariant was dropped** — each one moved into transactional server code.

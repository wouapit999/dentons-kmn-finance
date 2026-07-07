# Architecture

## 1. Style

- **Modular monorepo** (single repo, many deployable/importable units).
- **Domain-Driven Design (DDD)** — the codebase is organized by business domain (bounded contexts), not by technical layer.
- **Clean Architecture** inside each domain — domain logic depends on nothing; infrastructure depends inward.
- **CQRS** where it earns its keep — commands (writes, go through approval/validation/domain rules) are separated from queries (reads, optimized projections/read-models for dashboards & reports).
- **Event-driven** for financial side-effects — a posted transaction emits domain events; ledger posting, notifications, audit, and read-model updates are handlers, not inline coupling.

We do **not** over-engineer: CQRS/event-sourcing is applied to the **ledger and money-moving flows**, not to CRUD reference data.

## 2. Monorepo layout

```
dentons-kmn-finance/
├─ apps/
│  ├─ web/                  # Next.js (App Router) + TS + Tailwind + shadcn/ui — the SPA/SSR frontend
│  └─ admin/                # (optional later) IT-admin console, if split from web
├─ services/
│  ├─ api/                  # NestJS API gateway (REST + GraphQL), auth, composition root
│  ├─ ledger/              # Accounting core domain service (GL, periods, posting)
│  ├─ payroll/              # Payroll & tax engine (Cameroon rules today, pluggable)
│  ├─ worker/               # BullMQ/RabbitMQ consumers: reports, OCR, notifications, revaluation
│  └─ reporting/            # Report generation (PDF/XLSX/CSV/DOCX) + Power BI-friendly read APIs
├─ packages/
│  ├─ domain/               # Pure domain models & business rules per bounded context (no I/O)
│  ├─ contracts/            # Shared DTOs, Zod schemas, OpenAPI/GraphQL types, event schemas
│  ├─ db/                   # Prisma schema, migrations, seed, row-scoping helpers
│  ├─ auth/                 # RBAC engine, permission definitions, policy evaluation
│  ├─ i18n/                 # EN/FR message catalogs + ICU formatting helpers
│  ├─ money/                # Money value object, currency registry, rounding, FX
│  ├─ audit/                # Audit-log writer, change diffing, immutability helpers
│  ├─ workflow/             # Approval engine (steps, thresholds, delegation, escalation)
│  └─ ui/                   # Shared React components (design system on shadcn/ui)
├─ libs/
│  └─ testing/              # Test factories, fixtures, e2e harness
├─ infra/
│  ├─ docker/               # Dockerfiles, docker-compose.dev.yml, docker-compose.prod.yml
│  ├─ k8s/                  # Kubernetes manifests / Helm (deploy-ready)
│  └─ nginx/                # Reverse proxy / TLS config
├─ .github/workflows/       # CI/CD (lint, typecheck, test, build, migrate, deploy)
└─ docs/                    # This documentation set
```

**Tooling:** pnpm workspaces + Turborepo (task graph, caching). Strict TypeScript everywhere. ESLint + Prettier. Conventional Commits + changesets.

## 3. Technology stack & rationale

| Layer | Choice | Why |
|---|---|---|
| Frontend | **Next.js + React + TypeScript** | SSR for fast dashboards, mature ecosystem, App Router for layouts per role. |
| Styling/UI | **TailwindCSS + shadcn/ui** | Consistent enterprise UI, dark/light, accessible primitives (Radix). |
| Client state | **Zustand** (UI state) + **React Query** (server state) | Clear split: local UI vs cached server data with invalidation. |
| Forms | **React Hook Form + Zod** | Same Zod schemas reused on server → one source of validation truth. |
| Backend | **NestJS on Node.js** | DI, modules map cleanly to bounded contexts, first-class REST+GraphQL+guards+interceptors. |
| ORM/DB | **Prisma + PostgreSQL** | Type-safe queries, migrations; Postgres for `NUMERIC`, RLS, JSONB, strong constraints. |
| Cache/locks | **Redis** | Sessions, rate limiting, idempotency keys, distributed locks for posting. |
| Async | **BullMQ (Redis)** + **RabbitMQ** | BullMQ for job queues (reports, OCR); RabbitMQ for durable domain-event fan-out. |
| API | **REST + GraphQL**, **Swagger/OpenAPI** | REST for transactional ops, GraphQL for flexible dashboard reads. |
| Auth | **JWT (access) + rotating refresh**, **OAuth2/OIDC** ready | Stateless API auth; OIDC for future SSO / Azure AD. |
| Reporting | **PDF (Puppeteer/pdfmake), XLSX (exceljs), CSV, DOCX (docx)** | Covers all required export formats + Power BI via read APIs. |
| Packaging | **Docker + Docker Compose (dev & prod) + K8s manifests** | Reproducible env; production-ready orchestration. |
| CI/CD | **GitHub Actions** | lint → typecheck → test → build → migrate → deploy. |

## 4. Cross-cutting services (shared by every module)

These are built **once** in `packages/*` and consumed everywhere. Every business module MUST integrate all seven:

1. **Auth & RBAC** (`packages/auth`) — guards on every route; permission checks in domain services.
2. **Approval workflow** (`packages/workflow`) — money-moving commands enter a workflow, not the ledger, until approved.
3. **Audit** (`packages/audit`) — interceptor captures before/after on every mutating command; immutable log.
4. **i18n** (`packages/i18n`) — server returns message keys + params; client renders EN/FR; no hard-coded strings.
5. **Money & FX** (`packages/money`) — all amounts flow through the Money value object; no raw arithmetic.
6. **Validation** (`packages/contracts`, Zod) — every input validated at the boundary; shared client/server.
7. **Notifications** (`services/worker`) — email/SMS/WhatsApp/Teams/Slack/push via a provider-abstracted dispatcher.

## 5. Request lifecycle (a money-moving command)

```
Client (RHF+Zod)
  → API (NestJS): AuthGuard → PermissionGuard → ValidationPipe(Zod) → IdempotencyGuard
    → Command handler (domain): business rules, balance/limit checks
      → Workflow engine: create approval instance (if threshold/rule requires)
         → [approvers act: approve/reject/return/delegate, with digital signature]
      → On final approval → Ledger posting (atomic, double-entry, period-open check)
         → Domain event emitted (RabbitMQ)
            → handlers: audit log, read-model projection, notifications, document links
  ← Response (i18n message keys)
```

Posting is wrapped in a DB transaction with a Redis lock per (account/period) to prevent races; every command carries an **idempotency key** so retries never double-post.

## 6. Multi-office / multi-country readiness

- `company_id` on all business rows; `office_id` where operationally meaningful.
- **Jurisdiction rules** (tax, payroll, statutory reports, COA mapping) live behind a `JurisdictionProvider` interface. Cameroon is the first implementation; adding a country = new provider + rule tables, no core changes.
- Currency and locale are per-user and per-company; consolidation reporting rolls offices/companies up in base currency.

## 7. Non-functional targets

- **Availability:** stateless services behind NGINX/K8s, horizontally scalable; Postgres primary + read replica for reporting.
- **Performance:** dashboard reads served from projections/materialized views; heavy reports run async in `worker`.
- **Observability:** structured logging (pino), request tracing (OpenTelemetry), health/readiness probes, metrics.
- **Backups/DR:** automated Postgres backups + PITR; documented restore runbook.

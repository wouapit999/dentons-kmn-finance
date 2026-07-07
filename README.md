# Dentons KMN Finance Management System

Production-grade financial management / ERP for **Dentons KMN** (law firm, Cameroon; multi-office / multi-country ready).

Built with **Next.js 14 (App Router) · TypeScript · TailwindCSS · Prisma · React Query · Zustand · React Hook Form · Zod · jose (JWT)**.

## Status

**Module 1 — Auth / RBAC / Users — is live and working.** The remaining finance modules
follow the roadmap in [`docs/04-roadmap.md`](docs/04-roadmap.md). This is a real,
compiling, deployable foundation — not a mockup.

What works today:
- Email/password login with server sessions (JWT in an httpOnly, `Secure`, `SameSite` cookie), failed-login lockout, logout.
- **RBAC**: 13 seeded system roles, a permission registry (`resource:action`), server-enforced permission guards on every route.
- **IT-Admin user management**: create / activate / deactivate users, assign roles, reset passwords (all audited).
- **Immutable audit log** of material actions (login, user create/update/deactivate, password reset).
- **Bilingual EN/FR** UI with live language switching (no re-login), dark/light mode, responsive role-aware navigation.
- Executive dashboard with KPIs; Users, Roles & Permissions, and Audit Log screens.

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
1. Push this repo to GitHub (see below).
2. Import it in Vercel.
3. Set env vars: `DATABASE_URL` (a **PostgreSQL** URL — e.g. Vercel Postgres / Neon / Supabase) and `AUTH_SECRET`.
4. Switch the Prisma datasource provider to `postgresql` in `prisma/schema.prisma`, then run `prisma migrate deploy` (or `db push`) and the seed once against the production DB.

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

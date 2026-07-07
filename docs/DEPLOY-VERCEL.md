# Deploying to Vercel

The app runs on Vercel's serverless runtime, which has an **ephemeral, read-only
filesystem** — so SQLite (used for local dev) cannot be used in production. You need
a **PostgreSQL** database. The repo is already wired to switch to Postgres at build time.

## 1. Provision a PostgreSQL database

Any of these work (all have free tiers):
- **Vercel Postgres** (Storage tab in your Vercel project) — easiest, auto-injects `DATABASE_URL`.
- **Neon** (https://neon.tech) — serverless Postgres, copy the connection string.
- **Supabase** (https://supabase.com) — use the connection string (with `?sslmode=require`).

## 2. Import the repo into Vercel

1. Go to https://vercel.com/new and import `wouapit999/dentons-kmn-finance`.
2. Framework preset: **Next.js** (auto-detected).
3. **Build Command:** leave as default — the repo defines a `vercel-build` script that
   Vercel runs automatically. It sets the Postgres provider, generates the client,
   pushes the schema, seeds roles/permissions/COA, then builds.

## 3. Set environment variables (Project → Settings → Environment Variables)

| Name | Value |
|---|---|
| `DB_PROVIDER` | `postgresql` |
| `DATABASE_URL` | your Postgres connection string (Vercel Postgres injects this automatically) |
| `AUTH_SECRET` | a strong random string — generate with `openssl rand -base64 48` |

> If you used **Vercel Postgres**, `DATABASE_URL` (and `POSTGRES_*`) are added for you;
> you still need to add `DB_PROVIDER=postgresql` and `AUTH_SECRET`.

## 4. Deploy

Click **Deploy**. The `vercel-build` script creates the schema and seeds the bootstrap
users. When it's live, sign in at `https://<your-app>.vercel.app/login`:

- `admin@dentonskmn.local` / `ChangeMe123!` (IT Administrator)
- `cfo@dentonskmn.local` / `ChangeMe123!` (CFO)

**Change these passwords immediately** (Users screen / reset-password).

## 5. Notes

- The session cookie is `Secure` — Vercel serves HTTPS by default, so this just works.
- The seed uses upserts, so redeploys are safe (they won't duplicate or reset data,
  and won't overwrite changed passwords).
- To move off the seed's public demo passwords, deactivate the seeded users or reset
  them once you've created your real IT-Admin account.
- Local development is unaffected: without `DB_PROVIDER`, everything defaults to SQLite
  (`npm run db:reset && npm run dev`).

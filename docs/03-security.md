# Security Design

> **As-built note.** The principles below all shipped; some mechanisms differ in the build:
> sessions are **jose JWTs in httpOnly `Secure` cookies backed by DB session rows** (revocable
> server-side) rather than access+refresh token rotation; password hashing is **bcryptjs**
> (pure JS) rather than argon2id; TOTP 2FA and the HIBP breach check are implemented
> dependency-free in [`src/lib/security.ts`](../src/lib/security.ts); rate limiting relies on
> the failed-login lockout counter rather than Redis. The shipped additions go beyond this
> design: self-service security page, admin password management, session revocation UI, and
> AES-256-GCM-encrypted in-app secrets. See [`01-architecture.md`](01-architecture.md) §8.

Security is enforced **server-side, in depth**. The frontend hides what a user can't do; the backend *prevents* it. No authorization decision is ever trusted from the client.

## 1. Authentication

- **Password login** → issues a short-lived **JWT access token** (~15 min) + a **rotating refresh token** (httpOnly, secure cookie; rotation detects reuse/theft).
- **Two-factor authentication (2FA):** TOTP (authenticator app) as default; optional SMS OTP. `mfa_secret` stored **encrypted at rest**. 2FA can be mandated per-role (all finance-approving roles: required).
- **OAuth2 / OIDC ready:** pluggable identity provider for future SSO (e.g., Azure AD / Google Workspace), so the firm can centralize identity without re-architecting.
- **Password policy (configurable):** min length, complexity, breach-list check, expiry, no reuse of last N (`password_history`), lockout after configurable failed attempts.
- **Failed-login detection:** `login_attempt` records every try; progressive throttling + temporary lockout + alert on anomalies (new country, impossible travel).

## 2. Authorization — RBAC model

**Permission = `resource` + `action`** (e.g. `invoice:approve`, `trust_account:read`, `payroll_run:post`). Roles are **bundles of permissions**; users get roles (optionally office-scoped). This is the model detailed in [`modules/auth-rbac-users.md`](modules/auth-rbac-users.md).

- **Role hierarchy** mirrors the org chart (Managing Partner → CFO → Finance Manager → Finance Officer → Cashier; plus Partners, Lawyers, HR, Procurement, IT, Auditors, Read-only). Hierarchy drives **default approval routing** and **delegation** rules.
- **Approval limits** are per-user, per-resource, per-currency monetary thresholds (`approval_limit`). A user can approve only up to their limit; above it, routing escalates upward.
- **Enforcement points:**
  1. `AuthGuard` — valid session/token.
  2. `PermissionGuard` — user holds the required permission for the route.
  3. **Domain check** — inside the command handler, re-verify permission + row-level scope (company/office) + monetary limit. (Belt and suspenders.)
- **Least privilege by default:** new users have no permissions until the IT Administrator assigns roles.

### Who can manage users
Only the **IT Administrator** role may: create/deactivate users, assign roles, reset passwords, assign departments/offices/approval-limits/language/currency, and grant permissions. This is itself a set of `user:*` permissions held only by that role.

## 3. Segregation of duties & approvals

- **Maker ≠ Checker** enforced: the creator of a transaction cannot be its sole approver; server rejects self-approval where policy forbids.
- **Approval workflow integrity:** each approval action is recorded in append-only `workflow_action` with a **digital signature** (hash of the entity snapshot + actor + timestamp, signed with the actor's key/secret). Tampering is detectable because the signed hash won't match.
- Actions supported: **approve, reject, return (for edits), comment, delegate, escalate**, all captured with actor, time, and reason.

## 4. Data protection

- **Encryption in transit:** TLS everywhere (NGINX termination + internal mTLS optional).
- **Encryption at rest:** Postgres volume encryption; column-level encryption for secrets (MFA secrets, bank account numbers, API keys) via a KMS-backed key.
- **Data masking:** sensitive fields (bank account numbers, salaries, tax IDs) masked in UI/exports unless the viewer holds an explicit `:read_sensitive` permission; masking applied server-side in the query projection, not the client.
- **PII minimization** in logs; structured logs scrub secrets.

## 5. Session, device & network controls

- **Session timeout** (idle + absolute), configurable per role; sessions listed and revocable (`user_session`).
- **Device management:** known devices tracked (`user_device`); new-device login can require re-verification and notifies the user.
- **IP restriction / allowlists:** optional per-company or per-role IP allowlisting (e.g., admin actions only from office network).
- **Login history** surfaced to each user and to IT admins.

## 6. Audit & immutability

- **Immutable audit log** (`audit_log`, append-only): every material create/update/delete records actor, action, entity, **before/after JSONB diff**, IP, device, user agent, timestamp. Enforced append-only via DB triggers + revoked UPDATE/DELETE on the app role; optional hash-chaining (each row includes hash of previous) to make silent tampering detectable.
- **Ledger immutability:** posted journals cannot be modified; closed periods reject any posting; corrections are reversing entries only.
- **Digital signatures** on approvals and on period-close events provide non-repudiation.

## 7. Application security hygiene

- Input validation at every boundary (**Zod** schemas shared client/server); output encoding to prevent XSS.
- Parameterized queries only (Prisma) — no string-built SQL.
- **Idempotency keys** on money-moving endpoints to prevent duplicate posting on retries.
- **Rate limiting** (Redis) on auth and sensitive endpoints; CSRF protection on cookie-based flows.
- Secrets in a secret manager (not env files in prod); dependency scanning + SAST in CI; `helmet` security headers.
- **Row-Level Security (RLS)** in Postgres as defense-in-depth for tenant isolation, in addition to app-layer scoping.

## 8. Compliance posture

- **IFRS**-compliant accounting with immutable closed periods.
- **KYC/AML** on clients; conflict checks before matter opening.
- **Trust/client-money rules:** strict segregation, no commingling, no negative client balances, periodic trust reconciliation — the audit log + immutable trust ledger provide the evidentiary trail regulators expect.
- Audit-ready: every financial figure is traceable from report → GL → sub-ledger → source document → approval chain → originating user.

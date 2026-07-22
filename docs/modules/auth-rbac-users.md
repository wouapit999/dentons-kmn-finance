# Module 1 — Auth / RBAC / Users (Detailed Design)

> **As-built note.** This module shipped and is live. The shipped shape: `src/lib/auth.ts`
> (sessions, `CurrentUser`, `requireUser`/`requirePermission`), `src/lib/constants.ts`
> (permission registry + 13 system roles), `/api/auth/*` + `/api/users` + `/api/me/*` routes,
> and the Users/Roles/Security screens. Deviations from the text below: bcryptjs instead of
> argon2id; cookie-JWT sessions backed by DB rows instead of refresh-token rotation; no
> office-scoped roles yet (single office). 2FA (TOTP), password policy/history/breach checks,
> and full audit shipped as designed. See [`01-architecture.md`](../01-architecture.md) §8.

**Why first:** every other module's authorization, audit actor, approval routing, and tenant scoping depend on this. It is the proof-of-pattern for the whole system.

---

## 1. Responsibilities

1. **Authentication** — login, logout, token issuance/refresh, 2FA, password lifecycle.
2. **Authorization (RBAC)** — permissions, roles, role hierarchy, user-role assignment, approval limits, policy evaluation.
3. **User administration** — IT-Admin-only lifecycle of users and their attributes.
4. **Account security** — sessions, devices, login history, lockout, IP allowlists.

## 2. Domain model (recap from `02-data-model.md`)

`user`, `role`, `permission`, `role_permission`, `user_role`, `approval_limit`, `user_session`, `user_device`, `login_attempt`, `password_history`, plus `digital_signature` and `audit_log` (cross-cutting). See ERD in [`../diagrams/erd-auth.md`](../diagrams/erd-auth.md).

### Permission taxonomy
Format `resource:action`. Actions: `create | read | read_sensitive | update | delete | approve | post | export | manage`.
Examples: `user:manage`, `role:manage`, `invoice:approve`, `payroll_run:post`, `trust_account:read`.
Permissions are **seeded from a central registry** in `packages/auth` so the set is versioned and discoverable.

### System roles (seeded, `is_system=true`)
Managing Partner, CFO, Finance Manager, Finance Officer, Cashier, HR Payroll Officer, Procurement Officer, Partner, Associate/Lawyer, Practice Group Head, IT Administrator, Auditor (read-only), Read-only Management. Each ships with a **default permission set**; the IT Admin can create custom roles too.

### Role hierarchy & approval routing
`role.hierarchy_level` (integer) orders roles. The workflow engine uses hierarchy + `approval_limit` to route approvals upward until an approver's limit covers the amount. Example routing for a payment:

```
Finance Officer (enters) → Finance Manager (review)
  → CFO (approve)  → Managing Partner (approve if amount > CFO limit) → released
```

## 3. Key flows

### 3.1 Login (with 2FA)
```
POST /auth/login {email, password}
  → rate-limit + lockout check (login_attempt, Redis)
  → verify password_hash (argon2id)
  → if mfa_enabled → return {mfaRequired:true, mfaToken}
POST /auth/mfa {mfaToken, otp}
  → verify TOTP → issue access JWT (15m) + refresh (rotating, httpOnly cookie)
  → record user_session + user_device (new device → notify user)
  → audit_log: LOGIN_SUCCESS
Failures → login_attempt(success=false, reason); progressive throttle; lock after N.
```

### 3.2 Token refresh (rotation + reuse detection)
```
POST /auth/refresh (cookie)
  → validate refresh token; if already-used token presented → SECURITY EVENT:
    revoke all sessions for user, alert, force re-login.
  → else rotate: issue new access+refresh, invalidate old.
```

### 3.3 IT-Admin creates a user
```
POST /admin/users  (requires user:manage)
  body: { email, phone, employee_id?, department_id, office_id, roles[],
          locale (en|fr), currency, approval_limits[] }
  → validate (Zod) + unique email per company
  → create user (status=INVITED, no password)
  → generate one-time secure set-password link (expiring)
  → email invite (i18n per chosen locale)
  → audit_log: USER_CREATED (before=null, after=snapshot)
```
Only the IT Administrator role holds `user:manage`, `role:manage`, `user:reset_password`. All these actions are audited and (for privileged grants) can require a second approver via the workflow engine.

### 3.4 Password reset (admin-initiated or self-service)
```
Admin: POST /admin/users/:id/reset-password (user:reset_password)
Self:  POST /auth/forgot → email link → POST /auth/reset {token, newPassword}
  → enforce password policy + password_history (no reuse of last N)
  → invalidate all existing sessions
  → audit_log: PASSWORD_RESET
```

### 3.5 Authorization check (every protected route)
```
AuthGuard: valid access token, session not revoked, not expired
PermissionGuard(required: 'invoice:approve'):
  → load user's effective permissions (roles → role_permission), cache in Redis (short TTL)
  → require permission present
  → require company_id match (tenant scope); office scope if role is office-bound
DomainService (re-check): permission + row scope + approval_limit for the amount
```

## 4. API surface (initial)

| Method | Path | Permission | Purpose |
|---|---|---|---|
| POST | `/auth/login` | public | password step |
| POST | `/auth/mfa` | public (mfaToken) | 2FA step |
| POST | `/auth/refresh` | cookie | rotate tokens |
| POST | `/auth/logout` | authed | revoke session |
| POST | `/auth/forgot` / `/auth/reset` | public | self-service reset |
| GET | `/me` | authed | profile + effective permissions + locale |
| PATCH | `/me/language` | authed | switch EN/FR (no re-login) |
| GET/POST/PATCH | `/admin/users` | `user:manage` | user lifecycle |
| POST | `/admin/users/:id/(deactivate\|reset-password\|roles\|limits)` | `user:manage` | admin ops |
| GET/POST/PATCH | `/admin/roles`, `/admin/permissions` | `role:manage` | RBAC config |
| GET | `/me/sessions`, `/me/devices`, `/me/login-history` | authed | account security |
| GET | `/admin/audit` | `audit:read` | audit browsing |

All endpoints: Zod-validated, audited, i18n responses. GraphQL mirrors the read side for admin console tables.

## 5. Security specifics for this module

- Passwords hashed with **argon2id**; MFA secrets **encrypted** (KMS key).
- Access tokens short-lived; refresh tokens rotated with reuse detection.
- Lockout, throttling, and anomaly alerts on `login_attempt`.
- IP allowlist enforceable on `/admin/*` routes per company/role.
- Self-approval prevention wired here for the privilege-grant workflow.
- Every state change appends to the **immutable audit log** with before/after.

## 6. Frontend deliverables

- Login + 2FA screens, forgot/reset flows, set-password (invite) flow.
- Language switcher in the top bar (persists to `/me/language`, updates UI live).
- **IT Admin console:** users table (create/edit/deactivate, assign roles/office/department/limits/locale/currency), roles & permissions editor, audit viewer, session/device management.
- Role-aware navigation: menu items and actions render only if the user's effective permissions allow them (server remains the enforcer).

## 7. Definition of Done for Module 1

The generic checklist in [`../04-roadmap.md`](../04-roadmap.md) §4, plus module-specific:
- [ ] Seed: system roles + default permission sets + one bootstrap IT Admin.
- [ ] 2FA enrollment + verification working end-to-end.
- [ ] Refresh-token rotation with reuse detection tested.
- [ ] Lockout/throttle tested (negative paths).
- [ ] Permission enforcement covered by integration tests (allow + deny).
- [ ] EN/FR catalogs complete for all auth/admin strings.
- [ ] Audit entries verified for create/update/deactivate/reset/login.

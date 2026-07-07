# Data Model

## 1. Conventions (apply to every table)

| Convention | Rule |
|---|---|
| **Primary key** | `id UUID` (v7, time-ordered) — no exposing sequential business volume. |
| **Tenancy** | `company_id UUID NOT NULL` (FK → `company`); `office_id UUID NULL` where relevant. |
| **Timestamps** | `created_at`, `updated_at` (UTC, `timestamptz`). |
| **Actor** | `created_by`, `updated_by` (FK → `user`). |
| **Soft delete** | `deleted_at timestamptz NULL`, `deleted_by`. Rows are never hard-deleted from business tables. |
| **Optimistic locking** | `version INT` (bumped on update) to prevent lost updates. |
| **Money** | amount `NUMERIC(20,4)` + `currency CHAR(3)` (ISO 4217). Never `float`. |
| **Enums** | Postgres enums or lookup tables; status columns explicit, never magic strings. |
| **Indexes** | FK columns indexed; composite indexes on common query paths; partial index `WHERE deleted_at IS NULL`. |
| **Constraints** | `CHECK` constraints enforce invariants at the DB (e.g. amounts, date ranges, non-negative trust balances). |
| **Naming** | `snake_case` tables/columns; singular table names; FK `<entity>_id`. |

**Immutability:** the ledger tables (`journal_entry`, `journal_line`) are **append-only** — no `UPDATE`/`DELETE` after posting. Corrections are new reversing entries. Enforced by DB triggers + revoked update privileges on the app role for closed periods.

## 2. Money & multi-currency model

- **Functional currency:** XAF (0 minor units). Stored amounts still use `NUMERIC(20,4)` for consistency and for currencies with decimals (EUR, USD).
- Every monetary row stores the **transaction currency**, the **amount**, the **exchange rate** used, and the **base-currency amount** at posting time.
- **Revaluation:** open FX-denominated balances are revalued at period end; unrealized gain/loss posted to a dedicated account; realized gain/loss computed at settlement.
- The `packages/money` value object is the only place arithmetic happens; rounding follows each currency's minor-unit rule (`currency` reference table).

## 3. Core reference & organization

```
company (id, legal_name, base_currency, country_code, ...)
office (id, company_id, name, country_code, currency, timezone, ...)
department (id, company_id, name, parent_id?)
practice_area (id, company_id, name)             -- Corporate, Litigation, Tax, IP, ...
currency (code PK, name, minor_units, symbol)
exchange_rate (id, company_id, base, quote, rate, as_of_date, source)
fiscal_year (id, company_id, name, start_date, end_date, status)      -- OPEN|CLOSED
accounting_period (id, fiscal_year_id, seq, start_date, end_date, status) -- OPEN|CLOSING|CLOSED
```

## 4. Identity, access & audit (first module — see modules/auth-rbac-users.md)

```
user (id, company_id, employee_id?, email, phone, status, locale, currency,
      password_hash, mfa_enabled, mfa_secret_enc, last_login_at, ...)
role (id, company_id, key, name, is_system, hierarchy_level)
permission (id, key, resource, action, description)   -- e.g. resource=invoice action=approve
role_permission (role_id, permission_id)
user_role (user_id, role_id, office_id?)              -- role can be office-scoped
approval_limit (id, user_id, resource, currency, max_amount)  -- per-user approval thresholds
user_session (id, user_id, device_id, ip, user_agent, created_at, expires_at, revoked_at)
user_device (id, user_id, fingerprint, name, trusted, last_seen_at)
login_attempt (id, user_id?, email, ip, success, reason, created_at)
password_history (id, user_id, password_hash, created_at)

audit_log (id, company_id, actor_id, action, entity_type, entity_id,
           before JSONB, after JSONB, ip, device_id, user_agent, created_at)  -- APPEND-ONLY
digital_signature (id, actor_id, entity_type, entity_id, hash, signed_at, meta) -- APPEND-ONLY
```

## 5. Accounting core (General Ledger)

```
account (id, company_id, code, name, type, syscohada_class, ifrs_category,
         currency?, is_postable, parent_id?, status)   -- Chart of Accounts (tree)
   -- type: ASSET|LIABILITY|EQUITY|REVENUE|EXPENSE
journal (id, company_id, code, name, type)             -- Sales, Purchases, Bank, Cash, General, Payroll, Trust
journal_entry (id, company_id, journal_id, period_id, entry_no, entry_date,
               description, currency, fx_rate, source_type, source_id,
               status, posted_at, posted_by, reversal_of_id?)   -- status: DRAFT|POSTED|REVERSED
journal_line (id, entry_id, account_id, debit NUMERIC(20,4), credit NUMERIC(20,4),
              base_debit, base_credit, currency, description, matter_id?, partner_id?, cost_center?)
   -- CHECK: exactly one of debit/credit > 0; entry sum(debit)=sum(credit) enforced on post
```

**Sub-ledgers** (AR, AP, Trust) post control totals to the GL and keep line detail; a nightly/real-time reconciliation asserts sub-ledger == GL control account.

## 6. Law-firm domain

```
client (id, company_id, type, name, kyc_status, aml_risk, tax_id, ...)  -- type: CORPORATE|INDIVIDUAL
conflict_check (id, client_id, status, checked_by, notes)
engagement (id, client_id, letter_ref, signed_at, billing_type, rate_card_id?)
matter (id, company_id, client_id, code, name, practice_area_id, responsible_partner_id, status)
rate_card / rate (matter/lawyer/role → hourly rate, currency, effective dates)

time_entry (id, matter_id, lawyer_id, date, minutes, billable, rate, amount, narrative, status)
disbursement (id, matter_id, date, description, amount, currency, billable, vendor_id?, status)
fee_note / invoice (id, company_id, client_id, matter_id, number, date, due_date,
                    subtotal, vat, wht, total, currency, status)  -- DRAFT|APPROVED|SENT|PART_PAID|PAID|WRITTEN_OFF
invoice_line (id, invoice_id, source_type, source_id, description, qty, rate, amount, tax_code)
credit_note / debit_note (…)
receipt (id, client_id, invoice_id?, amount, currency, method, bank_account_id?, date)
```

### Trust accounting (segregated, compliance-critical)

```
trust_account (id, company_id, bank_account_id, client_id, matter_id?, currency, status)
trust_ledger_entry (id, trust_account_id, date, type, amount, currency, ref,
                    running_balance, source_type, source_id)  -- APPEND-ONLY
   -- INVARIANT: running_balance >= 0 per (client, matter) at all times (CHECK + guard)
   -- INVARIANT: trust funds never commingled with firm funds; separate bank + separate GL space
trust_reconciliation (id, trust_bank_account_id, statement_date, book_balance, bank_balance, status)
```

## 7. Operational finance (summary — detailed in each module doc)

```
supplier / vendor_bill / purchase_order / goods_received_note / vendor_payment / expense_claim
bank_account / bank_statement / bank_statement_line / bank_reconciliation / cheque / transfer_request
cash_account / petty_cash / cash_count / cash_transfer
fixed_asset / depreciation_schedule / asset_disposal / asset_maintenance
budget / budget_line / budget_revision / forecast
```

## 8. Payroll & tax (Cameroon-first, pluggable)

```
employee (id, company_id, office_id, person_ref, hire_date, contract_type, base_salary, currency, cnps_no, ...)
salary_component (id, code, name, type, taxable, cnps_base, formula)  -- earning|deduction
payroll_run (id, company_id, period, status, approved_by, ...)   -- DRAFT|APPROVED|PAID|CLOSED
payslip (id, run_id, employee_id, gross, taxable, paye, cnps_employee, cnps_employer,
         crtv, council_tax, net, currency)
payslip_line (id, payslip_id, component_id, amount, base)
tax_table (id, jurisdiction, tax_type, effective_from, bands JSONB)   -- versioned tax rules
```

Payroll runs post a **payroll journal** to the GL; taxes create statutory liabilities (PAYE payable, CNPS payable) cleared on remittance.

## 9. Cross-cutting tables

```
attachment (id, company_id, entity_type, entity_id, filename, mime, storage_key, sha256, version, uploaded_by)
notification (id, user_id, channel, template_key, payload JSONB, status, sent_at)
workflow_definition (id, company_id, resource, steps JSONB)      -- configurable approval chains
workflow_instance (id, definition_id, entity_type, entity_id, status, current_step)
workflow_action (id, instance_id, step, actor_id, action, comment, signature_id?, acted_at) -- APPEND-ONLY
setting (id, company_id, key, value JSONB)                        -- feature flags, params
```

## 10. Diagrams

High-level ERD and the detailed Auth-module ERD live in [`diagrams/`](diagrams/) (Mermaid). See [`diagrams/erd-core.md`](diagrams/erd-core.md).

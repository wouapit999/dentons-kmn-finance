# Core ERD (high level)

Bounded contexts and their principal relationships. Rendered with Mermaid.

```mermaid
erDiagram
    COMPANY ||--o{ OFFICE : has
    COMPANY ||--o{ USER : employs
    COMPANY ||--o{ ACCOUNT : owns
    COMPANY ||--o{ CLIENT : serves
    COMPANY ||--o{ FISCAL_YEAR : defines

    FISCAL_YEAR ||--o{ ACCOUNTING_PERIOD : contains
    ACCOUNTING_PERIOD ||--o{ JOURNAL_ENTRY : posts_in

    ACCOUNT ||--o{ JOURNAL_LINE : referenced_by
    JOURNAL ||--o{ JOURNAL_ENTRY : groups
    JOURNAL_ENTRY ||--o{ JOURNAL_LINE : has

    CLIENT ||--o{ MATTER : engages
    CLIENT ||--o{ ENGAGEMENT : signs
    CLIENT ||--o{ TRUST_ACCOUNT : holds
    MATTER ||--o{ TIME_ENTRY : logs
    MATTER ||--o{ DISBURSEMENT : incurs
    MATTER ||--o{ INVOICE : billed_on
    INVOICE ||--o{ INVOICE_LINE : contains
    INVOICE ||--o{ RECEIPT : paid_by

    TRUST_ACCOUNT ||--o{ TRUST_LEDGER_ENTRY : records

    SUPPLIER ||--o{ VENDOR_BILL : issues
    VENDOR_BILL ||--o{ VENDOR_PAYMENT : settled_by
    PURCHASE_ORDER ||--o{ GOODS_RECEIVED_NOTE : fulfilled_by

    BANK_ACCOUNT ||--o{ BANK_STATEMENT : produces
    BANK_ACCOUNT ||--o{ TRUST_ACCOUNT : backs

    EMPLOYEE ||--o{ PAYSLIP : receives
    PAYROLL_RUN ||--o{ PAYSLIP : generates

    USER ||--o{ AUDIT_LOG : acts_in
    USER ||--o{ WORKFLOW_ACTION : approves

    JOURNAL_ENTRY ||--o{ ATTACHMENT : documented_by
    INVOICE ||--o{ ATTACHMENT : documented_by
```

**Sub-ledger → GL rule:** AR (invoices/receipts), AP (bills/payments), and Trust each maintain detail and post control totals to `JOURNAL_ENTRY`/`JOURNAL_LINE`. Reconciliation asserts sub-ledger balances equal their GL control accounts.

// Central registry of enums and the permission taxonomy.
// Statuses are strings in the DB but constrained here.

export const USER_STATUS = ["INVITED", "ACTIVE", "DISABLED"] as const;
export type UserStatus = (typeof USER_STATUS)[number];

export const LOCALES = ["en", "fr"] as const;
export type Locale = (typeof LOCALES)[number];

// Cameroon standard VAT (TVA) rate, including the additional council tax.
export const CAMEROON_VAT_RATE = 19.25;

// Permission taxonomy: resource:action.
// This is the source of truth; the seed inserts exactly these.
export const PERMISSIONS = {
  // User & access administration (IT Administrator)
  "user:read": "View users",
  "user:manage": "Create, edit, deactivate users; assign roles/limits",
  "user:reset_password": "Reset another user's password",
  "role:read": "View roles and permissions",
  "role:manage": "Create/edit roles and assign permissions",
  "audit:read": "View the audit log",

  // General Ledger
  "gl:read": "View the general ledger",
  "gl:post": "Post journal entries",
  "gl:manage": "Manage the chart of accounts and periods",

  // Client & Matter Management
  "client:read": "View clients",
  "client:manage": "Create/edit clients, run KYC & conflict checks",
  "matter:read": "View matters",
  "matter:manage": "Open and manage matters",

  // Time & Disbursements
  "time:read": "View time entries",
  "time:log": "Log and edit time entries",
  "disbursement:read": "View disbursements",
  "disbursement:log": "Record disbursements",

  // Billing / AR
  "invoice:read": "View invoices",
  "invoice:create": "Create invoices",
  "invoice:approve": "Approve invoices",

  // Payments
  "payment:read": "View payments",
  "payment:create": "Enter payments",
  "payment:approve": "Approve payments",

  // Trust accounting
  "trust:read": "View trust accounts",
  "trust:manage": "Manage trust transactions",

  // Payroll
  "payroll:read": "View payroll",
  "payroll:post": "Post/approve payroll runs",

  // Reporting
  "report:read": "View reports",
  "report:export": "Export reports",
} as const;

export type PermissionKey = keyof typeof PERMISSIONS;

export function allPermissionKeys(): PermissionKey[] {
  return Object.keys(PERMISSIONS) as PermissionKey[];
}

// System roles with their default permission sets and hierarchy levels
// (lower number = higher authority).
export const SYSTEM_ROLES: {
  key: string;
  name: string;
  hierarchyLevel: number;
  permissions: PermissionKey[];
}[] = [
  {
    key: "MANAGING_PARTNER",
    name: "Managing Partner",
    hierarchyLevel: 10,
    permissions: [
      "user:read", "role:read", "audit:read", "gl:read", "client:read",
      "client:manage", "matter:read", "matter:manage", "time:read",
      "disbursement:read", "invoice:read", "invoice:approve", "payment:read",
      "payment:approve", "trust:read", "payroll:read", "payroll:post",
      "report:read", "report:export",
    ],
  },
  {
    key: "CFO",
    name: "Chief Finance Officer",
    hierarchyLevel: 20,
    permissions: [
      "user:read", "audit:read", "gl:read", "gl:post", "gl:manage", "client:read",
      "matter:read", "time:read", "disbursement:read", "invoice:read",
      "invoice:approve", "payment:read", "payment:approve", "trust:read",
      "trust:manage", "payroll:read", "payroll:post", "report:read", "report:export",
    ],
  },
  {
    key: "FINANCE_MANAGER",
    name: "Finance Manager",
    hierarchyLevel: 30,
    permissions: [
      "gl:read", "gl:post", "gl:manage", "client:read", "matter:read",
      "time:read", "disbursement:read", "invoice:read", "invoice:create",
      "invoice:approve", "payment:read", "payment:create", "payment:approve",
      "trust:read", "report:read", "report:export",
    ],
  },
  {
    key: "FINANCE_OFFICER",
    name: "Finance Officer",
    hierarchyLevel: 40,
    permissions: [
      "gl:read", "client:read", "matter:read", "time:read", "disbursement:read",
      "invoice:read", "invoice:create", "payment:read", "payment:create", "report:read",
    ],
  },
  {
    key: "CASHIER",
    name: "Cashier",
    hierarchyLevel: 50,
    permissions: ["payment:read", "payment:create", "report:read"],
  },
  {
    key: "HR_PAYROLL_OFFICER",
    name: "HR Payroll Officer",
    hierarchyLevel: 40,
    permissions: ["payroll:read", "payroll:post", "report:read"],
  },
  {
    key: "PROCUREMENT_OFFICER",
    name: "Procurement Officer",
    hierarchyLevel: 40,
    permissions: ["payment:read", "report:read"],
  },
  {
    key: "PARTNER",
    name: "Partner",
    hierarchyLevel: 25,
    permissions: [
      "client:read", "client:manage", "matter:read", "matter:manage",
      "time:read", "time:log", "disbursement:read", "disbursement:log",
      "invoice:read", "invoice:approve", "report:read", "trust:read",
    ],
  },
  {
    key: "LAWYER",
    name: "Associate / Lawyer",
    hierarchyLevel: 60,
    permissions: [
      "client:read", "matter:read", "matter:manage", "time:read", "time:log",
      "disbursement:read", "disbursement:log", "invoice:read", "report:read",
    ],
  },
  {
    key: "PRACTICE_GROUP_HEAD",
    name: "Practice Group Head",
    hierarchyLevel: 25,
    permissions: [
      "client:read", "client:manage", "matter:read", "matter:manage",
      "time:read", "time:log", "disbursement:read", "disbursement:log",
      "invoice:read", "invoice:approve", "report:read",
    ],
  },
  {
    key: "IT_ADMIN",
    name: "IT Administrator",
    hierarchyLevel: 15,
    permissions: [
      "user:read", "user:manage", "user:reset_password", "role:read",
      "role:manage", "audit:read",
    ],
  },
  {
    key: "AUDITOR",
    name: "Auditor (read-only)",
    hierarchyLevel: 35,
    permissions: [
      "gl:read", "client:read", "matter:read", "time:read", "disbursement:read",
      "invoice:read", "payment:read", "trust:read", "payroll:read", "audit:read",
      "report:read", "report:export",
    ],
  },
  {
    key: "MANAGEMENT_READONLY",
    name: "Read-only Management",
    hierarchyLevel: 35,
    permissions: [
      "gl:read", "client:read", "matter:read", "time:read", "disbursement:read",
      "invoice:read", "payment:read", "report:read",
    ],
  },
];

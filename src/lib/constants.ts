// Central registry of enums and the permission taxonomy.
// Statuses are strings in the DB but constrained here.

export const USER_STATUS = ["INVITED", "ACTIVE", "DISABLED"] as const;
export type UserStatus = (typeof USER_STATUS)[number];

export const LOCALES = ["en", "fr"] as const;
export type Locale = (typeof LOCALES)[number];

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

  // General Ledger (future modules — defined so roles can be seeded)
  "gl:read": "View the general ledger",
  "gl:post": "Post journal entries",

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
      "user:read", "role:read", "audit:read", "gl:read", "invoice:read",
      "invoice:approve", "payment:read", "payment:approve", "trust:read",
      "payroll:read", "payroll:post", "report:read", "report:export",
    ],
  },
  {
    key: "CFO",
    name: "Chief Finance Officer",
    hierarchyLevel: 20,
    permissions: [
      "user:read", "audit:read", "gl:read", "gl:post", "invoice:read",
      "invoice:approve", "payment:read", "payment:approve", "trust:read",
      "trust:manage", "payroll:read", "payroll:post", "report:read", "report:export",
    ],
  },
  {
    key: "FINANCE_MANAGER",
    name: "Finance Manager",
    hierarchyLevel: 30,
    permissions: [
      "gl:read", "gl:post", "invoice:read", "invoice:create", "invoice:approve",
      "payment:read", "payment:create", "payment:approve", "trust:read",
      "report:read", "report:export",
    ],
  },
  {
    key: "FINANCE_OFFICER",
    name: "Finance Officer",
    hierarchyLevel: 40,
    permissions: [
      "gl:read", "invoice:read", "invoice:create", "payment:read",
      "payment:create", "report:read",
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
    permissions: ["invoice:read", "invoice:approve", "report:read", "trust:read"],
  },
  {
    key: "LAWYER",
    name: "Associate / Lawyer",
    hierarchyLevel: 60,
    permissions: ["invoice:read", "report:read"],
  },
  {
    key: "PRACTICE_GROUP_HEAD",
    name: "Practice Group Head",
    hierarchyLevel: 25,
    permissions: ["invoice:read", "invoice:approve", "report:read"],
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
      "gl:read", "invoice:read", "payment:read", "trust:read", "payroll:read",
      "audit:read", "report:read", "report:export",
    ],
  },
  {
    key: "MANAGEMENT_READONLY",
    name: "Read-only Management",
    hierarchyLevel: 35,
    permissions: ["gl:read", "invoice:read", "payment:read", "report:read"],
  },
];

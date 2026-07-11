// Central registry of enums and the permission taxonomy.
// Statuses are strings in the DB but constrained here.

export const USER_STATUS = ["INVITED", "ACTIVE", "DISABLED"] as const;
export type UserStatus = (typeof USER_STATUS)[number];

export const LOCALES = ["en", "fr"] as const;
export type Locale = (typeof LOCALES)[number];

// Cameroon standard VAT (TVA) rate, including the additional council tax.
export const CAMEROON_VAT_RATE = 19.25;

// --- Client compliance ---

// Standard law-firm conflict-of-interest checklist. A "yes" on any question
// flags the check as POTENTIAL for partner review.
export const CONFLICT_QUESTIONS: { key: string; en: string; fr: string }[] = [
  {
    key: "adverse_prior",
    en: "Has the firm previously acted for a party adverse to this client?",
    fr: "Le cabinet a-t-il déjà agi pour une partie adverse à ce client ?",
  },
  {
    key: "adverse_current",
    en: "Is this client adverse to any existing client of the firm?",
    fr: "Ce client est-il en litige avec un client actuel du cabinet ?",
  },
  {
    key: "personal_interest",
    en: "Does any lawyer or staff member have a personal or financial interest in this client or its affairs?",
    fr: "Un avocat ou membre du personnel a-t-il un intérêt personnel ou financier dans ce client ou ses affaires ?",
  },
  {
    key: "related_parties",
    en: "Do related parties (subsidiaries, affiliates, directors) create a potential conflict?",
    fr: "Des parties liées (filiales, sociétés affiliées, dirigeants) créent-elles un conflit potentiel ?",
  },
  {
    key: "confidential_info",
    en: "Has the firm received confidential information from an adverse party relevant to this client?",
    fr: "Le cabinet a-t-il reçu des informations confidentielles d'une partie adverse concernant ce client ?",
  },
];

export const CLIENT_DOC_KINDS = [
  "IDENTITY", "REFERENCE", "CONTRACT", "KYC_REPORT", "CONFLICT_REPORT", "OTHER",
] as const;

// --- Tasks module ---
export const TASK_PRIORITIES = ["LOW", "MEDIUM", "HIGH", "CRITICAL"] as const;
export const TASK_STATUSES = [
  "DRAFT", "ASSIGNED", "IN_PROGRESS", "WAITING", "COMPLETED", "ARCHIVED",
] as const;
export const TASK_VISIBILITY = ["PRIVATE", "MATTER", "PUBLIC"] as const;

// Legal status transitions, enforced server-side.
export const TASK_TRANSITIONS: Record<string, string[]> = {
  DRAFT: ["ASSIGNED", "IN_PROGRESS", "ARCHIVED"],
  ASSIGNED: ["IN_PROGRESS", "WAITING", "ARCHIVED"],
  IN_PROGRESS: ["WAITING", "COMPLETED", "ARCHIVED"],
  WAITING: ["IN_PROGRESS", "COMPLETED", "ARCHIVED"],
  COMPLETED: ["ARCHIVED", "IN_PROGRESS"], // reopen allowed
  ARCHIVED: [],
};

export const TASK_CATEGORIES: {
  key: string; name: string; isCourtDeadline?: boolean; isBillable?: boolean;
}[] = [
  { key: "ADMINISTRATIVE", name: "Administrative" },
  { key: "LEGAL_WORK", name: "Legal Work", isBillable: true },
  { key: "COURT_FILING", name: "Court Filing", isCourtDeadline: true, isBillable: true },
  { key: "RESEARCH", name: "Research", isBillable: true },
  { key: "CLIENT_COMM", name: "Client Communication", isBillable: true },
  { key: "BILLING", name: "Billing-related" },
  { key: "COMPLIANCE", name: "Compliance" },
  { key: "DRAFTING", name: "Document Drafting", isBillable: true },
  { key: "FOLLOW_UP", name: "Follow-ups" },
];

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

  // Accounts Payable
  "ap:read": "View suppliers and vendor bills",
  "ap:manage": "Create suppliers and vendor bills",
  "ap:approve": "Post vendor bills and record vendor payments",

  // Cash Management
  "cash:read": "View cash accounts and movements",
  "cash:manage": "Open cash accounts and record cash movements",

  // Banking
  "bank:read": "View bank accounts and transactions",
  "bank:manage": "Open bank accounts and record bank transactions",
  "bank:reconcile": "Reconcile bank accounts",

  // Procurement
  "procure:read": "View purchase requests and orders",
  "procure:request": "Create purchase requests",
  "procure:approve": "Approve purchase requests and issue orders",

  // Trust accounting
  "trust:read": "View trust accounts",
  "trust:manage": "Manage trust transactions",

  // Payroll
  "payroll:read": "View payroll",
  "payroll:manage": "Manage employees and prepare payroll runs",
  "payroll:post": "Post/approve payroll runs",

  // Fixed Assets
  "asset:read": "View fixed assets",
  "asset:manage": "Register and dispose of fixed assets",
  "asset:post": "Run and post depreciation",

  // Budgeting
  "budget:read": "View budgets and variance",
  "budget:manage": "Create and edit budgets",

  // Tasks (basic task use needs no permission — any authenticated user)
  "task:admin": "See, reassign and manage all tasks",

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
      "payment:approve", "ap:read", "ap:approve", "trust:read", "trust:manage",
      "payroll:read", "payroll:manage", "payroll:post", "asset:read",
      "budget:read", "budget:manage", "cash:read", "bank:read",
      "procure:read", "procure:approve", "task:admin", "report:read", "report:export",
    ],
  },
  {
    key: "CFO",
    name: "Chief Finance Officer",
    hierarchyLevel: 20,
    permissions: [
      "user:read", "audit:read", "gl:read", "gl:post", "gl:manage", "client:read",
      "matter:read", "time:read", "disbursement:read", "invoice:read",
      "invoice:approve", "payment:read", "payment:approve", "ap:read", "ap:manage",
      "ap:approve", "trust:read", "trust:manage", "payroll:read", "payroll:manage",
      "payroll:post", "asset:read", "asset:manage", "asset:post",
      "budget:read", "budget:manage", "cash:read", "cash:manage",
      "bank:read", "bank:manage", "bank:reconcile", "procure:read",
      "procure:request", "procure:approve", "report:read", "report:export",
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
      "ap:read", "ap:manage", "ap:approve", "trust:read", "asset:read",
      "asset:manage", "asset:post", "budget:read", "budget:manage",
      "cash:read", "cash:manage", "bank:read", "bank:manage", "bank:reconcile",
      "procure:read", "procure:request", "procure:approve", "report:read", "report:export",
    ],
  },
  {
    key: "FINANCE_OFFICER",
    name: "Finance Officer",
    hierarchyLevel: 40,
    permissions: [
      "gl:read", "client:read", "matter:read", "time:read", "disbursement:read",
      "invoice:read", "invoice:create", "payment:read", "payment:create",
      "ap:read", "ap:manage", "asset:read", "asset:manage", "cash:read",
      "cash:manage", "bank:read", "procure:read", "procure:request", "report:read",
    ],
  },
  {
    key: "CASHIER",
    name: "Cashier",
    hierarchyLevel: 50,
    permissions: ["payment:read", "payment:create", "cash:read", "cash:manage", "report:read"],
  },
  {
    key: "HR_PAYROLL_OFFICER",
    name: "HR Payroll Officer",
    hierarchyLevel: 40,
    permissions: ["payroll:read", "payroll:manage", "payroll:post", "report:read"],
  },
  {
    key: "PROCUREMENT_OFFICER",
    name: "Procurement Officer",
    hierarchyLevel: 40,
    permissions: [
      "payment:read", "ap:read", "ap:manage", "procure:read", "procure:request",
      "report:read",
    ],
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
      "role:manage", "task:admin", "audit:read",
    ],
  },
  {
    key: "AUDITOR",
    name: "Auditor (read-only)",
    hierarchyLevel: 35,
    permissions: [
      "gl:read", "client:read", "matter:read", "time:read", "disbursement:read",
      "invoice:read", "payment:read", "ap:read", "trust:read", "payroll:read",
      "asset:read", "budget:read", "cash:read", "bank:read", "procure:read",
      "audit:read", "report:read", "report:export",
    ],
  },
  {
    key: "MANAGEMENT_READONLY",
    name: "Read-only Management",
    hierarchyLevel: 35,
    permissions: [
      "gl:read", "client:read", "matter:read", "time:read", "disbursement:read",
      "invoice:read", "payment:read", "ap:read", "asset:read", "budget:read",
      "cash:read", "bank:read", "procure:read",
      "report:read",
    ],
  },
];

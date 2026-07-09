import { z } from "zod";
import { LOCALES } from "./constants";

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const createUserSchema = z.object({
  fullName: z.string().min(2).max(120),
  email: z.string().email(),
  phone: z.string().max(30).optional().or(z.literal("")),
  password: z.string().min(8, "Password must be at least 8 characters"),
  locale: z.enum(LOCALES).default("en"),
  currency: z.string().length(3).default("XAF"),
  departmentId: z.string().uuid().optional().or(z.literal("")),
  roleIds: z.array(z.string().uuid()).min(1, "Assign at least one role"),
});
export type CreateUserInput = z.infer<typeof createUserSchema>;

export const updateUserSchema = z.object({
  fullName: z.string().min(2).max(120).optional(),
  phone: z.string().max(30).optional(),
  status: z.enum(["INVITED", "ACTIVE", "DISABLED"]).optional(),
  locale: z.enum(LOCALES).optional(),
  currency: z.string().length(3).optional(),
  departmentId: z.string().uuid().nullable().optional(),
  roleIds: z.array(z.string().uuid()).optional(),
});
export type UpdateUserInput = z.infer<typeof updateUserSchema>;

export const resetPasswordSchema = z.object({
  password: z.string().min(8),
});

export const changeLanguageSchema = z.object({
  locale: z.enum(LOCALES),
});

// --- General Ledger ---

export const createAccountSchema = z.object({
  code: z.string().min(3).max(20),
  name: z.string().min(2).max(160),
  type: z.enum(["ASSET", "LIABILITY", "EQUITY", "REVENUE", "EXPENSE"]),
  syscohadaClass: z.string().max(2).optional().or(z.literal("")),
  ifrsCategory: z.string().max(80).optional().or(z.literal("")),
  isPostable: z.boolean().default(true),
});
export type CreateAccountInput = z.infer<typeof createAccountSchema>;

const journalLineSchema = z
  .object({
    accountId: z.string().uuid(),
    debit: z.number().nonnegative().default(0),
    credit: z.number().nonnegative().default(0),
    description: z.string().max(200).optional(),
  })
  .refine((l) => !(l.debit > 0 && l.credit > 0), {
    message: "A line cannot have both a debit and a credit",
  })
  .refine((l) => l.debit > 0 || l.credit > 0, {
    message: "A line must have a debit or a credit",
  });

// --- Client & Matter Management ---

export const createClientSchema = z.object({
  type: z.enum(["CORPORATE", "INDIVIDUAL"]),
  name: z.string().min(2).max(160),
  email: z.string().email().optional().or(z.literal("")),
  phone: z.string().max(30).optional().or(z.literal("")),
  taxId: z.string().max(40).optional().or(z.literal("")),
  amlRisk: z.enum(["LOW", "MEDIUM", "HIGH"]).default("LOW"),
});
export type CreateClientInput = z.infer<typeof createClientSchema>;

export const updateClientSchema = z.object({
  name: z.string().min(2).max(160).optional(),
  email: z.string().email().optional().or(z.literal("")),
  phone: z.string().max(30).optional(),
  taxId: z.string().max(40).optional(),
  kycStatus: z.enum(["PENDING", "VERIFIED", "REJECTED"]).optional(),
  amlRisk: z.enum(["LOW", "MEDIUM", "HIGH"]).optional(),
  status: z.enum(["ACTIVE", "INACTIVE"]).optional(),
});
export type UpdateClientInput = z.infer<typeof updateClientSchema>;

export const createMatterSchema = z.object({
  clientId: z.string().uuid(),
  code: z.string().min(2).max(30),
  name: z.string().min(2).max(160),
  practiceAreaId: z.string().uuid().optional().or(z.literal("")),
  responsiblePartnerId: z.string().uuid().optional().or(z.literal("")),
  currency: z.string().length(3).default("XAF"),
});
export type CreateMatterInput = z.infer<typeof createMatterSchema>;

// --- Time & Disbursements ---

export const createTimeEntrySchema = z.object({
  matterId: z.string().uuid(),
  lawyerId: z.string().uuid().optional().or(z.literal("")),
  date: z.string(), // ISO date
  minutes: z.number().int().positive().max(24 * 60),
  billable: z.boolean().default(true),
  rate: z.number().nonnegative().default(0),
  currency: z.string().length(3).default("XAF"),
  narrative: z.string().max(500).optional().or(z.literal("")),
});
export type CreateTimeEntryInput = z.infer<typeof createTimeEntrySchema>;

export const createDisbursementSchema = z.object({
  matterId: z.string().uuid(),
  date: z.string(),
  description: z.string().min(2).max(300),
  amount: z.number().positive(),
  currency: z.string().length(3).default("XAF"),
  billable: z.boolean().default(true),
  vendorName: z.string().max(160).optional().or(z.literal("")),
});
export type CreateDisbursementInput = z.infer<typeof createDisbursementSchema>;

// --- Billing / Accounts Receivable ---

export const createInvoiceSchema = z.object({
  matterId: z.string().uuid(),
  date: z.string(),
  dueDate: z.string(),
  currency: z.string().length(3).default("XAF"),
  vatRate: z.number().min(0).max(100).default(19.25),
  whtRate: z.number().min(0).max(100).default(0),
  timeEntryIds: z.array(z.string().uuid()).default([]),
  disbursementIds: z.array(z.string().uuid()).default([]),
  manualLines: z
    .array(
      z.object({
        description: z.string().min(1).max(200),
        amount: z.number().positive(),
      }),
    )
    .default([]),
}).refine(
  (v) => v.timeEntryIds.length + v.disbursementIds.length + v.manualLines.length > 0,
  { message: "Add at least one line to the invoice" },
);
export type CreateInvoiceInput = z.infer<typeof createInvoiceSchema>;

export const createReceiptSchema = z.object({
  invoiceId: z.string().uuid(),
  date: z.string(),
  amount: z.number().positive(),
  method: z.enum(["CASH", "BANK", "CHEQUE", "TRANSFER", "MOBILE"]).default("BANK"),
  reference: z.string().max(80).optional().or(z.literal("")),
});
export type CreateReceiptInput = z.infer<typeof createReceiptSchema>;

// --- Trust Accounting ---

export const createTrustAccountSchema = z.object({
  clientId: z.string().uuid(),
  currency: z.string().length(3).default("XAF"),
});

export const trustTxnSchema = z
  .object({
    type: z.enum(["DEPOSIT", "PAYMENT", "APPLIED"]),
    amount: z.number().positive(),
    date: z.string(),
    reference: z.string().max(120).optional().or(z.literal("")),
    matterId: z.string().uuid().optional().or(z.literal("")),
    invoiceId: z.string().uuid().optional().or(z.literal("")),
  })
  .refine((v) => v.type !== "APPLIED" || !!v.invoiceId, {
    message: "Applying trust funds requires an invoice",
    path: ["invoiceId"],
  });
export type TrustTxnInput = z.infer<typeof trustTxnSchema>;

// --- Accounts Payable ---

export const createSupplierSchema = z.object({
  name: z.string().min(2).max(160),
  email: z.string().email().optional().or(z.literal("")),
  phone: z.string().max(30).optional().or(z.literal("")),
  taxId: z.string().max(40).optional().or(z.literal("")),
});
export type CreateSupplierInput = z.infer<typeof createSupplierSchema>;

export const createBillSchema = z.object({
  supplierId: z.string().uuid(),
  supplierRef: z.string().max(60).optional().or(z.literal("")),
  date: z.string(),
  dueDate: z.string(),
  description: z.string().min(2).max(300),
  expenseAccountCode: z.string().min(3).max(20),
  amount: z.number().positive(),
  vatRate: z.number().min(0).max(100).default(19.25),
  currency: z.string().length(3).default("XAF"),
});
export type CreateBillInput = z.infer<typeof createBillSchema>;

export const payBillSchema = z.object({
  billId: z.string().uuid(),
  date: z.string(),
  amount: z.number().positive(),
  method: z.enum(["CASH", "BANK", "CHEQUE", "TRANSFER", "MOBILE"]).default("BANK"),
  reference: z.string().max(80).optional().or(z.literal("")),
});
export type PayBillInput = z.infer<typeof payBillSchema>;

// --- Payroll ---

export const createEmployeeSchema = z.object({
  employeeNo: z.string().min(1).max(30),
  fullName: z.string().min(2).max(160),
  position: z.string().max(120).optional().or(z.literal("")),
  baseSalary: z.number().nonnegative(),
  housingAllowance: z.number().nonnegative().default(0),
  transportAllowance: z.number().nonnegative().default(0),
  cnpsNo: z.string().max(40).optional().or(z.literal("")),
  bankAccount: z.string().max(40).optional().or(z.literal("")),
});
export type CreateEmployeeInput = z.infer<typeof createEmployeeSchema>;

export const createPayrollRunSchema = z.object({
  period: z.string().min(3).max(40),
  periodId: z.string().uuid().optional().or(z.literal("")),
});
export type CreatePayrollRunInput = z.infer<typeof createPayrollRunSchema>;

// --- Fixed Assets ---

export const createAssetSchema = z.object({
  tag: z.string().min(1).max(40),
  name: z.string().min(2).max(160),
  category: z.string().max(80).optional().or(z.literal("")),
  assetAccountCode: z.string().min(3).max(20),
  acquisitionDate: z.string(),
  cost: z.number().positive(),
  salvageValue: z.number().nonnegative().default(0),
  usefulLifeMonths: z.number().int().positive().max(1200),
});
export type CreateAssetInput = z.infer<typeof createAssetSchema>;

export const depreciateSchema = z.object({
  period: z.string().min(3).max(40),
  date: z.string(),
});

export const disposeAssetSchema = z.object({
  date: z.string(),
  proceeds: z.number().nonnegative().default(0),
});

// --- Budgeting ---

export const createBudgetSchema = z.object({
  name: z.string().min(2).max(120),
  year: z.number().int().min(2000).max(2100),
  lines: z
    .array(
      z.object({
        accountCode: z.string().min(3).max(20),
        annualAmount: z.number().nonnegative(),
      }),
    )
    .min(1, "Add at least one budget line"),
});
export type CreateBudgetInput = z.infer<typeof createBudgetSchema>;

export const createEntrySchema = z
  .object({
    journalId: z.string().uuid(),
    periodId: z.string().uuid(),
    entryDate: z.string(), // ISO date
    description: z.string().max(300).optional(),
    currency: z.string().length(3).default("XAF"),
    lines: z.array(journalLineSchema).min(2, "An entry needs at least two lines"),
  })
  .refine(
    (e) => {
      const debit = e.lines.reduce((s, l) => s + l.debit, 0);
      const credit = e.lines.reduce((s, l) => s + l.credit, 0);
      return Math.abs(debit - credit) < 0.0001 && debit > 0;
    },
    { message: "Entry is not balanced (total debits must equal total credits)" },
  );
export type CreateEntryInput = z.infer<typeof createEntrySchema>;

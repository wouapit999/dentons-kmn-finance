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

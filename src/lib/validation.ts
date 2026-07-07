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

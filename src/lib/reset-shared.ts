/*
 * Dentons KMN ERP
 * Copyright (c) 2026 Bouquet Innovation SA. All rights reserved.
 * Proprietary and confidential. Unauthorised copying, distribution, modification,
 * or use of this file, via any medium, is strictly prohibited.
 */
import "server-only";
import { prisma } from "./prisma";

// Tables owned by the SIBLING apps that live in the same shared database. These
// carry no tenant column (single-tenant deployment), so a reset clears them
// entirely. Ordered children-first so plain DELETEs respect foreign keys.
//
// Deliberately KEPT (config / bookkeeping, never data):
//   screening_config, hr_document_template, hr_document_sequence,
//   hr_schema_migrations.
export const SHARED_TABLES = {
  // Cleared with the Clients/Matters/Financial reset — onboarding + screening.
  operational: [
    "onboarding_documents", // FK matter_id -> onboarding_matters
    "onboarding_matters",
    "screening_files",
    "screening_audit",
    "screening_clients",
  ],
  // Cleared with the Employees/Users reset — HR operational records.
  org: [
    "hr_training_attendance", // FK training_id -> hr_training
    "hr_training",
    "hr_application", // FK vacancy_id -> hr_vacancy
    "hr_vacancy",
    "hr_generated_document",
    "hr_leave_request",
    "hr_mission",
    "hr_performance_review",
  ],
} as const;

// Table names are a fixed allow-list (never user input) — safe to interpolate.
const identOk = (t: string) => /^[a-z_][a-z0-9_]*$/.test(t);

/** Does a table exist in the public schema? (An app may not be provisioned.) */
async function tableExists(table: string): Promise<boolean> {
  const rows = await prisma.$queryRawUnsafe<{ n: bigint }[]>(
    `SELECT count(*)::bigint AS n FROM information_schema.tables
     WHERE table_schema = 'public' AND table_name = $1`,
    table,
  );
  return Number(rows[0]?.n ?? 0) > 0;
}

/** Snapshot every listed sibling table (for the pre-delete backup). */
export async function backupSharedTables(tables: readonly string[]): Promise<Record<string, unknown[]>> {
  const out: Record<string, unknown[]> = {};
  for (const t of tables) {
    if (!identOk(t) || !(await tableExists(t))) continue;
    try {
      out[t] = await prisma.$queryRawUnsafe<unknown[]>(`SELECT * FROM "${t}"`);
    } catch {
      out[t] = [];
    }
  }
  return out;
}

/** Delete all rows from each listed sibling table (children-first order). */
export async function clearSharedTables(
  tables: readonly string[],
): Promise<{ counts: Record<string, number>; errors: Record<string, string> }> {
  const counts: Record<string, number> = {};
  const errors: Record<string, string> = {};
  for (const t of tables) {
    if (!identOk(t)) continue;
    if (!(await tableExists(t))) continue; // sibling app not provisioned here
    try {
      const n = await prisma.$executeRawUnsafe(`DELETE FROM "${t}"`);
      counts[t] = typeof n === "number" ? n : 0;
    } catch (e) {
      errors[t] = e instanceof Error ? e.message.split("\n")[0] : "delete_failed";
    }
  }
  return { counts, errors };
}

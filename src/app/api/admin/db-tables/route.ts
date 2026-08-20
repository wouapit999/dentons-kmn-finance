/*
 * Dentons KMN ERP
 * Copyright (c) 2026 Bouquet Innovation SA. All rights reserved.
 * Proprietary and confidential. Unauthorised copying, distribution, modification,
 * or use of this file, via any medium, is strictly prohibited.
 */
import { handle } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/auth";

export const dynamic = "force-dynamic";

// GET /api/admin/db-tables — READ-ONLY inventory of every table in the shared
// database (public schema): approximate row count and whether it carries a
// tenant/scoping column. Used to plan a cross-app reset safely. IT Admin only.
export async function GET() {
  return handle(async () => {
    await requirePermission("system:reset");

    const cols = await prisma.$queryRawUnsafe<{ table_name: string; column_name: string }[]>(
      `SELECT table_name, column_name FROM information_schema.columns
       WHERE table_schema = 'public' ORDER BY table_name, ordinal_position`,
    );
    const colsByTable = new Map<string, string[]>();
    for (const c of cols) {
      const arr = colsByTable.get(c.table_name) ?? [];
      arr.push(c.column_name);
      colsByTable.set(c.table_name, arr);
    }

    // Approximate live-row counts (fast; from the stats collector).
    const stats = await prisma.$queryRawUnsafe<{ relname: string; n_live_tup: bigint }[]>(
      `SELECT relname, n_live_tup FROM pg_stat_user_tables WHERE schemaname = 'public'`,
    );
    const rowsByTable = new Map<string, number>();
    for (const s of stats) rowsByTable.set(s.relname, Number(s.n_live_tup));

    const scopeCols = ["companyId", "company_id", "tenantId", "tenant_id", "organizationId", "orgId"];
    const tables = Array.from(colsByTable.entries())
      .map(([name, columns]) => ({
        name,
        approxRows: rowsByTable.get(name) ?? 0,
        columnCount: columns.length,
        scopeColumn: scopeCols.find((sc) => columns.includes(sc)) ?? null,
        // Surface a few identifying columns to help classify ownership.
        sampleColumns: columns.slice(0, 12),
      }))
      .sort((a, b) => a.name.localeCompare(b.name));

    return { tableCount: tables.length, tables };
  });
}

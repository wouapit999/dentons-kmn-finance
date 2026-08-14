/*
 * Dentons KMN ERP
 * Copyright (c) 2026 Bouquet Innovation SA. All rights reserved.
 * Proprietary and confidential. Unauthorised copying, distribution, modification,
 * or use of this file, via any medium, is strictly prohibited.
 */
// Additive, idempotent schema migration for PostgreSQL.
//
// WHY THIS EXISTS: the production database is shared with sibling Dentons apps
// (onboarding_*, screening_*). `prisma db push` computes a full diff and wants
// to DROP those tables, which would destroy another application's data. This
// script instead applies ONLY additive DDL (CREATE TABLE / INDEX IF NOT EXISTS,
// ADD COLUMN IF NOT EXISTS) so it can never remove anything.
//
// Safe to run on every deploy. No-ops when DB_PROVIDER is not postgresql
// (local dev uses `prisma db push` against its own SQLite file).
import { PrismaClient } from "@prisma/client";

const provider = (process.env.DB_PROVIDER || "sqlite").replace(/[﻿\s]/g, "");
if (provider !== "postgresql") {
  console.log(`ensure-schema: provider is "${provider}" - skipping (Postgres only).`);
  process.exit(0);
}

const DEC = "DECIMAL(65,30)";
const TS = "TIMESTAMP(3)";

// --- tables (additive) -----------------------------------------------------
const tables = [
  `CREATE TABLE IF NOT EXISTS "Timer" (
     "id" TEXT NOT NULL,
     "companyId" TEXT NOT NULL,
     "userId" TEXT NOT NULL,
     "matterId" TEXT,
     "narrative" TEXT,
     "source" TEXT NOT NULL DEFAULT 'APP',
     "accumulatedSec" INTEGER NOT NULL DEFAULT 0,
     "runningSince" ${TS},
     "status" TEXT NOT NULL DEFAULT 'RUNNING',
     "timeEntryId" TEXT,
     "createdAt" ${TS} NOT NULL DEFAULT CURRENT_TIMESTAMP,
     "updatedAt" ${TS} NOT NULL DEFAULT CURRENT_TIMESTAMP,
     CONSTRAINT "Timer_pkey" PRIMARY KEY ("id")
   )`,
  `CREATE TABLE IF NOT EXISTS "LegalEntity" (
     "id" TEXT NOT NULL,
     "companyId" TEXT NOT NULL,
     "code" TEXT NOT NULL,
     "name" TEXT NOT NULL,
     "baseCurrency" TEXT NOT NULL DEFAULT 'XAF',
     "countryCode" TEXT NOT NULL DEFAULT 'CM',
     "taxId" TEXT,
     "isDefault" BOOLEAN NOT NULL DEFAULT false,
     "createdAt" ${TS} NOT NULL DEFAULT CURRENT_TIMESTAMP,
     CONSTRAINT "LegalEntity_pkey" PRIMARY KEY ("id")
   )`,
  `CREATE TABLE IF NOT EXISTS "ExchangeRate" (
     "id" TEXT NOT NULL,
     "companyId" TEXT NOT NULL,
     "currency" TEXT NOT NULL,
     "rate" ${DEC} NOT NULL,
     "asOf" ${TS} NOT NULL,
     "createdAt" ${TS} NOT NULL DEFAULT CURRENT_TIMESTAMP,
     CONSTRAINT "ExchangeRate_pkey" PRIMARY KEY ("id")
   )`,
  `CREATE TABLE IF NOT EXISTS "Proforma" (
     "id" TEXT NOT NULL,
     "companyId" TEXT NOT NULL,
     "clientId" TEXT NOT NULL,
     "matterId" TEXT NOT NULL,
     "entityId" TEXT,
     "number" TEXT NOT NULL,
     "status" TEXT NOT NULL DEFAULT 'DRAFT',
     "currency" TEXT NOT NULL DEFAULT 'XAF',
     "fxRate" ${DEC} NOT NULL DEFAULT 1,
     "periodFrom" ${TS},
     "periodTo" ${TS},
     "feeSubtotal" ${DEC} NOT NULL DEFAULT 0,
     "disbSubtotal" ${DEC} NOT NULL DEFAULT 0,
     "writeDown" ${DEC} NOT NULL DEFAULT 0,
     "subtotal" ${DEC} NOT NULL DEFAULT 0,
     "vatRate" ${DEC} NOT NULL DEFAULT 0,
     "whtRate" ${DEC} NOT NULL DEFAULT 0,
     "total" ${DEC} NOT NULL DEFAULT 0,
     "notes" TEXT,
     "preparedById" TEXT,
     "reviewerId" TEXT,
     "approvedById" TEXT,
     "approvedAt" ${TS},
     "invoiceId" TEXT,
     "createdAt" ${TS} NOT NULL DEFAULT CURRENT_TIMESTAMP,
     "updatedAt" ${TS} NOT NULL DEFAULT CURRENT_TIMESTAMP,
     CONSTRAINT "Proforma_pkey" PRIMARY KEY ("id")
   )`,
  `CREATE TABLE IF NOT EXISTS "ProformaLine" (
     "id" TEXT NOT NULL,
     "proformaId" TEXT NOT NULL,
     "sourceType" TEXT NOT NULL,
     "sourceId" TEXT,
     "description" TEXT NOT NULL,
     "originalAmount" ${DEC} NOT NULL DEFAULT 0,
     "adjustedAmount" ${DEC} NOT NULL DEFAULT 0,
     "minutes" INTEGER,
     "included" BOOLEAN NOT NULL DEFAULT true,
     CONSTRAINT "ProformaLine_pkey" PRIMARY KEY ("id")
   )`,
  `CREATE TABLE IF NOT EXISTS "ProformaComment" (
     "id" TEXT NOT NULL,
     "proformaId" TEXT NOT NULL,
     "authorId" TEXT NOT NULL,
     "body" TEXT NOT NULL,
     "createdAt" ${TS} NOT NULL DEFAULT CURRENT_TIMESTAMP,
     CONSTRAINT "ProformaComment_pkey" PRIMARY KEY ("id")
   )`,
];

// --- new columns on existing tables (additive) -----------------------------
const columns = [
  `ALTER TABLE "TimeEntry" ADD COLUMN IF NOT EXISTS "source" TEXT NOT NULL DEFAULT 'APP'`,
  `ALTER TABLE "Matter" ADD COLUMN IF NOT EXISTS "officeId" TEXT`,
  `ALTER TABLE "Matter" ADD COLUMN IF NOT EXISTS "entityId" TEXT`,
  // Interns: a type flag, and employeeNo relaxed to nullable so interns need no
  // generated number (DROP NOT NULL is not a destructive drop — no data lost).
  `ALTER TABLE "Employee" ADD COLUMN IF NOT EXISTS "employeeType" TEXT NOT NULL DEFAULT 'EMPLOYEE'`,
  `ALTER TABLE "Employee" ALTER COLUMN "employeeNo" DROP NOT NULL`,
];

// --- indexes & uniques ----------------------------------------------------
const indexes = [
  `CREATE INDEX IF NOT EXISTS "Timer_companyId_idx" ON "Timer"("companyId")`,
  `CREATE INDEX IF NOT EXISTS "Timer_userId_status_idx" ON "Timer"("userId", "status")`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "LegalEntity_companyId_code_key" ON "LegalEntity"("companyId", "code")`,
  `CREATE INDEX IF NOT EXISTS "LegalEntity_companyId_idx" ON "LegalEntity"("companyId")`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "ExchangeRate_companyId_currency_asOf_key" ON "ExchangeRate"("companyId", "currency", "asOf")`,
  `CREATE INDEX IF NOT EXISTS "ExchangeRate_companyId_currency_idx" ON "ExchangeRate"("companyId", "currency")`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "Proforma_companyId_number_key" ON "Proforma"("companyId", "number")`,
  `CREATE INDEX IF NOT EXISTS "Proforma_companyId_idx" ON "Proforma"("companyId")`,
  `CREATE INDEX IF NOT EXISTS "Proforma_matterId_idx" ON "Proforma"("matterId")`,
  `CREATE INDEX IF NOT EXISTS "ProformaLine_proformaId_idx" ON "ProformaLine"("proformaId")`,
  `CREATE INDEX IF NOT EXISTS "ProformaComment_proformaId_idx" ON "ProformaComment"("proformaId")`,
];

// --- foreign keys (guarded; integrity only, never fatal) -------------------
const fk = (table, name, col, refTable, onDelete = "RESTRICT") => `
  DO $$ BEGIN
    ALTER TABLE "${table}" ADD CONSTRAINT "${name}"
      FOREIGN KEY ("${col}") REFERENCES "${refTable}"("id")
      ON DELETE ${onDelete} ON UPDATE CASCADE;
  EXCEPTION WHEN duplicate_object THEN NULL; WHEN others THEN NULL; END $$;`;

const foreignKeys = [
  fk("Timer", "Timer_companyId_fkey", "companyId", "Company"),
  fk("Timer", "Timer_userId_fkey", "userId", "User", "CASCADE"),
  fk("Timer", "Timer_matterId_fkey", "matterId", "Matter", "SET NULL"),
  fk("LegalEntity", "LegalEntity_companyId_fkey", "companyId", "Company"),
  fk("ExchangeRate", "ExchangeRate_companyId_fkey", "companyId", "Company"),
  fk("Proforma", "Proforma_companyId_fkey", "companyId", "Company"),
  fk("Proforma", "Proforma_clientId_fkey", "clientId", "Client"),
  fk("Proforma", "Proforma_matterId_fkey", "matterId", "Matter"),
  fk("Proforma", "Proforma_entityId_fkey", "entityId", "LegalEntity", "SET NULL"),
  fk("ProformaLine", "ProformaLine_proformaId_fkey", "proformaId", "Proforma", "CASCADE"),
  fk("ProformaComment", "ProformaComment_proformaId_fkey", "proformaId", "Proforma", "CASCADE"),
  fk("Matter", "Matter_officeId_fkey", "officeId", "Office", "SET NULL"),
  fk("Matter", "Matter_entityId_fkey", "entityId", "LegalEntity", "SET NULL"),
];

const prisma = new PrismaClient();

// Guard: refuse to run anything that is not purely additive.
const FORBIDDEN = /\b(DROP\s+(TABLE|COLUMN|DATABASE|SCHEMA)|TRUNCATE|DELETE\s+FROM)\b/i;

async function run(label, statements) {
  let ok = 0;
  for (const sql of statements) {
    if (FORBIDDEN.test(sql)) {
      console.error("ensure-schema: REFUSING non-additive statement:", sql.slice(0, 80));
      process.exit(1);
    }
    try {
      await prisma.$executeRawUnsafe(sql);
      ok++;
    } catch (e) {
      console.warn(`ensure-schema: ${label} statement skipped -`, e?.message?.split("\n")[0]);
    }
  }
  console.log(`ensure-schema: ${label} - ${ok}/${statements.length} applied`);
}

try {
  await run("tables", tables);
  await run("columns", columns);
  await run("indexes", indexes);
  await run("foreign keys", foreignKeys);
  console.log("ensure-schema: done (additive only, nothing dropped).");
} catch (e) {
  console.error("ensure-schema: fatal", e);
  process.exit(1);
} finally {
  await prisma.$disconnect();
}

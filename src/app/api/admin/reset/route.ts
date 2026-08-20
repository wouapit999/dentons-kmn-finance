/*
 * Dentons KMN ERP
 * Copyright (c) 2026 Bouquet Innovation SA. All rights reserved.
 * Proprietary and confidential. Unauthorised copying, distribution, modification,
 * or use of this file, via any medium, is strictly prohibited.
 */
import { NextRequest } from "next/server";
import { z } from "zod";
import { handle } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { requirePermission, AuthError } from "@/lib/auth";
import { writeAudit } from "@/lib/audit";
import { sendEmail, emailConfigured } from "@/lib/email";
import { SHARED_TABLES, backupSharedTables, clearSharedTables } from "@/lib/reset-shared";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const SUPPORT_EMAIL = "support@bouquet-innovation.net";

// Typed confirmation phrases — the client must echo these exactly.
const CONFIRM = {
  operational: "RESET FINANCIAL DATA",
  org: "RESET USERS AND EMPLOYEES",
} as const;

const bodySchema = z.object({
  scope: z.enum(["operational", "org"]),
  confirm: z.string(),
});

export async function POST(req: NextRequest) {
  return handle(async () => {
    const user = await requirePermission("system:reset");
    const { scope, confirm } = bodySchema.parse(await req.json());
    if (confirm.trim() !== CONFIRM[scope]) throw new AuthError(422, "confirmation_mismatch");

    const companyId = user.companyId;
    const counts: Record<string, number> = {};
    const backup: Record<string, unknown[]> = {};
    // Cross-app: sibling tables (onboarding/HR/screening) in the shared database.
    let sharedCounts: Record<string, number> = {};
    let sharedErrors: Record<string, string> = {};

    if (scope === "operational") {
      // ---- Back up every affected table (company-scoped) ----
      const [
        clients, matters, timeEntries, disbursements, invoices, receipts,
        proformas, journalEntries, vendorBills, vendorPayments, purchaseOrders,
        purchaseRequests, trustLedger, cashTx, bankTx, fixedAssets, depreciation,
        payrollRuns, budgets, tasks, timers, conflictChecks, clientDocuments, notifications,
      ] = await Promise.all([
        prisma.client.findMany({ where: { companyId } }),
        prisma.matter.findMany({ where: { companyId } }),
        prisma.timeEntry.findMany({ where: { companyId } }),
        prisma.disbursement.findMany({ where: { companyId } }),
        prisma.invoice.findMany({ where: { companyId }, include: { lines: true } }),
        prisma.receipt.findMany({ where: { companyId } }),
        prisma.proforma.findMany({ where: { companyId }, include: { lines: true, comments: true } }),
        prisma.journalEntry.findMany({ where: { companyId }, include: { lines: true } }),
        prisma.vendorBill.findMany({ where: { companyId } }),
        prisma.vendorPayment.findMany({ where: { companyId } }),
        prisma.purchaseOrder.findMany({ where: { companyId } }),
        prisma.purchaseRequest.findMany({ where: { companyId } }),
        prisma.trustLedgerEntry.findMany({ where: { companyId } }),
        prisma.cashTransaction.findMany({ where: { companyId } }),
        prisma.bankTransaction.findMany({ where: { companyId } }),
        prisma.fixedAsset.findMany({ where: { companyId } }),
        prisma.depreciationEntry.findMany({ where: { companyId } }),
        prisma.payrollRun.findMany({ where: { companyId }, include: { payslips: true } }),
        prisma.budget.findMany({ where: { companyId }, include: { lines: true } }),
        prisma.task.findMany({ where: { companyId } }),
        prisma.timer.findMany({ where: { companyId } }),
        prisma.conflictCheck.findMany({ where: { companyId } }),
        prisma.clientDocument.findMany({ where: { companyId }, select: { id: true, clientId: true, kind: true, filename: true, mime: true, sizeBytes: true, notes: true, createdAt: true } }),
        prisma.notification.findMany({ where: { companyId } }),
      ]);
      Object.assign(backup, {
        clients, matters, timeEntries, disbursements, invoices, receipts, proformas,
        journalEntries, vendorBills, vendorPayments, purchaseOrders, purchaseRequests,
        trustLedgerEntries: trustLedger, cashTransactions: cashTx, bankTransactions: bankTx,
        fixedAssets, depreciationEntries: depreciation, payrollRuns, budgets, tasks, timers,
        conflictChecks, clientDocuments, notifications,
      });

      // ---- Delete in FK-safe order (children first / before their parents).
      // Cascades handle: InvoiceLine, ProformaLine/Comment, JournalLine, Payslip,
      // BudgetLine, DepreciationEntry, ClientDocument/ConflictCheck, Task children.
      const del = (n: number, label: string) => { counts[label] = n; };
      await prisma.$transaction(async (tx) => {
        del((await tx.notification.deleteMany({ where: { companyId } })).count, "notifications");
        del((await tx.timer.deleteMany({ where: { companyId } })).count, "timers");
        del((await tx.receipt.deleteMany({ where: { companyId } })).count, "receipts");
        del((await tx.proforma.deleteMany({ where: { companyId } })).count, "proformas");
        del((await tx.invoice.deleteMany({ where: { companyId } })).count, "invoices");
        del((await tx.disbursement.deleteMany({ where: { companyId } })).count, "disbursements");
        del((await tx.timeEntry.deleteMany({ where: { companyId } })).count, "timeEntries");
        del((await tx.journalEntry.deleteMany({ where: { companyId } })).count, "journalEntries");
        del((await tx.vendorPayment.deleteMany({ where: { companyId } })).count, "vendorPayments");
        del((await tx.vendorBill.deleteMany({ where: { companyId } })).count, "vendorBills");
        del((await tx.purchaseOrder.deleteMany({ where: { companyId } })).count, "purchaseOrders");
        del((await tx.purchaseRequest.deleteMany({ where: { companyId } })).count, "purchaseRequests");
        del((await tx.trustLedgerEntry.deleteMany({ where: { companyId } })).count, "trustLedgerEntries");
        del((await tx.cashTransaction.deleteMany({ where: { companyId } })).count, "cashTransactions");
        del((await tx.bankTransaction.deleteMany({ where: { companyId } })).count, "bankTransactions");
        del((await tx.depreciationEntry.deleteMany({ where: { companyId } })).count, "depreciationEntries");
        del((await tx.fixedAsset.deleteMany({ where: { companyId } })).count, "fixedAssets");
        del((await tx.payrollRun.deleteMany({ where: { companyId } })).count, "payrollRuns");
        del((await tx.budget.deleteMany({ where: { companyId } })).count, "budgets");
        del((await tx.task.deleteMany({ where: { companyId } })).count, "tasks");
        del((await tx.recurringTaskRule.deleteMany({ where: { companyId } })).count, "recurringTaskRules");
        del((await tx.clientDocument.deleteMany({ where: { companyId } })).count, "clientDocuments");
        del((await tx.conflictCheck.deleteMany({ where: { companyId } })).count, "conflictChecks");
        del((await tx.matter.deleteMany({ where: { companyId } })).count, "matters");
        del((await tx.client.deleteMany({ where: { companyId } })).count, "clients");
      }, { timeout: 30000 });

      // Cross-app: back up then clear onboarding + screening data in the shared DB.
      backup._shared_onboarding_screening = [
        await backupSharedTables(SHARED_TABLES.operational),
      ];
      const shared = await clearSharedTables(SHARED_TABLES.operational);
      sharedCounts = shared.counts;
      sharedErrors = shared.errors;
    } else {
      // ---- ORG reset: archive users & employees (soft), keep the acting admin.
      // A hard delete would break append-only audit history (AuditLog.actor) and
      // payroll integrity (Payslip.employee), so we deactivate instead.
      const [users, employees] = await Promise.all([
        prisma.user.findMany({
          where: { companyId, deletedAt: null, id: { not: user.id } },
          select: { id: true, fullName: true, email: true, status: true },
        }),
        prisma.employee.findMany({ where: { companyId, status: "ACTIVE" } }),
      ]);
      backup.users = users;
      backup.employees = employees;

      const now = new Date();
      await prisma.$transaction(async (tx) => {
        // Revoke sessions of everyone but the acting admin so they are logged out.
        const u = await tx.user.updateMany({
          where: { companyId, id: { not: user.id }, deletedAt: null },
          data: { status: "DISABLED", deletedAt: now },
        });
        counts.usersArchived = u.count;
        await tx.session.deleteMany({ where: { userId: { not: user.id }, user: { companyId } } });
        const e = await tx.employee.updateMany({
          where: { companyId, status: "ACTIVE" },
          data: { status: "INACTIVE" },
        });
        counts.employeesArchived = e.count;
      }, { timeout: 30000 });

      // Cross-app: back up then clear the HR platform's operational records.
      backup._shared_hr = [await backupSharedTables(SHARED_TABLES.org)];
      const shared = await clearSharedTables(SHARED_TABLES.org);
      sharedCounts = shared.counts;
      sharedErrors = shared.errors;
    }

    // ---- Audit ----
    await writeAudit({
      companyId,
      actorId: user.id,
      action: scope === "operational" ? "DB_RESET_OPERATIONAL" : "DB_RESET_ORG",
      entityType: "Company",
      entityId: companyId,
      after: { scope, counts, sharedCounts, sharedErrors },
    });

    // ---- In-app notification to the actor ----
    await prisma.notification.create({
      data: {
        companyId,
        userId: user.id,
        type: "SYSTEM",
        title: scope === "operational" ? "Financial data reset complete" : "Users & employees archived",
        body: `Reset performed by ${user.fullName}. ${Object.entries(counts).map(([k, v]) => `${k}: ${v}`).join(", ")}`,
      },
    });

    // ---- Completion email to support ----
    const total = Object.values(counts).reduce((s, n) => s + n, 0);
    const sharedTotal = Object.values(sharedCounts).reduce((s, n) => s + n, 0);
    const lines = Object.entries(counts).map(([k, v]) => `  - ${k}: ${v}`).join("\n");
    const sharedLines = Object.entries(sharedCounts).map(([k, v]) => `  - ${k}: ${v}`).join("\n") || "  (none)";
    const emailRes = await sendEmail({
      to: SUPPORT_EMAIL,
      subject: `[Dentons KMN ERP] Database reset (${scope}) completed`,
      text:
        `A database reset was performed on the Dentons KMN ERP.\n\n` +
        `Scope: ${scope === "operational" ? "Clients, Matters & Financial data (permanent delete)" : "Users & Employees (archived / deactivated)"}\n` +
        `Performed by: ${user.fullName} <${user.email}>\n` +
        `When: ${new Date().toISOString()}\n\n` +
        `Finance records affected (total ${total}):\n${lines}\n\n` +
        `Shared sibling-app records cleared (${scope === "operational" ? "onboarding & screening" : "HR"}, total ${sharedTotal}):\n${sharedLines}\n\n` +
        (Object.keys(sharedErrors).length ? `Shared-table errors: ${JSON.stringify(sharedErrors)}\n\n` : "") +
        `A JSON backup of all affected records (finance + shared) was generated and downloaded by the operator at reset time.\n`,
    });

    return {
      ok: true,
      scope,
      counts,
      total,
      sharedCounts,
      sharedErrors,
      sharedTotal,
      email: { to: SUPPORT_EMAIL, sent: emailRes.sent, reason: emailRes.reason, configured: emailConfigured() },
      backup, // returned so the client saves it as the pre-delete "archive"
      backupAt: new Date().toISOString(),
    };
  });
}

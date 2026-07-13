// Pinto — the in-app help assistant for Dentons KMN Finance.
// Answers "how do I…" questions about the application and helps employees with
// their day-to-day usage. Grounded in a curated knowledge base + the signed-in
// user's role/permission context, so answers are tailored to what they can do.
import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import type { AiConfig } from "./ai";
import { AuthError } from "./auth";

export interface PintoMessage {
  role: "user" | "assistant";
  content: string;
}

export interface PintoUserContext {
  fullName: string;
  roleKeys: string[];
  permissions: string[];
  locale: string;
  snapshot?: { openTasks: number; overdueTasks: number; unreadNotifications: number };
}

// What Pinto knows about the platform. Concise, task-oriented, kept in sync
// with the modules. Navigation items map to the left sidebar.
const KNOWLEDGE_BASE = `
# Dentons KMN Finance — application guide

The platform is a law-firm finance & operations system. Navigation is the left
sidebar. Language can be switched EN/FR from the top bar. A bell shows notifications.
Access is by role/permission — a user only sees menu items they're allowed to use.

## Clients (menu: Clients)
- "+ New client" opens a 3-step intake WIZARD: (1) Identity — type, name, ID/registration, tax ID; (2) Contact & engagement — email, phone, address, case type, assigned lawyer, AML risk; (3) Documents & review — attach PDF/DOCX/JPG/PNG (scanned for metadata) then Create. A unique client number (CL-YYYY-NNNNN) is generated.
- "Open file" on a client shows the CLIENT FILE: billing totals (billed/collected/outstanding/overdue), unbilled work, trust balance, matters, invoices, and Documents.
- Run conflict check = a 5-question conflict checklist + name-overlap scan; files a Conflict Report. Any "yes" or overlap → POTENTIAL (needs partner review).
- Verify KYC = AI-assisted internet screening (sanctions/adverse media) → risk rating; files a KYC Report. VERIFIED unless HIGH risk. Requires the AI key.
- Creating/editing clients needs the client:manage permission (Partners, Practice Group Heads, Managing Partner, CFO). Everyone with client:read can view.

## Matters (menu: Matters)
- "Open matter" against a client — but only if the client is KYC-VERIFIED and not conflict-BLOCKED. Pick practice area + responsible partner. Needs matter:manage.

## Time & Disbursements (menu: Time, Disbursements)
- Time: log billable/non-billable time by matter and fee earner; value = minutes/60 × rate. Needs time:log (lawyers/partners).
- Disbursements: record matter costs (with vendor). Needs disbursement:log.

## Billing / Invoices (menu: Billing)
- "New invoice": pick a matter, select unbilled time + disbursements, set VAT (19.25%) and withholding tax → creates a DRAFT invoice.
- "Post to GL" makes it official (posts a balanced journal entry). Then "Receipt" records payments (bank/cash/cheque/transfer/mobile). Needs invoice:create/approve; receipts need payment:create.

## Trust (menu: Trust Accounts)
- Segregated client money. Open a trust account per client, then Deposit / Payment / Apply-to-invoice. A client's trust balance can never go negative. Needs trust:manage.

## Accounts Payable (menu: Suppliers, Payables)
- Add suppliers; create vendor bills (expense account + input VAT); Post to GL; Pay. Needs ap:manage / ap:approve.

## Payroll (menu: Employees, Payroll)
- Add employees; create a monthly payroll run (computes CNPS, IRPP/PAYE, CAC, CRTV, Crédit Foncier, FNE); review payslips; Post payroll to the GL. Needs payroll:manage / payroll:post.

## General Ledger (menu: Chart of Accounts, Journal Entry, Trial Balance)
- SYSCOHADA chart of accounts; post balanced double-entry journals; the Trial Balance must always balance. Needs gl:read / gl:post.

## Reports (menu: Reports) & Insights (menu: Insights)
- Reports: Income Statement, Balance Sheet, Aged Receivables/Payables — with CSV export.
- Insights: duplicate-bill detection, cash-flow forecast, overdue alerts.

## Other finance (menu: Cash, Bank, Procurement, Fixed Assets, Budgets)
- Cash: petty-cash accounts + movements. Bank: accounts + reconciliation. Procurement: purchase requests → approval → order. Fixed Assets: register, depreciation, disposal. Budgets: annual budgets with variance vs actuals.

## Tasks (menu: Tasks — available to everyone)
- Create/assign tasks, subtasks, dependencies, comments, attachments, reminders, recurring rules. Court-filing tasks are auto-set CRITICAL. Complete is blocked until dependencies/subtasks are done. Notifications via the bell.

## AI Assistant (menu: AI Assistant)
- Ask finance questions in plain language ("what's our net result?"); OCR an invoice image/PDF to pre-fill a bill. Requires the AI key (set by IT Admin under AI Settings on that page).

## Security (menu: Security — everyone) and Password Management (admins)
- Security Settings: change your password (min 12 chars incl. upper/lower/number/special; can't reuse old ones or breached ones), enable 2FA (scan the key into an authenticator app), set a recovery email, view/close active sessions, see your sign-in history.
- Password Management (IT Admin / Managing Partner): reset passwords, force change at next login, lock/unlock accounts, reset 2FA, set the password policy.

## Admin (menu: Users, Roles)
- Users (IT Admin): create/deactivate users, assign/remove roles, reset passwords.
- Roles: view the 13 roles and their permissions.
`;

export function pintoConfigured(cfg?: AiConfig): boolean {
  return !!cfg?.apiKey;
}

export async function chatPinto(
  cfg: AiConfig,
  messages: PintoMessage[],
  user: PintoUserContext,
): Promise<string> {
  if (!cfg.apiKey) throw new AuthError(503, "pinto_not_configured");
  const client = new Anthropic({ apiKey: cfg.apiKey });

  const lang = user.locale === "fr" ? "French" : "English";
  const snap = user.snapshot
    ? `Today for ${user.fullName}: ${user.snapshot.openTasks} open tasks (${user.snapshot.overdueTasks} overdue), ${user.snapshot.unreadNotifications} unread notifications.`
    : "";

  const system =
    "You are Pinto, the friendly in-app assistant for Dentons KMN, a law firm in Cameroon using this finance & operations platform. " +
    "Help employees learn and use the application and answer their day-to-day questions. " +
    "Give concise, practical, step-by-step guidance that references the actual menus and buttons. " +
    `Reply in ${lang}. ` +
    "Tailor answers to what THIS user can do: only suggest actions their permissions allow; if a task needs a permission they lack, say who to ask (e.g. a Partner or the IT Administrator). " +
    "If a question is about firm HR/policy or something outside the app that you don't actually know, say so plainly and suggest the right person to ask — never invent firm policies, figures, or legal advice. " +
    "Keep replies short unless asked for detail. Use numbered steps for how-to answers.\n\n" +
    `The signed-in user is ${user.fullName}. Their roles: ${user.roleKeys.join(", ") || "none"}. ` +
    `Their permissions: ${user.permissions.join(", ")}.\n${snap}\n\n` +
    `=== APPLICATION KNOWLEDGE BASE ===\n${KNOWLEDGE_BASE}`;

  const msg = await client.messages.create({
    model: cfg.model,
    max_tokens: 1024,
    system,
    messages: messages.slice(-12).map((m) => ({ role: m.role, content: m.content })),
  });
  const block = msg.content.find((b) => b.type === "text");
  return block && block.type === "text" ? block.text : "";
}

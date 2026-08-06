/*
 * Dentons KMN ERP
 * Copyright (c) 2026 Bouquet Innovation SA. All rights reserved.
 * Proprietary and confidential. Unauthorised copying, distribution, modification,
 * or use of this file, via any medium, is strictly prohibited.
 */
// Content for the two PDFs. Plain text with a tiny markdown subset:
//   #/##/###  headings   |  - bullets  |  1. numbered  |  **bold**
//   > note callout        |  @RESULT  UAT pass/fail row  |  [PAGEBREAK]

export const UAT_MD = `
# 1. Introduction

This User Acceptance Testing (UAT) book lets Dentons KMN staff confirm that every module of the Dentons KMN ERP works as expected before and during live use. Each test lists the role that should perform it, the steps to follow, and the expected result. Mark each test **Pass**, **Fail**, or **Blocked**, and record any difference in the Notes line.

**Application URL:** https://dentons-kmn-finance-three.vercel.app

## How to use this book
- Work top to bottom. Some later tests rely on data created in earlier ones (for example, you must create a client before you can open a matter).
- Use the role shown for each test. If you do not have that role, ask the IT Administrator to assign it, or ask a colleague who has it.
- For every test, tick one box and sign the Tester / Date fields.
- If a test fails, record what actually happened in the Notes line and log it in the Defect Log at the end (Section 20).
- After a change is deployed, always refresh the page with Ctrl+Shift+R (or Ctrl+F5) so you are testing the latest version.

## Test environment and accounts
> The following seeded accounts exist for testing. Change all passwords before real use. The temporary password issued to migrated staff (Welcome@DKMN2026) must be rotated.

- IT Administrator - admin@dentonskmn.local - password: ChangeMe123!
- Chief Finance Officer (CFO) - cfo@dentonskmn.local - password: ChangeMe123!
- Additional staff accounts were migrated from the previous sites and use their own emails.

## Result legend
- **Pass** - the app behaved exactly as the Expected result describes.
- **Fail** - the result differed; describe it in Notes and log a defect.
- **Blocked** - the test could not be run (missing data, missing access, dependency failed).

[PAGEBREAK]
# 2. Access, Security and Sessions

### UAT-SEC-01 - Sign in with valid credentials
**Role:** Any user. **Priority:** High.
**Steps:**
1. Open the application URL.
2. Enter your email and password.
3. Click Sign in.
**Expected result:** You land on the Executive Dashboard and see the left sidebar with only the menus your role allows.
@RESULT

### UAT-SEC-02 - Sign in with a wrong password
**Role:** Any user.
**Steps:**
1. Enter a valid email and an incorrect password. 2. Click Sign in.
**Expected result:** A clear error is shown and you are not signed in. Repeated failures temporarily lock the account.
@RESULT

### UAT-SEC-03 - Change your own password
**Role:** Any user.
**Steps:**
1. Open Security from the sidebar. 2. Use Change password. 3. Enter your current password and a new one of at least 12 characters with upper case, lower case, a number and a symbol.
**Expected result:** Password is accepted. A weak, previously used, or known-breached password is rejected with a reason.
@RESULT

### UAT-SEC-04 - Enable two-factor authentication (2FA)
**Role:** Any user.
**Steps:**
1. Security -> enable 2FA. 2. Scan the key into an authenticator app (Google Authenticator, Microsoft Authenticator, etc.). 3. Enter the 6-digit code to confirm.
**Expected result:** 2FA is enabled. On the next sign-in you are asked for a code after your password.
@RESULT

### UAT-SEC-05 - Review and close active sessions
**Role:** Any user.
**Steps:**
1. Security -> view active sessions / sign-in history. 2. Close a session other than the current one.
**Expected result:** The session list and sign-in history are shown; closing a session revokes it.
@RESULT

[PAGEBREAK]
# 3. Users, Roles and Administration

### UAT-ADM-01 - Create a new user
**Role:** IT Administrator. **Priority:** High.
**Steps:**
1. Open Users. 2. Click + New user. 3. Enter name, email and assign one or more roles. 4. Save.
**Expected result:** The user is created and appears in the list. The action is written to the audit log.
@RESULT

### UAT-ADM-02 - Add and remove a role from a user
**Role:** IT Administrator.
**Steps:**
1. Users -> open a user -> Modify roles. 2. Add a role, save. 3. Remove a role, save.
**Expected result:** Role changes take effect; the user's available menus change accordingly at their next page load.
@RESULT

### UAT-ADM-03 - Reset a user password / force change
**Role:** IT Administrator.
**Steps:**
1. Open Password Management (Security admin). 2. Reset a user's password and/or set Force change at next login.
**Expected result:** The user is required to set a new password at next sign-in. Action is audited.
@RESULT

### UAT-ADM-04 - Lock and unlock an account
**Role:** IT Administrator.
**Steps:**
1. Password Management -> lock a user account. 2. Confirm they cannot sign in. 3. Unlock.
**Expected result:** Locked user is blocked from signing in until unlocked.
@RESULT

### UAT-ADM-05 - Roles are read-only reference
**Role:** IT Administrator.
**Steps:** 1. Open Roles and review the 13 system roles and their permissions.
**Expected result:** The list of roles and their permission sets is displayed.
@RESULT

### UAT-ADM-06 - Add the Anthropic AI key
**Role:** IT Administrator.
**Steps:** 1. Open AI Assistant -> AI Settings. 2. Paste the Anthropic API key and save.
**Expected result:** The key is stored (encrypted) and AI features (Assistant, OCR, Pinto) become available.
@RESULT

[PAGEBREAK]
# 4. Clients, KYC and Conflicts

### UAT-CLI-01 - Create a client with the intake wizard
**Role:** Lawyer / Partner / CFO (client management rights). **Priority:** High.
**Steps:**
1. Open Clients -> + New client. 2. Step 1: choose type, enter name and ID/registration and tax ID. 3. Step 2: contact, address, case type, assigned lawyer, AML risk. 4. Step 3: attach a document (PDF/DOCX/JPG/PNG) and click Create.
**Expected result:** The client is created with a unique number in the form CL-YYYY-NNNNN and appears in the list.
@RESULT

### UAT-CLI-02 - Run a conflict check
**Role:** Client management rights.
**Steps:** 1. Open the client file. 2. Run conflict check and answer the questionnaire. 3. Submit.
**Expected result:** A Conflict Report is filed. Any "yes" answer or a name overlap marks the client POTENTIAL (needs partner review).
@RESULT

### UAT-CLI-03 - Verify KYC (AI screening)
**Role:** Client management rights. Requires the AI key.
**Steps:** 1. Open the client file. 2. Click Verify KYC.
**Expected result:** An internet screening runs and files a KYC Report with a risk rating; the client becomes VERIFIED unless HIGH risk.
@RESULT

### UAT-CLI-04 - Store and read client documents
**Role:** Lawyer writes; other roles read-only.
**Steps:** 1. Open the client file -> Documents. 2. As a lawyer, upload a document. 3. As a non-lawyer, confirm you can view but not upload.
**Expected result:** Lawyers can add documents; read-only roles can view but see no upload control.
@RESULT

### UAT-CLI-05 - Portfolio view
**Role:** Client read.
**Steps:** 1. Open the client file and review billing totals, matters, invoices and trust balance.
**Expected result:** The portfolio figures display and reconcile with the client's records.
@RESULT

[PAGEBREAK]
# 5. Matters

### UAT-MAT-01 - Open a matter for a verified client
**Role:** Partner / CFO (matter management). **Priority:** High.
**Steps:**
1. Open Matters -> + Open matter. 2. Select a KYC-verified client. 3. Leave the auto-assigned Code as shown, enter the matter name, pick practice area and responsible partner. 4. Click Create.
**Expected result:** The matter is created with an automatic code (M-YYYY-NNNNN) and appears in the list.
@RESULT

### UAT-MAT-02 - Ineligible clients are shown but blocked
**Role:** Matter management.
**Steps:** 1. Open + Open matter. 2. Look at the Client list.
**Expected result:** KYC-pending or conflict-blocked clients appear greyed-out with the reason; only verified clients can be selected.
@RESULT

### UAT-MAT-03 - Matter code is assigned automatically
**Role:** Matter management.
**Steps:** 1. Open + Open matter and look at the Code field.
**Expected result:** The Code is read-only and pre-filled with the next free code; you cannot type a duplicate.
@RESULT

### UAT-MAT-04 - Close a matter
**Role:** Matter management.
**Steps:** 1. In the Matters table, click Close on an open matter.
**Expected result:** The matter status changes to CLOSED. The change is audited.
@RESULT

### UAT-MAT-05 - Delete a matter with no activity
**Role:** Matter management.
**Steps:** 1. Create a throwaway matter. 2. Click Delete and confirm.
**Expected result:** A matter with no time, disbursements, invoices or tasks is removed. A matter that has activity is refused with a message to close it instead.
@RESULT

[PAGEBREAK]
# 6. Time and Disbursements

### UAT-TIM-01 - Log billable time
**Role:** Lawyer / Partner (time:log). **Priority:** High.
**Steps:** 1. Open Time Entries. 2. Pick a matter, fee earner, date, minutes and rate; set billable = Yes; add a narrative. 3. Submit.
**Expected result:** The entry is saved and its value equals minutes / 60 x rate; the billable summary updates.
@RESULT

### UAT-TIM-02 - Read-only role cannot log time
**Role:** A role without time:log (e.g. Auditor).
**Steps:** 1. Open Time Entries.
**Expected result:** The time entry form is not shown; only the list is visible.
@RESULT

### UAT-DIS-01 - Record a disbursement
**Role:** disbursement:log.
**Steps:** 1. Open Disbursements. 2. Pick a matter, enter description, amount, vendor, billable flag. 3. Submit.
**Expected result:** The disbursement is saved and included in the billable total.
@RESULT

[PAGEBREAK]
# 7. Billing and Accounts Receivable

### UAT-BIL-01 - Create a draft invoice
**Role:** Finance Officer / Finance Manager / CFO (invoice:create). **Priority:** High.
**Steps:**
1. Open Billing -> + New invoice. 2. Select a matter. 3. Tick the unbilled time and disbursements to include. 4. Set VAT (19.25%) and any withholding tax. 5. Click Create.
**Expected result:** A DRAFT invoice is created; the totals match (subtotal + VAT - WHT); billed items are locked from re-use.
@RESULT

### UAT-BIL-02 - Post an invoice to the ledger
**Role:** invoice:approve.
**Steps:** 1. In the invoice list, click Post to GL on a draft.
**Expected result:** A balanced journal entry is posted; the invoice becomes POSTED and the Trial Balance still balances.
@RESULT

### UAT-BIL-03 - Record a receipt
**Role:** payment:create.
**Steps:** 1. On a posted invoice, click Receipt. 2. Enter amount, method (bank/cash/cheque/transfer/mobile) and reference. 3. Save.
**Expected result:** The payment posts; the invoice moves to PART-PAID or PAID; the outstanding balance updates.
@RESULT

### UAT-BIL-04 - Overpayment is blocked (negative test)
**Role:** payment:create.
**Steps:** 1. On a posted invoice, enter a receipt larger than the outstanding amount. 2. Save.
**Expected result:** The system rejects the receipt with an error; no payment is recorded.
@RESULT

### UAT-BIL-05 - Actions hidden without rights (negative test)
**Role:** A read-only role (e.g. Auditor).
**Steps:** 1. Open Billing.
**Expected result:** No + New invoice, Post to GL or Receipt buttons appear; the page does not error.
@RESULT

[PAGEBREAK]
# 8. Trust Accounting

### UAT-TRU-01 - Open a trust account
**Role:** trust:manage. **Priority:** High.
**Steps:** 1. Open Trust Accounts -> + Open trust account. 2. Pick a client. 3. Create.
**Expected result:** A trust account is created for the client.
@RESULT

### UAT-TRU-02 - Deposit and pay from trust
**Role:** trust:manage.
**Steps:** 1. Open the trust account. 2. Record a Deposit, then a Payment.
**Expected result:** Balances update; each movement posts to the ledger.
@RESULT

### UAT-TRU-03 - Trust balance cannot go negative (negative test)
**Role:** trust:manage.
**Steps:** 1. Attempt a Payment larger than the trust balance.
**Expected result:** The withdrawal is rejected; the balance never goes below zero.
@RESULT

### UAT-TRU-04 - Apply trust funds to an invoice
**Role:** trust:manage.
**Steps:** 1. In the trust account, choose Apply-to-invoice and select an open invoice.
**Expected result:** One balanced entry settles the invoice; the invoice moves toward PAID and the trial balance ties.
@RESULT

[PAGEBREAK]
# 9. Accounts Payable

### UAT-AP-01 - Add a supplier
**Role:** ap:manage.
**Steps:** 1. Open Suppliers -> + New supplier. 2. Enter details and save.
**Expected result:** The supplier is created and selectable when creating bills.
@RESULT

### UAT-AP-02 - Create and post a vendor bill
**Role:** ap:manage (create), ap:approve (post).
**Steps:** 1. Open Payables -> + New bill. 2. Pick a supplier, expense account and amount incl. input VAT. 3. Create, then Post to GL.
**Expected result:** The bill posts a balanced entry (expense + input VAT = payables).
@RESULT

### UAT-AP-03 - Pay a bill and block overpayment (negative test)
**Role:** ap:approve.
**Steps:** 1. Pay a posted bill fully. 2. Attempt to pay again beyond the balance.
**Expected result:** First payment succeeds (part -> paid); overpayment is rejected.
@RESULT

[PAGEBREAK]
# 10. Cash and Banking

### UAT-CSH-01 - Create a petty-cash account and movement
**Role:** cash:manage.
**Steps:** 1. Open Cash -> + New. 2. Record a cash-in then a cash-out (choose the counterpart account).
**Expected result:** Balance updates; an overdraw is rejected (non-negative guard).
@RESULT

### UAT-BNK-01 - Create a bank account and transaction
**Role:** bank:manage.
**Steps:** 1. Open Banking -> + New. 2. Record a charge and an interest/transfer transaction.
**Expected result:** Book balance updates correctly and each transaction posts to the ledger.
@RESULT

### UAT-BNK-02 - Reconcile a bank account
**Role:** bank:reconcile.
**Steps:** 1. Open a bank account -> Reconcile. 2. Tick cleared items.
**Expected result:** Book vs cleared vs unreconciled figures update as you tick items.
@RESULT

[PAGEBREAK]
# 11. Procurement

### UAT-PRO-01 - Raise a purchase request
**Role:** procure:request.
**Steps:** 1. Open Procurement -> + New PR. 2. Enter details and submit.
**Expected result:** The request is created and awaits approval.
@RESULT

### UAT-PRO-02 - Segregation of duties (negative test)
**Role:** The requester.
**Steps:** 1. Attempt to approve your own purchase request.
**Expected result:** Self-approval is rejected (a requester cannot approve their own request).
@RESULT

### UAT-PRO-03 - Approve and issue a purchase order
**Role:** procure:approve.
**Steps:** 1. Approve a colleague's request; issue the PO.
**Expected result:** The request is approved and a purchase order is issued.
@RESULT

[PAGEBREAK]
# 12. Fixed Assets

### UAT-FA-01 - Register an asset
**Role:** asset:manage.
**Steps:** 1. Open Fixed Assets -> + New. 2. Enter cost, salvage, useful life and asset account. 3. Create.
**Expected result:** The asset is registered with the correct opening values.
@RESULT

### UAT-FA-02 - Run depreciation
**Role:** asset:post.
**Steps:** 1. Click Depreciate and choose the period.
**Expected result:** A straight-line entry posts (depreciation expense = accumulated depreciation) and stops at cost minus salvage.
@RESULT

### UAT-FA-03 - Dispose of an asset
**Role:** asset:manage.
**Steps:** 1. Choose Dispose and enter proceeds.
**Expected result:** Gain or loss is recognised; the trial balance ties after disposal.
@RESULT

[PAGEBREAK]
# 13. Budgeting

### UAT-BUD-01 - Create an annual budget
**Role:** budget:manage.
**Steps:** 1. Open Budgets -> + New. 2. Add account lines with annual amounts. 3. Create.
**Expected result:** The budget is saved with its account lines.
@RESULT

### UAT-BUD-02 - View budget-vs-actual variance
**Role:** budget:read.
**Steps:** 1. Open a budget -> View.
**Expected result:** Actuals are pulled from posted GL entries; favourable/unfavourable variance and % used are shown per account.
@RESULT

[PAGEBREAK]
# 14. Payroll and Cameroon Tax

### UAT-PAY-01 - Add an employee
**Role:** payroll:manage.
**Steps:** 1. Open Employees -> + New. 2. Enter the employee details and save.
**Expected result:** The employee is added and available for payroll runs.
@RESULT

### UAT-PAY-02 - Create a payroll run
**Role:** payroll:manage. **Priority:** High.
**Steps:** 1. Open Payroll -> create a run for a period.
**Expected result:** A payslip is computed per employee with CNPS, IRPP/PAYE, CAC, CRTV/RAV, Credit Foncier and FNE; run totals are shown.
@RESULT

### UAT-PAY-03 - Post the payroll journal
**Role:** payroll:post.
**Steps:** 1. Post the run to the GL. 2. Attempt to post the same run twice (negative).
**Expected result:** A balanced entry posts; a second post of the same run is rejected.
@RESULT

[PAGEBREAK]
# 15. General Ledger

### UAT-GL-01 - Create a GL account
**Role:** gl:manage.
**Steps:** 1. Open Chart of Accounts -> + New account. 2. Enter code, name and type. 3. Create.
**Expected result:** The account appears in the SYSCOHADA chart of accounts.
@RESULT

### UAT-GL-02 - Post a balanced journal entry
**Role:** gl:post. **Priority:** High.
**Steps:** 1. Open Journal Entry. 2. Choose journal and open period. 3. Enter balanced debit and credit lines. 4. Post.
**Expected result:** The entry posts only when debits equal credits, the period is open and accounts are postable.
@RESULT

### UAT-GL-03 - Unbalanced entry is rejected (negative test)
**Role:** gl:post.
**Steps:** 1. Enter lines where debits do not equal credits. 2. Attempt to post.
**Expected result:** The Post button stays disabled / the entry is rejected until balanced.
@RESULT

### UAT-GL-04 - Trial balance ties
**Role:** gl:read.
**Steps:** 1. Open Trial Balance.
**Expected result:** Total debits equal total credits.
@RESULT

[PAGEBREAK]
# 16. Reporting and Insights

### UAT-REP-01 - Income statement and balance sheet
**Role:** report:read.
**Steps:** 1. Open Reports -> Income Statement, then Balance Sheet.
**Expected result:** Both are computed from posted ledger lines; the balance sheet balances (Assets = Liabilities + Equity incl. period result).
@RESULT

### UAT-REP-02 - Aged receivables and payables
**Role:** report:read.
**Steps:** 1. Open Reports -> Aged Receivables and Aged Payables.
**Expected result:** Outstanding items are bucketed 0-30 / 31-60 / 61-90 / 90+ days.
@RESULT

### UAT-REP-03 - Export to CSV
**Role:** report:export.
**Steps:** 1. On a report, click Export.
**Expected result:** A CSV downloads with the report data. (Roles without export rights do not see the button.)
@RESULT

### UAT-INS-01 - Insights
**Role:** report:read.
**Steps:** 1. Open Insights.
**Expected result:** Duplicate-bill detection, cash-flow forecast and overdue alerts are shown from live data.
@RESULT

[PAGEBREAK]
# 17. Tasks

### UAT-TSK-01 - Create and assign a task
**Role:** Any user. **Priority:** High.
**Steps:** 1. Open Tasks -> + New task. 2. Enter title, priority, category, due date and assignees. 3. Save.
**Expected result:** The task is created; assignees are notified (bell icon).
@RESULT

### UAT-TSK-02 - Dependencies and completion guard (negative test)
**Role:** Task creator/assignee.
**Steps:** 1. Create task B that depends on task A. 2. Attempt to complete B while A is open.
**Expected result:** Completion is blocked until the dependency (and any subtasks) are done.
@RESULT

### UAT-TSK-03 - Court-filing task forced CRITICAL
**Role:** Any user.
**Steps:** 1. Create a task in the Court Filing category.
**Expected result:** Its priority is automatically set to CRITICAL.
@RESULT

### UAT-TSK-04 - Private task visibility
**Role:** Two different users.
**Steps:** 1. User A creates a PRIVATE task. 2. User B (not assigned) looks for it.
**Expected result:** User B cannot see the private task in the list or open it directly.
@RESULT

[PAGEBREAK]
# 18. AI Assistant and Pinto

### UAT-AI-01 - Natural-language finance question
**Role:** report:read. Requires the AI key.
**Steps:** 1. Open AI Assistant. 2. Ask, e.g., "What is our net result this year?"
**Expected result:** A grounded answer based on the firm's real figures is returned.
@RESULT

### UAT-AI-02 - Invoice OCR
**Role:** ap:manage. Requires the AI key.
**Steps:** 1. AI Assistant -> OCR an invoice image or PDF.
**Expected result:** Key fields are extracted to help pre-fill a bill.
@RESULT

### UAT-PIN-01 - Ask Pinto how to use the app
**Role:** Any user.
**Steps:** 1. Click the Pinto button (bottom-right). 2. Ask, e.g., "How do I raise an invoice?"
**Expected result:** Step-by-step guidance tailored to your permissions.
@RESULT

### UAT-PIN-02 - Legal question (Cameroon / CEMAC / OHADA)
**Role:** Any user.
**Steps:** 1. Ask Pinto a legal question, e.g. "Minimum share capital for an SARL under OHADA?"
**Expected result:** An answer with sources (Rule / Source / Application) and a note that it is general information, not formal advice.
@RESULT

### UAT-PIN-03 - Generate a document (PDF / DOCX)
**Role:** Any user.
**Steps:** 1. Type a request in Pinto, e.g. "a jurisprudence note on directors' liability under OHADA". 2. Click PDF or DOCX below the message box.
**Expected result:** A formatted document downloads in the chosen format.
@RESULT

### UAT-PIN-04 - Co-working: create a task via Pinto
**Role:** Any user.
**Steps:** 1. Ask Pinto to "create a task titled Review contract, high priority, due next Friday".
**Expected result:** Pinto creates the task and returns a link; it is recorded in the audit log.
@RESULT

### UAT-PIN-05 - Pinto refuses financial / IT actions (negative test)
**Role:** Any user.
**Steps:** 1. Ask Pinto to "post invoice INV-1 and pay it".
**Expected result:** Pinto declines the money-moving action and points you to the right menu or person.
@RESULT

[PAGEBREAK]
# 19. General and Cross-cutting

### UAT-GEN-01 - Switch language EN / FR
**Role:** Any user.
**Steps:** 1. Use the EN / FR switch in the top bar.
**Expected result:** The interface language changes immediately without signing out.
@RESULT

### UAT-GEN-02 - Dark / light theme
**Role:** Any user.
**Steps:** 1. Toggle the theme button in the top bar.
**Expected result:** The interface switches between light and dark.
@RESULT

### UAT-GEN-03 - Menu reflects permissions
**Role:** Compare two roles.
**Steps:** 1. Sign in as a full role, then as a read-only role.
**Expected result:** Each role sees only the menus and actions their permissions allow; no page shows an error.
@RESULT

### UAT-GEN-04 - Audit log records actions
**Role:** audit:read.
**Steps:** 1. Open Audit after performing several actions.
**Expected result:** Material actions (who / when / what) are listed and cannot be edited.
@RESULT

[PAGEBREAK]
# 20. Defect Log

Record every failed or blocked test here. Copy this block as many times as needed.

- **Defect ID:** ___________   **Related test:** ___________   **Date:** __________
- **Module:** ____________________   **Severity:** Critical / High / Medium / Low
- **Description (what happened vs expected):** _____________________________________________
- **Steps to reproduce:** _______________________________________________________________
- **Reported by:** ________________   **Status:** Open / Fixed / Retested / Closed
---
- **Defect ID:** ___________   **Related test:** ___________   **Date:** __________
- **Module:** ____________________   **Severity:** Critical / High / Medium / Low
- **Description:** _______________________________________________________________________
- **Steps to reproduce:** _______________________________________________________________
- **Reported by:** ________________   **Status:** Open / Fixed / Retested / Closed
---
- **Defect ID:** ___________   **Related test:** ___________   **Date:** __________
- **Module:** ____________________   **Severity:** Critical / High / Medium / Low
- **Description:** _______________________________________________________________________
- **Steps to reproduce:** _______________________________________________________________
- **Reported by:** ________________   **Status:** Open / Fixed / Retested / Closed

[PAGEBREAK]
# 21. UAT Sign-off

By signing below, the tester confirms the modules listed in this book have been tested and the results recorded.

**Overall outcome:**   Accepted / Accepted with defects / Rejected

- Tester name: ______________________________   Role: ___________________
- Signature: ________________________________   Date: ___________________

- Reviewed by (Managing Partner / CFO): ______________________   Date: ____________

- IT Administrator: ___________________________________________   Date: ____________
`;

export const GUIDE_MD = `
# Welcome to Dentons KMN ERP

Dentons KMN ERP is the firm's finance and operations system: accounting, client and matter management, billing, trust money, payroll, reporting, tasks, and an AI assistant named Pinto. This guide explains, module by module, how to do the day-to-day work.

**Where to sign in:** https://dentons-kmn-finance-three.vercel.app

> Tip: after any update, refresh the page with Ctrl+Shift+R so you always see the latest version.

## Getting started
1. Open the application URL and sign in with your email and password.
2. If prompted, set a new password (at least 12 characters, with upper case, lower case, a number and a symbol).
3. You arrive at the Executive Dashboard.

## Finding your way around
- The **left sidebar** is the main menu. You only see the items your role allows - if something is missing, you may not have the permission for it (ask the IT Administrator).
- The **top bar** has notifications (the bell), the EN / FR language switch, and the light / dark theme toggle.
- The **Pinto button** (bottom-right, on every page) opens the assistant for help, legal questions, documents and quick actions.

## Your account and security
- Open **Security** to change your password, turn on two-factor authentication (2FA), set a recovery email, review your sign-in history, and close active sessions.
- Turning on 2FA adds a 6-digit code from an authenticator app after your password - recommended for anyone who approves payments.

[PAGEBREAK]
# Clients and matters

## Create a client
1. Open **Clients** -> **+ New client**.
2. Work through the three steps: identity (type, name, ID/registration, tax ID); contact and engagement (email, phone, address, case type, assigned lawyer, AML risk); documents and review (attach files, then Create).
3. The client gets a unique number like CL-2026-00001.

## Verify KYC and check conflicts
- In the client file, click **Verify KYC** to run an automatic internet screening; a KYC report is filed and the client becomes Verified unless flagged high-risk.
- Click **Run conflict check** and answer the short questionnaire; a conflict report is filed. Any concern marks the client for partner review.
> A matter can only be opened for a client who is KYC-verified and not conflict-blocked.

## Client documents and portfolio
- Lawyers can upload documents to the client file; other roles can read them.
- The client file also shows billing totals, matters, invoices and trust balance.

## Open a matter
1. Open **Matters** -> **+ Open matter**.
2. Choose a verified client (ineligible clients appear greyed-out with the reason).
3. The **matter code is assigned automatically** - you do not type it. Enter the matter name, pick the practice area and responsible partner, then Create.
4. Use **Close** to close a finished matter, or **Delete** to remove one opened in error (only while it has no time, bills, invoices or tasks).

[PAGEBREAK]
# Time, disbursements and billing

## Log time
1. Open **Time Entries**.
2. Choose the matter and fee earner, enter the date, minutes and rate, mark billable, add a narrative, and submit. The value is minutes / 60 x rate.

## Record disbursements
1. Open **Disbursements**, pick the matter, enter the description, amount and vendor, and submit.

## Raise an invoice
1. Open **Billing** -> **+ New invoice**.
2. Select the matter, then tick the unbilled time and disbursements to include.
3. Set VAT (19.25%) and any withholding tax. Click **Create** - this makes a DRAFT.
4. Click **Post to GL** to make it official (it posts a balanced accounting entry).
5. When the client pays, click **Receipt**, enter the amount, method and reference. The invoice moves to part-paid or paid.
> If a button (New invoice, Post, Receipt) is not visible, your role does not include that step - ask a colleague who has the right, or the IT Administrator.

[PAGEBREAK]
# Trust accounting

Trust (client) money is kept separate from the firm's own funds.
1. Open **Trust Accounts** -> **+ Open trust account** and pick the client.
2. Open the account to record a **Deposit**, a **Payment**, or **Apply-to-invoice** (use held funds to settle a firm invoice).
> A client's trust balance can never go negative - a payment larger than the balance is rejected.

# Suppliers and payables
1. Add a supplier under **Suppliers**.
2. Open **Payables** -> **+ New bill**, choose the supplier, expense account and amount (with input VAT), then Create and **Post to GL**.
3. Use **Pay** to settle a posted bill. Overpayment is blocked.

# Cash and banking
- **Cash**: create petty-cash accounts and record cash in/out (a movement cannot overdraw the account).
- **Banking**: create bank accounts, record charges/interest/transfers, and use **Reconcile** to tick cleared items and compare book vs cleared balances.

# Procurement
1. Raise a purchase request under **Procurement**.
2. A different person approves it (you cannot approve your own request) and issues the purchase order.

[PAGEBREAK]
# Fixed assets, budgeting and payroll

## Fixed assets
1. Open **Fixed Assets** -> **+ New** and enter cost, salvage value, useful life and the asset account.
2. Use **Depreciate** to run straight-line depreciation for a period, and **Dispose** to sell/retire an asset (gain or loss is calculated).

## Budgeting
1. Open **Budgets** -> **+ New**, add account lines with annual amounts, and Create.
2. Open a budget and choose **View** to see budget-vs-actual variance drawn from posted entries.

## Payroll (Cameroon)
1. Add employees under **Employees**.
2. Open **Payroll** and create a run for the month. Each payslip computes CNPS, IRPP/PAYE, CAC, CRTV/RAV, Credit Foncier and FNE automatically.
3. Review the payslips and run totals, then **Post** the payroll journal to the ledger.

[PAGEBREAK]
# General ledger, reports and insights

## General ledger
- **Chart of Accounts**: view and (with rights) add accounts (SYSCOHADA-based).
- **Journal Entry**: post manual entries - the Post button only enables when debits equal credits, the period is open and the accounts are postable.
- **Trial Balance**: always ties (total debits = total credits).

## Reports
- **Income Statement**, **Balance Sheet**, **Aged Receivables** and **Aged Payables**, all from posted figures.
- Use **Export** to download a report as CSV (if your role includes export rights).

## Insights
- Automatic duplicate-bill detection, a cash-flow forecast, and overdue alerts from your live data.

# Tasks
1. Open **Tasks** -> **+ New task**. Enter the title, priority, category, due date and assignees.
2. Use subtasks, dependencies, comments, attachments, reminders and recurring rules as needed.
3. Court-filing tasks are automatically set to CRITICAL. A task cannot be completed until its dependencies and subtasks are done. Notifications appear under the bell.

[PAGEBREAK]
# Pinto - your AI assistant

Click the **Pinto** button (bottom-right) on any page. Pinto can:
- **Explain the app** - "How do I run a conflict check?" - with steps tailored to what you are allowed to do.
- **Answer legal questions** for Cameroon, the CEMAC region and OHADA, with sources. This is general legal information, not formal advice - always confirm against the official text and with a qualified lawyer.
- **Create documents** - describe what you need (a memo, jurisprudence note, contract, letter), then click **PDF** or **DOCX** under the message box to download it. Lawyers can also ask Pinto to file a document straight into a client's record.
- **Do things for you** - create, assign or comment on tasks, all under your own permissions and recorded in the audit log.
> Pinto will not perform financial actions (invoices, payments, payroll, ledger) or IT/administration actions. It will explain how, and point you to the right menu or person.

# Everyday tips
- **Language:** switch EN / FR any time from the top bar - no need to sign out.
- **Theme:** toggle light / dark from the top bar.
- **Missing a menu or button?** It is controlled by your role. Ask the IT Administrator if you need more access.
- **Something looks wrong after an update?** Refresh with Ctrl+Shift+R.
- **Not sure how to do something?** Ask Pinto first.

# Getting help
- For access or password problems, contact your **IT Administrator**.
- For finance approvals and policy, contact the **CFO** or a **Partner**.
- For how-to questions, ask **Pinto** in the app.

[PAGEBREAK]
# Glossary

- **KYC** - Know Your Customer: the identity and risk checks done before acting for a client.
- **AML** - Anti-Money-Laundering risk rating on a client.
- **Conflict check** - confirming the firm can act without a conflict of interest.
- **Matter** - a specific piece of work/case for a client.
- **Disbursement** - a cost paid on the client's behalf, recovered on the invoice.
- **VAT** - Value Added Tax (19.25% in Cameroon).
- **WHT** - Withholding Tax deducted at source.
- **GL** - General Ledger, the firm's central double-entry accounts.
- **Trial Balance** - a report where total debits equal total credits.
- **Trust account** - segregated client money, never mixed with firm funds.
- **SYSCOHADA** - the OHADA regional accounting framework used for the chart of accounts.
- **RBAC** - Role-Based Access Control: what each role is allowed to do.
- **Audit log** - the permanent record of who did what, and when.
`;

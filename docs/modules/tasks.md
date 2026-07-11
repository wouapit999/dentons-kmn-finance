# Tasks Module — Complete Blueprint

> Target: the existing Dentons KMN Finance codebase (Next.js 14 App Router, Prisma,
> Zod, React Query, EN/FR i18n, append-only `AuditLog`, company-scoped tenancy).
> This module is **available to every authenticated user regardless of role** —
> access is governed by *visibility rules*, not RBAC permissions.

---

## 1. Design decisions (read first)

| Decision | Rationale |
|---|---|
| **Priorities & statuses are string constants, not tables** | Matches the codebase convention (portable SQLite/Postgres, constrained in `src/lib/constants.ts`). A lookup table adds joins with zero benefit for a fixed enum. |
| **Subtasks are a self-relation on `Task`** (`parentId`) | Normalized, infinitely nestable (UI caps at 1 level), avoids a duplicate table with identical columns. |
| **Audit reuses the existing `AuditLog`** | One immutable audit trail for the whole platform; `entityType: "Task"`. |
| **Time tracking reuses the existing `TimeEntry`** | A billable task that gets completed creates/links a `TimeEntry` on the task's matter — no parallel time system. |
| **Attachments use Vercel Blob** (`storageKey`) | The app runs on Vercel; serverless has no disk. Local dev falls back to a `./uploads` driver behind the same interface. |
| **Automation runs on Vercel Cron** | One scheduled route (`/api/cron/tasks`) handles reminders, overdue, recurrence, daily digest. Protected by `CRON_SECRET`. |
| **No new RBAC permissions for basic use** | "All users" = any authenticated user. Two admin-only extras: `task:admin` (see any task, reassign anything) granted to IT_ADMIN + MANAGING_PARTNER. |

---

## 2. Data model (Prisma)

Append to `prisma/schema.prisma`. All models follow house conventions:
`companyId` scoping, `createdAt/updatedAt`, soft-delete via `deletedAt`, string enums.

```prisma
// ---------------------------------------------------------------------------
// Tasks Module
// ---------------------------------------------------------------------------

model TaskCategory {
  id              String  @id @default(uuid())
  companyId       String
  key             String  // ADMINISTRATIVE | LEGAL_WORK | COURT_FILING | ...
  name            String
  isCourtDeadline Boolean @default(false) // drives auto-CRITICAL rule
  isBillable      Boolean @default(false) // default for tasks in this category
  createdAt       DateTime @default(now())

  tasks Task[]

  @@unique([companyId, key])
  @@index([companyId])
}

model Task {
  id            String    @id @default(uuid())
  companyId     String
  title         String
  description   String?
  categoryId    String?
  priority      String    @default("MEDIUM")   // LOW | MEDIUM | HIGH | CRITICAL
  status        String    @default("DRAFT")    // DRAFT | ASSIGNED | IN_PROGRESS | WAITING | COMPLETED | ARCHIVED
  visibility    String    @default("PUBLIC")   // PRIVATE | MATTER | PUBLIC
  matterId      String?                        // matter-linked task
  clientId      String?                        // client-linked task
  parentId      String?                        // subtask -> parent
  startDate     DateTime?
  dueDate       DateTime?                      // SLA anchor
  completedAt   DateTime?
  completedById String?
  billable      Boolean   @default(false)
  estimatedMin  Int?                           // optional time estimate
  loggedMin     Int       @default(0)          // accumulated via timer / manual log
  timeEntryId   String?                        // created on completion if billable
  recurringRuleId String?                      // instance generated from a rule
  createdById   String
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt
  deletedAt     DateTime?
  version       Int       @default(1)

  category    TaskCategory?  @relation(fields: [categoryId], references: [id])
  matter      Matter?        @relation(fields: [matterId], references: [id])
  client      Client?        @relation(fields: [clientId], references: [id])
  parent      Task?          @relation("Subtasks", fields: [parentId], references: [id])
  subtasks    Task[]         @relation("Subtasks")
  assignments TaskAssignment[]
  comments    TaskComment[]
  attachments TaskAttachment[]
  reminders   TaskReminder[]
  shares      TaskShare[]
  blockedBy   TaskDependency[] @relation("Blocked")   // rows where THIS task is blocked
  blocks      TaskDependency[] @relation("Blocker")   // rows where THIS task blocks others

  @@index([companyId, status])
  @@index([companyId, dueDate])
  @@index([matterId])
  @@index([clientId])
  @@index([parentId])
}

model TaskAssignment {
  taskId       String
  userId       String
  assignedById String
  assignedAt   DateTime @default(now())

  task Task @relation(fields: [taskId], references: [id], onDelete: Cascade)
  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@id([taskId, userId])
  @@index([userId])
}

// Explicit share of a PRIVATE task with another user.
model TaskShare {
  taskId    String
  userId    String
  sharedBy  String
  createdAt DateTime @default(now())

  task Task @relation(fields: [taskId], references: [id], onDelete: Cascade)

  @@id([taskId, userId])
}

// A depends-on edge: `taskId` cannot COMPLETE until `dependsOnId` is COMPLETED.
model TaskDependency {
  taskId      String
  dependsOnId String

  task      Task @relation("Blocked",  fields: [taskId],      references: [id], onDelete: Cascade)
  dependsOn Task @relation("Blocker",  fields: [dependsOnId], references: [id], onDelete: Cascade)

  @@id([taskId, dependsOnId])
  @@index([dependsOnId])
}

model TaskComment {
  id        String   @id @default(uuid())
  taskId    String
  authorId  String
  body      String
  createdAt DateTime @default(now())

  task Task @relation(fields: [taskId], references: [id], onDelete: Cascade)

  @@index([taskId])
}

model TaskAttachment {
  id         String   @id @default(uuid())
  taskId     String
  filename   String
  mime       String
  sizeBytes  Int
  storageKey String   // Vercel Blob key (or local path in dev)
  sha256     String?
  uploadedBy String
  createdAt  DateTime @default(now())

  task Task @relation(fields: [taskId], references: [id], onDelete: Cascade)

  @@index([taskId])
}

model TaskReminder {
  id        String    @id @default(uuid())
  taskId    String
  remindAt  DateTime
  channel   String    @default("IN_APP") // IN_APP | EMAIL | SMS
  sentAt    DateTime?
  createdBy String

  task Task @relation(fields: [taskId], references: [id], onDelete: Cascade)

  @@index([remindAt, sentAt]) // cron scan: due & unsent
}

model RecurringTaskRule {
  id          String    @id @default(uuid())
  companyId   String
  // Template fields copied onto each generated instance:
  title       String
  description String?
  categoryId  String?
  priority    String    @default("MEDIUM")
  matterId    String?
  clientId    String?
  assigneeIds String    // JSON array of user ids
  visibility  String    @default("PUBLIC")
  // Schedule:
  frequency   String    // DAILY | WEEKLY | MONTHLY | YEARLY
  interval    Int       @default(1)     // every N periods
  dayOfWeek   Int?                      // 0-6 (WEEKLY)
  dayOfMonth  Int?                      // 1-31 (MONTHLY; clamped to month end)
  dueOffsetDays Int     @default(0)     // dueDate = generatedAt + offset
  nextRunAt   DateTime                  // cron picks up rows where nextRunAt <= now
  endsAt      DateTime?
  active      Boolean   @default(true)
  createdById String
  createdAt   DateTime  @default(now())

  @@index([companyId])
  @@index([nextRunAt, active])
}

// Generic in-app notification (used by tasks first; platform-wide by design).
model Notification {
  id        String    @id @default(uuid())
  companyId String
  userId    String
  type      String    // TASK_ASSIGNED | TASK_COMMENT | TASK_DUE | TASK_OVERDUE | TASK_COMPLETED | DAILY_SUMMARY
  title     String
  body      String?
  linkPath  String?   // e.g. /tasks/<id>
  readAt    DateTime?
  createdAt DateTime  @default(now())

  @@index([userId, readAt])
}
```

Also: add `taskId String?` to the existing `TimeEntry` model (nullable FK) so billable
tasks can link the time they generate.

### Seeded categories

| key | name | court? | billable default |
|---|---|---|---|
| ADMINISTRATIVE | Administrative | – | – |
| LEGAL_WORK | Legal Work | – | ✓ |
| COURT_FILING | Court Filing | **✓** | ✓ |
| RESEARCH | Research | – | ✓ |
| CLIENT_COMM | Client Communication | – | ✓ |
| BILLING | Billing-related | – | – |
| COMPLIANCE | Compliance | – | – |
| DRAFTING | Document Drafting | – | ✓ |
| FOLLOW_UP | Follow-ups | – | – |

### Constants (`src/lib/constants.ts` additions)

```ts
export const TASK_PRIORITIES = ["LOW", "MEDIUM", "HIGH", "CRITICAL"] as const;
export const TASK_STATUSES = ["DRAFT", "ASSIGNED", "IN_PROGRESS", "WAITING", "COMPLETED", "ARCHIVED"] as const;
export const TASK_VISIBILITY = ["PRIVATE", "MATTER", "PUBLIC"] as const;

// Legal status transitions (enforced server-side; see §4).
export const TASK_TRANSITIONS: Record<string, string[]> = {
  DRAFT:       ["ASSIGNED", "IN_PROGRESS", "ARCHIVED"],
  ASSIGNED:    ["IN_PROGRESS", "WAITING", "ARCHIVED"],
  IN_PROGRESS: ["WAITING", "COMPLETED", "ARCHIVED"],
  WAITING:     ["IN_PROGRESS", "COMPLETED", "ARCHIVED"],
  COMPLETED:   ["ARCHIVED", "IN_PROGRESS"], // reopen allowed
  ARCHIVED:    [],                          // terminal
};
```

---

## 3. Business rules (enforced server-side)

1. **Anyone can create.** Only a valid session is required; no RBAC permission.
2. **Assignment** to one or many users (same company). Assigning moves DRAFT → ASSIGNED automatically. Assignees get a notification.
3. **Matter-linked context.** Any read of a matter-linked task includes `matter.code`, `client.name`, `responsiblePartner.fullName` (single Prisma `include` — see §5).
4. **Completion rights.** Only the **creator or an assignee** may set COMPLETED (or a `task:admin`). Everyone else → 403.
5. **Dependencies gate completion.** A task cannot COMPLETE while any `dependsOn` task is not COMPLETED → 422 `blocked_by_dependencies`. Cycles are rejected at creation (DFS check) → 422 `dependency_cycle`.
6. **Court deadlines are Critical.** If `category.isCourtDeadline` (COURT_FILING), priority is **forced to CRITICAL** on create/update; client cannot lower it.
7. **Visibility.**
   - `PRIVATE` → creator + explicit `TaskShare` rows + assignees + `task:admin`.
   - `MATTER` → anyone who can read the linked matter (`matter:read`).
   - `PUBLIC` → any user in the company.
   All list/detail queries apply this filter **in the WHERE clause**, not post-hoc.
8. **Audit everything.** Every mutation writes `AuditLog` (`TASK_CREATED`, `TASK_ASSIGNED`, `TASK_STATUS`, `TASK_COMMENT`, `TASK_ATTACHMENT`, `TASK_COMPLETED`, `TASK_ARCHIVED`, `TASK_DEPENDENCY_ADDED`, ...) with before/after.
9. **Overdue** = `dueDate < now && status NOT IN (COMPLETED, ARCHIVED)`. Cron notifies assignees once per day per task (dedup on `Notification` type+link+day).
10. **Recurring rules** generate the next instance when `nextRunAt <= now`, then advance `nextRunAt` by the schedule; stop at `endsAt`.
11. **Billable sync.** When a billable, matter-linked task with `loggedMin > 0` is COMPLETED, the server creates a `TimeEntry` (status DRAFT, matter = task.matter, minutes = loggedMin, narrative = task.title) and stores `timeEntryId`. It then flows through the existing billing pipeline (unbilled → invoice).
12. **Subtask roll-up.** A parent cannot COMPLETE while it has open subtasks → 422 `open_subtasks`.
13. **Soft delete only** (`deletedAt`); DELETE is creator-or-admin and is really an archive-with-tombstone.

---

## 4. Status workflow

```
                 ┌────────────┐
   create        │   DRAFT    │──── archive ────────────┐
     │           └─────┬──────┘                         │
     ▼      assign     ▼                                ▼
  (fields)  ────► ASSIGNED ──── start ──► IN_PROGRESS   ARCHIVED (terminal)
                     │                     │   ▲  │        ▲
                     │ wait                ▼   │  │        │
                     └────────────►     WAITING┘  │        │
                                       │          ▼        │
                                       └──► COMPLETED ─────┘
                                              │  ▲
                                       reopen ┘  └ complete (guards: rights,
                                                   dependencies, subtasks)
```

Transition guard (shared by PATCH/complete/archive):

```ts
export function assertTransition(from: string, to: string) {
  if (!(TASK_TRANSITIONS[from] ?? []).includes(to))
    throw new AuthError(422, `illegal_transition:${from}->${to}`);
}
```

---

## 5. API surface (App Router, `src/app/api/tasks/...`)

All handlers: `requireUser()` (session only), Zod-validated, `handle()` wrapper,
audit write, `dynamic = "force-dynamic"` — identical house style to every other module.

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/tasks` | List with filters: `assignee=me|<id>`, `matterId`, `clientId`, `status`, `priority`, `categoryId`, `overdue=1`, `q=` (title search), `parentId` |
| POST | `/api/tasks` | Create (fields + optional assigneeIds, dependencies, subtaskOf) |
| GET | `/api/tasks/:id` | Detail: task + matter context + assignees + subtasks + dependencies + comments + attachments + reminders + audit tail |
| PATCH | `/api/tasks/:id` | Update fields / status transition (guarded) |
| DELETE | `/api/tasks/:id` | Soft-delete (creator/admin) |
| POST | `/api/tasks/:id/assign` | `{ userIds: string[] }` — replaces assignment set, notifies |
| POST | `/api/tasks/:id/complete` | Completion with all guards (rights, deps, subtasks, billable sync) |
| POST | `/api/tasks/:id/archive` | Archive |
| POST | `/api/tasks/:id/comments` | Add comment (notifies assignees + creator) |
| POST | `/api/tasks/:id/attachments` | Upload (multipart → Blob) |
| POST | `/api/tasks/:id/dependencies` | `{ dependsOnId }` (cycle check) |
| POST | `/api/tasks/:id/reminders` | `{ remindAt, channel }` |
| POST | `/api/tasks/:id/log-time` | `{ minutes }` — increments `loggedMin` |
| GET/POST | `/api/tasks/recurring` | List / create recurring rules |
| PATCH | `/api/tasks/recurring/:id` | Pause/edit rule |
| GET | `/api/notifications` · POST `/api/notifications/:id/read` | In-app inbox |
| GET | `/api/cron/tasks` | Cron entry point (header `authorization: Bearer ${CRON_SECRET}`) |

### Example — create

```http
POST /api/tasks
{
  "title": "File submissions at Douala TGI",
  "categoryKey": "COURT_FILING",
  "matterId": "…uuid…",
  "dueDate": "2026-07-18",
  "assigneeIds": ["…lawyer uuid…"],
  "visibility": "MATTER",
  "billable": true,
  "estimatedMin": 120
}
→ 200 {
  "id": "…",
  "priority": "CRITICAL",        // forced: court-deadline category
  "status": "ASSIGNED",          // auto: has assignees
  "matter": { "code": "M-2026-001", "client": "Acme Cameroun SA",
              "responsiblePartner": "Chief Finance Officer" }
}
```

### Example — completion blocked by dependency

```http
POST /api/tasks/B/complete
→ 422 { "error": "blocked_by_dependencies", "blockers": [{ "id": "A", "title": "Draft submissions" }] }
```

### Core creation handler (abridged, house style)

```ts
export async function POST(req: NextRequest) {
  return handle(async () => {
    const user = await requireUser();                       // any role
    const input = createTaskSchema.parse(await req.json()); // Zod

    const category = input.categoryKey
      ? await prisma.taskCategory.findFirst({
          where: { companyId: user.companyId, key: input.categoryKey } })
      : null;

    // Rule 6: court deadlines are always CRITICAL.
    const priority = category?.isCourtDeadline ? "CRITICAL" : input.priority;

    const task = await prisma.task.create({
      data: {
        companyId: user.companyId,
        title: input.title,
        description: input.description ?? null,
        categoryId: category?.id ?? null,
        priority,
        status: input.assigneeIds.length ? "ASSIGNED" : "DRAFT",
        visibility: input.visibility,
        matterId: input.matterId || null,
        clientId: input.clientId || null,
        parentId: input.parentId || null,
        dueDate: input.dueDate ? new Date(input.dueDate) : null,
        billable: input.billable ?? category?.isBillable ?? false,
        createdById: user.id,
        assignments: { create: input.assigneeIds.map(userId =>
          ({ userId, assignedById: user.id })) },
      },
    });

    await notifyAssigned(task, input.assigneeIds, user);    // Notification rows (+email hook)
    await writeAudit({ companyId: user.companyId, actorId: user.id,
      action: "TASK_CREATED", entityType: "Task", entityId: task.id,
      after: { title: task.title, priority: task.priority } });

    return { id: task.id, priority: task.priority, status: task.status };
  });
}
```

### Visibility WHERE-clause helper

```ts
export function taskVisibilityWhere(user: CurrentUser) {
  if (user.permissions.has("task:admin")) return {};       // sees all
  return {
    OR: [
      { visibility: "PUBLIC" },
      { createdById: user.id },
      { assignments: { some: { userId: user.id } } },
      { shares: { some: { userId: user.id } } },
      // MATTER visibility piggybacks on matter:read
      ...(user.permissions.has("matter:read") ? [{ visibility: "MATTER" }] : []),
    ],
  };
}
```

---

## 6. UI structure (`src/app/(app)/tasks/…`)

```
/tasks                     TasksPage (dashboard)
 ├─ SummaryCards           my open · due today · overdue · completed this week
 ├─ TaskFilters            assignee | matter | client | category | priority | status | overdue | search
 ├─ TaskBoard | TaskTable  toggle: kanban by status ←→ table (persisted in Zustand)
 │   └─ TaskCard/Row       priority dot (grey/blue/amber/red), due chip (red when overdue),
 │                         category badge, matter code chip, assignee avatars
 └─ NewTaskDialog          title, category, matter/client pickers, assignees (multi),
                           due date, priority (locked=CRITICAL for Court Filing),
                           visibility, billable toggle, recurring toggle → RecurrenceEditor

/tasks/[id]                TaskDetailPage
 ├─ HeaderBar              title · status pill · action buttons (Start/Wait/Complete/Archive)
 ├─ ContextStrip           matter code — client — responsible partner (rule 3)
 ├─ LeftColumn
 │   ├─ Description
 │   ├─ SubtaskList        checklist; “+ subtask” inline; parent-complete guard surfaced
 │   ├─ DependencyList     blockers with status; complete disabled while any open
 │   └─ TimeLogger         “log 15/30/60 min” + custom; shows loggedMin/estimatedMin
 └─ RightColumn (tabs)
     ├─ CommentsPanel      threaded list + composer (notifies)
     ├─ AttachmentsPanel   upload/download list
     ├─ RemindersPanel     add reminder (datetime + channel)
     └─ ActivityPanel      audit tail for this task (read-only)

Global:
 ├─ NotificationsBell      in shell header; unread count; dropdown inbox → linkPath
 └─ Matter page gains a “Tasks” tab (list filtered by matterId)
    Client page gains the same (clientId)
```

Nav: `Tasks` entry visible to **all** users (no `perm` key on the shell nav item —
first module without one). i18n keys under `tasks.*` in both EN and FR from day one.

---

## 7. Automation (Vercel Cron)

`vercel.json`:

```json
{ "crons": [{ "path": "/api/cron/tasks", "schedule": "*/15 * * * *" },
            { "path": "/api/cron/tasks?job=daily", "schedule": "0 6 * * *" }] }
```

`GET /api/cron/tasks` (Bearer `CRON_SECRET`), each step idempotent:

1. **Reminders** — `TaskReminder` where `remindAt <= now && sentAt == null` → create `Notification` (+ email if channel=EMAIL and SMTP configured) → set `sentAt`.
2. **Overdue sweep** — overdue tasks (rule 9) → one `TASK_OVERDUE` notification per assignee per task per day (dedup by unique day-key check before insert).
3. **Recurrence** — rules where `active && nextRunAt <= now && (endsAt is null or > now)` → create the task instance from the template (assignees from `assigneeIds` JSON) → advance `nextRunAt` (`interval` × frequency; monthly clamps day 29–31 to month end) → deactivate if past `endsAt`.
4. **Daily digest** (`?job=daily`, 06:00 UTC) — per user with open tasks: one `DAILY_SUMMARY` notification “X due today, Y overdue, Z open”, email if configured.

Email/SMS: dispatched through a provider-abstracted `notify()` helper — in-app rows
always; email when `SMTP_URL` set; SMS when a Twilio-style env is set. No provider,
no failure — channels degrade silently, matching the AI-key pattern.

---

## 8. Implementation checklist (Definition of Done, house standard)

- [ ] Schema + `db push` + seed (9 categories, `task:admin` permission on IT_ADMIN & MANAGING_PARTNER, 3 sample tasks on M-2026-001, 1 recurring rule)
- [ ] `TimeEntry.taskId` migration + billable-completion sync
- [ ] Zod schemas (`createTaskSchema`, `updateTaskSchema`, `recurringRuleSchema`, …)
- [ ] All routes in §5 with visibility WHERE, transition guard, dependency cycle check
- [ ] Cron route + `vercel.json` + `CRON_SECRET` env documented in `.env.example`
- [ ] UI in §6, EN/FR complete, dark mode, responsive
- [ ] Smoke tests: create→assign→depend→blocked complete (422)→unblock→complete;
      court filing forced CRITICAL; private task invisible to others (list + direct GET);
      recurring generation; overdue notification dedup; billable completion creates TimeEntry;
      trial balance untouched (tasks never post to GL directly)
- [ ] Audit entries verified for every action; commit
```

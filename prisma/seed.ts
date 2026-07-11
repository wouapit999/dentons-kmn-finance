import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { PERMISSIONS, SYSTEM_ROLES, TASK_CATEGORIES } from "../src/lib/constants";
import { CHART_OF_ACCOUNTS, JOURNALS } from "../src/lib/coa";

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding Dentons KMN Finance…");

  // 1) Company
  const company = await prisma.company.upsert({
    where: { id: "00000000-0000-0000-0000-000000000001" },
    update: {},
    create: {
      id: "00000000-0000-0000-0000-000000000001",
      legalName: "Dentons KMN",
      baseCurrency: "XAF",
      countryCode: "CM",
    },
  });

  // 2) Offices & departments
  const office = await prisma.office.upsert({
    where: { id: "00000000-0000-0000-0000-000000000010" },
    update: {},
    create: {
      id: "00000000-0000-0000-0000-000000000010",
      companyId: company.id,
      name: "Douala HQ",
      currency: "XAF",
    },
  });

  const finance = await prisma.department.upsert({
    where: { id: "00000000-0000-0000-0000-000000000020" },
    update: {},
    create: {
      id: "00000000-0000-0000-0000-000000000020",
      companyId: company.id,
      name: "Finance",
    },
  });

  // 3) Permissions
  for (const [key, description] of Object.entries(PERMISSIONS)) {
    const [resource, action] = key.split(":");
    await prisma.permission.upsert({
      where: { key },
      update: { description },
      create: { key, resource, action, description },
    });
  }

  // 4) System roles + their permission sets
  const roleByKey: Record<string, string> = {};
  for (const r of SYSTEM_ROLES) {
    const role = await prisma.role.upsert({
      where: { companyId_key: { companyId: company.id, key: r.key } },
      update: { name: r.name, hierarchyLevel: r.hierarchyLevel, isSystem: true },
      create: {
        companyId: company.id,
        key: r.key,
        name: r.name,
        hierarchyLevel: r.hierarchyLevel,
        isSystem: true,
      },
    });
    roleByKey[r.key] = role.id;

    // Reset & re-apply permissions to match the registry.
    await prisma.rolePermission.deleteMany({ where: { roleId: role.id } });
    const perms = await prisma.permission.findMany({
      where: { key: { in: r.permissions as string[] } },
    });
    await prisma.rolePermission.createMany({
      data: perms.map((p) => ({ roleId: role.id, permissionId: p.id })),
    });
  }

  // 5) Bootstrap users
  const password = await bcrypt.hash("ChangeMe123!", 10);

  const admin = await prisma.user.upsert({
    where: { companyId_email: { companyId: company.id, email: "admin@dentonskmn.local" } },
    update: {},
    create: {
      companyId: company.id,
      departmentId: finance.id,
      fullName: "IT Administrator",
      email: "admin@dentonskmn.local",
      passwordHash: password,
      status: "ACTIVE",
      locale: "en",
    },
  });
  await prisma.userRole.deleteMany({ where: { userId: admin.id } });
  await prisma.userRole.create({
    data: { userId: admin.id, roleId: roleByKey["IT_ADMIN"], officeId: office.id },
  });

  const cfo = await prisma.user.upsert({
    where: { companyId_email: { companyId: company.id, email: "cfo@dentonskmn.local" } },
    update: {},
    create: {
      companyId: company.id,
      departmentId: finance.id,
      fullName: "Chief Finance Officer",
      email: "cfo@dentonskmn.local",
      passwordHash: password,
      status: "ACTIVE",
      locale: "fr",
    },
  });
  await prisma.userRole.deleteMany({ where: { userId: cfo.id } });
  await prisma.userRole.create({
    data: { userId: cfo.id, roleId: roleByKey["CFO"], officeId: office.id },
  });

  // 6) General Ledger — fiscal year, monthly periods, journals, chart of accounts
  const year = new Date().getFullYear();
  const fy = await prisma.fiscalYear.upsert({
    where: { id: "00000000-0000-0000-0000-0000000000f0" },
    update: {},
    create: {
      id: "00000000-0000-0000-0000-0000000000f0",
      companyId: company.id,
      name: `FY${year}`,
      startDate: new Date(Date.UTC(year, 0, 1)),
      endDate: new Date(Date.UTC(year, 11, 31)),
      status: "OPEN",
    },
  });

  const months = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
  ];
  for (let m = 0; m < 12; m++) {
    const id = `00000000-0000-0000-0000-0000000000${(m + 16).toString(16).padStart(2, "0")}`;
    await prisma.accountingPeriod.upsert({
      where: { id },
      update: {},
      create: {
        id,
        companyId: company.id,
        fiscalYearId: fy.id,
        seq: m + 1,
        name: `${months[m]} ${year}`,
        startDate: new Date(Date.UTC(year, m, 1)),
        endDate: new Date(Date.UTC(year, m + 1, 0)),
        status: "OPEN",
      },
    });
  }

  for (const j of JOURNALS) {
    await prisma.journal.upsert({
      where: { companyId_code: { companyId: company.id, code: j.code } },
      update: { name: j.name, type: j.type },
      create: { companyId: company.id, code: j.code, name: j.name, type: j.type },
    });
  }

  for (const a of CHART_OF_ACCOUNTS) {
    await prisma.account.upsert({
      where: { companyId_code: { companyId: company.id, code: a.code } },
      update: { name: a.name, type: a.type },
      create: {
        companyId: company.id,
        code: a.code,
        name: a.name,
        type: a.type,
        syscohadaClass: a.syscohadaClass,
        ifrsCategory: a.ifrsCategory,
        isPostable: a.isPostable ?? true,
      },
    });
  }
  console.log(
    `GL seeded: ${CHART_OF_ACCOUNTS.length} accounts, ${JOURNALS.length} journals, 12 periods.`,
  );

  // 7) Practice areas, sample clients & a matter (Module 3)
  const areaNames = [
    "Corporate & Commercial",
    "Litigation & Arbitration",
    "Tax",
    "Intellectual Property",
    "Real Estate",
    "Employment",
  ];
  const areaId: Record<string, string> = {};
  for (const name of areaNames) {
    const pa = await prisma.practiceArea.upsert({
      where: { companyId_name: { companyId: company.id, name } },
      update: {},
      create: { companyId: company.id, name },
    });
    areaId[name] = pa.id;
  }

  const acme = await prisma.client.upsert({
    where: { id: "00000000-0000-0000-0000-0000000000c1" },
    update: {},
    create: {
      id: "00000000-0000-0000-0000-0000000000c1",
      companyId: company.id,
      type: "CORPORATE",
      name: "Acme Cameroun SA",
      email: "legal@acme.cm",
      taxId: "M071234567890P",
      kycStatus: "VERIFIED",
      amlRisk: "LOW",
      conflictStatus: "CLEAR",
      createdById: admin.id,
    },
  });

  await prisma.client.upsert({
    where: { id: "00000000-0000-0000-0000-0000000000c2" },
    update: {},
    create: {
      id: "00000000-0000-0000-0000-0000000000c2",
      companyId: company.id,
      type: "INDIVIDUAL",
      name: "Jean-Paul Mballa",
      email: "jp.mballa@example.cm",
      kycStatus: "PENDING",
      amlRisk: "MEDIUM",
      createdById: admin.id,
    },
  });

  const matter1 = await prisma.matter.upsert({
    where: { companyId_code: { companyId: company.id, code: "M-2026-001" } },
    update: {},
    create: {
      companyId: company.id,
      clientId: acme.id,
      code: "M-2026-001",
      name: "Acme — Series B financing",
      practiceAreaId: areaId["Corporate & Commercial"],
      responsiblePartnerId: cfo.id,
      status: "OPEN",
      currency: "XAF",
      createdById: admin.id,
    },
  });
  console.log(`Clients/Matters seeded: 2 clients, 1 matter, ${areaNames.length} practice areas.`);

  // 8) Sample time entries & a disbursement (Module 5)
  const timeSeed = [
    { id: "00000000-0000-0000-0000-0000000000a1", minutes: 180, rate: 75000, billable: true, narrative: "Drafting term sheet" },
    { id: "00000000-0000-0000-0000-0000000000a2", minutes: 90, rate: 75000, billable: true, narrative: "Client call — deal structure" },
    { id: "00000000-0000-0000-0000-0000000000a3", minutes: 60, rate: 0, billable: false, narrative: "Internal file review" },
  ];
  for (const te of timeSeed) {
    await prisma.timeEntry.upsert({
      where: { id: te.id },
      update: {},
      create: {
        id: te.id,
        companyId: company.id,
        matterId: matter1.id,
        lawyerId: cfo.id,
        date: new Date(Date.UTC(year, new Date().getMonth(), 15)),
        minutes: te.minutes,
        billable: te.billable,
        rate: te.rate,
        amount: Math.round((te.minutes / 60) * te.rate * 100) / 100,
        currency: "XAF",
        narrative: te.narrative,
        createdById: admin.id,
      },
    });
  }
  await prisma.disbursement.upsert({
    where: { id: "00000000-0000-0000-0000-0000000000b1" },
    update: {},
    create: {
      id: "00000000-0000-0000-0000-0000000000b1",
      companyId: company.id,
      matterId: matter1.id,
      date: new Date(Date.UTC(year, new Date().getMonth(), 16)),
      description: "Court filing fees",
      amount: 150000,
      currency: "XAF",
      billable: true,
      vendorName: "Tribunal de Première Instance",
      createdById: admin.id,
    },
  });
  console.log("Time & disbursements seeded: 3 time entries, 1 disbursement.");

  // 9) Employees for payroll (Module 14)
  const employeeSeed = [
    { no: "EMP-001", name: "Awa Ngono", position: "Senior Associate", base: 850000, housing: 150000, transport: 50000 },
    { no: "EMP-002", name: "Bikai Etienne", position: "Paralegal", base: 350000, housing: 60000, transport: 30000 },
    { no: "EMP-003", name: "Christelle Fotso", position: "Accountant", base: 500000, housing: 90000, transport: 40000 },
  ];
  for (let i = 0; i < employeeSeed.length; i++) {
    const e = employeeSeed[i];
    const id = `00000000-0000-0000-0000-0000000000e${i + 1}`;
    await prisma.employee.upsert({
      where: { id },
      update: {},
      create: {
        id,
        companyId: company.id,
        employeeNo: e.no,
        fullName: e.name,
        position: e.position,
        baseSalary: e.base,
        housingAllowance: e.housing,
        transportAllowance: e.transport,
        cnpsNo: `CN${100000 + i}`,
        createdById: admin.id,
      },
    });
  }
  console.log(`Employees seeded: ${employeeSeed.length}.`);

  // 10) Tasks module: categories + sample tasks + a recurring rule
  const catId: Record<string, string> = {};
  for (const c of TASK_CATEGORIES) {
    const cat = await prisma.taskCategory.upsert({
      where: { companyId_key: { companyId: company.id, key: c.key } },
      update: { name: c.name, isCourtDeadline: !!c.isCourtDeadline, isBillable: !!c.isBillable },
      create: {
        companyId: company.id,
        key: c.key,
        name: c.name,
        isCourtDeadline: !!c.isCourtDeadline,
        isBillable: !!c.isBillable,
      },
    });
    catId[c.key] = cat.id;
  }

  const taskA = await prisma.task.upsert({
    where: { id: "00000000-0000-0000-0000-00000000ta01" },
    update: {},
    create: {
      id: "00000000-0000-0000-0000-00000000ta01",
      companyId: company.id,
      title: "Draft Series B share subscription agreement",
      categoryId: catId["DRAFTING"],
      priority: "HIGH",
      status: "IN_PROGRESS",
      visibility: "MATTER",
      matterId: matter1.id,
      dueDate: new Date(Date.now() + 5 * 86_400_000),
      billable: true,
      estimatedMin: 480,
      createdById: cfo.id,
      assignments: { create: [{ userId: cfo.id, assignedById: cfo.id }] },
    },
  });
  const taskB = await prisma.task.upsert({
    where: { id: "00000000-0000-0000-0000-00000000ta02" },
    update: {},
    create: {
      id: "00000000-0000-0000-0000-00000000ta02",
      companyId: company.id,
      title: "File subscription agreement with the court registry",
      categoryId: catId["COURT_FILING"],
      priority: "CRITICAL", // court deadline
      status: "ASSIGNED",
      visibility: "MATTER",
      matterId: matter1.id,
      dueDate: new Date(Date.now() + 10 * 86_400_000),
      billable: true,
      createdById: cfo.id,
      assignments: { create: [{ userId: cfo.id, assignedById: cfo.id }] },
    },
  });
  await prisma.taskDependency.upsert({
    where: { taskId_dependsOnId: { taskId: taskB.id, dependsOnId: taskA.id } },
    update: {},
    create: { taskId: taskB.id, dependsOnId: taskA.id },
  });
  await prisma.task.upsert({
    where: { id: "00000000-0000-0000-0000-00000000ta03" },
    update: {},
    create: {
      id: "00000000-0000-0000-0000-00000000ta03",
      companyId: company.id,
      title: "Collect signed engagement letter",
      categoryId: catId["FOLLOW_UP"],
      priority: "MEDIUM",
      status: "ASSIGNED",
      visibility: "PUBLIC",
      clientId: acme.id,
      dueDate: new Date(Date.now() - 2 * 86_400_000), // overdue on purpose
      createdById: admin.id,
      assignments: { create: [{ userId: admin.id, assignedById: admin.id }] },
    },
  });
  await prisma.recurringTaskRule.upsert({
    where: { id: "00000000-0000-0000-0000-00000000tr01" },
    update: {},
    create: {
      id: "00000000-0000-0000-0000-00000000tr01",
      companyId: company.id,
      title: "Prepare monthly VAT return",
      categoryId: catId["COMPLIANCE"],
      priority: "HIGH",
      assigneeIds: JSON.stringify([cfo.id]),
      visibility: "PUBLIC",
      frequency: "MONTHLY",
      interval: 1,
      dayOfMonth: 10,
      dueOffsetDays: 5,
      nextRunAt: new Date(),
      createdById: cfo.id,
    },
  });
  console.log(`Tasks seeded: ${TASK_CATEGORIES.length} categories, 3 tasks, 1 recurring rule.`);

  console.log("\nSeed complete. Sign in with:");
  console.log("  IT Admin : admin@dentonskmn.local / ChangeMe123!");
  console.log("  CFO      : cfo@dentonskmn.local   / ChangeMe123!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

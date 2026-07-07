import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { PERMISSIONS, SYSTEM_ROLES } from "../src/lib/constants";

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

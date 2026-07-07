import { NextRequest } from "next/server";
import { handle } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/auth";
import { createAccountSchema } from "@/lib/validation";
import { writeAudit } from "@/lib/audit";

export const dynamic = "force-dynamic";

// GET /api/gl/accounts — chart of accounts.
export async function GET() {
  return handle(async () => {
    const user = await requirePermission("gl:read");
    const accounts = await prisma.account.findMany({
      where: { companyId: user.companyId, status: "ACTIVE" },
      orderBy: { code: "asc" },
    });
    return accounts.map((a) => ({
      id: a.id,
      code: a.code,
      name: a.name,
      type: a.type,
      syscohadaClass: a.syscohadaClass,
      ifrsCategory: a.ifrsCategory,
      isPostable: a.isPostable,
    }));
  });
}

// POST /api/gl/accounts — create an account (Finance Manager / CFO).
export async function POST(req: NextRequest) {
  return handle(async () => {
    const user = await requirePermission("gl:manage");
    const input = createAccountSchema.parse(await req.json());

    const created = await prisma.account.create({
      data: {
        companyId: user.companyId,
        code: input.code,
        name: input.name,
        type: input.type,
        syscohadaClass: input.syscohadaClass || null,
        ifrsCategory: input.ifrsCategory || null,
        isPostable: input.isPostable,
      },
    });
    await writeAudit({
      companyId: user.companyId,
      actorId: user.id,
      action: "ACCOUNT_CREATED",
      entityType: "Account",
      entityId: created.id,
      after: { code: created.code, name: created.name, type: created.type },
    });
    return { id: created.id };
  });
}

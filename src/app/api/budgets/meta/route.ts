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

// GET /api/budgets/meta — revenue & expense accounts to budget against.
export async function GET() {
  return handle(async () => {
    const user = await requirePermission("budget:read");
    const accounts = await prisma.account.findMany({
      where: {
        companyId: user.companyId,
        isPostable: true,
        status: "ACTIVE",
        type: { in: ["REVENUE", "EXPENSE"] },
      },
      select: { code: true, name: true, type: true },
      orderBy: { code: "asc" },
    });
    return {
      accounts: accounts.map((a) => ({ code: a.code, name: `${a.code} — ${a.name}`, type: a.type })),
    };
  });
}

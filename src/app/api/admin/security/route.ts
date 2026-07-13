import { NextRequest } from "next/server";
import { z } from "zod";
import { handle } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/auth";
import { getPolicy, savePolicy, DEFAULT_POLICY } from "@/lib/security";
import { writeAudit } from "@/lib/audit";

export const dynamic = "force-dynamic";

// GET /api/admin/security — users' security status + the current policy.
export async function GET() {
  return handle(async () => {
    const admin = await requirePermission("security:admin");
    const [users, policy] = await Promise.all([
      prisma.user.findMany({
        where: { companyId: admin.companyId, deletedAt: null },
        orderBy: { fullName: "asc" },
        select: {
          id: true, fullName: true, email: true, status: true,
          mfaEnabled: true, mustChangePassword: true, lockedManually: true,
          lockedUntil: true, failedLogins: true, passwordChangedAt: true, lastLoginAt: true,
        },
      }),
      getPolicy(admin.companyId),
    ]);
    const now = new Date();
    return {
      policy,
      users: users.map((u) => ({
        id: u.id,
        fullName: u.fullName,
        email: u.email,
        status: u.status,
        mfaEnabled: u.mfaEnabled,
        mustChangePassword: u.mustChangePassword,
        locked: u.lockedManually || (!!u.lockedUntil && u.lockedUntil > now),
        lockedManually: u.lockedManually,
        failedLogins: u.failedLogins,
        passwordChangedAt: u.passwordChangedAt,
        lastLoginAt: u.lastLoginAt,
      })),
    };
  });
}

// PUT /api/admin/security — update the company password policy.
const policySchema = z.object({
  minLength: z.number().int().min(8).max(128),
  requireUpper: z.boolean(),
  requireLower: z.boolean(),
  requireNumber: z.boolean(),
  requireSpecial: z.boolean(),
  historyCount: z.number().int().min(0).max(24),
  expiryDays: z.number().int().min(0).max(3650),
  breachCheck: z.boolean(),
});

export async function PUT(req: NextRequest) {
  return handle(async () => {
    const admin = await requirePermission("security:admin");
    const input = { ...DEFAULT_POLICY, ...policySchema.parse(await req.json()) };
    await savePolicy(admin.companyId, input, admin.id);
    await writeAudit({
      companyId: admin.companyId,
      actorId: admin.id,
      action: "PASSWORD_POLICY_UPDATED",
      entityType: "Setting",
      entityId: null,
      after: input,
    });
    return { ok: true, policy: input };
  });
}

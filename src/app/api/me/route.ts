/*
 * Dentons KMN ERP
 * Copyright (c) 2026 Bouquet Innovation SA. All rights reserved.
 * Proprietary and confidential. Unauthorised copying, distribution, modification,
 * or use of this file, via any medium, is strictly prohibited.
 */
import { handle } from "@/lib/api";
import { requireUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET() {
  return handle(async () => {
    const user = await requireUser();
    return {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      locale: user.locale,
      roleKeys: user.roleKeys,
      permissions: Array.from(user.permissions),
    };
  });
}

/*
 * Dentons KMN ERP
 * Copyright (c) 2026 Bouquet Innovation SA. All rights reserved.
 * Proprietary and confidential. Unauthorised copying, distribution, modification,
 * or use of this file, via any medium, is strictly prohibited.
 */
import { handle } from "@/lib/api";
import { destroySession } from "@/lib/auth";

export async function POST() {
  return handle(async () => {
    await destroySession();
    return { ok: true };
  });
}

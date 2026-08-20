/*
 * Dentons KMN ERP
 * Copyright (c) 2026 Bouquet Innovation SA. All rights reserved.
 * Proprietary and confidential. Unauthorised copying, distribution, modification,
 * or use of this file, via any medium, is strictly prohibited.
 */
import { NextRequest } from "next/server";
import { handle } from "@/lib/api";
import { requirePermission, AuthError } from "@/lib/auth";
import { resolveIntegrations } from "@/lib/settings";
import { sharepointSearch } from "@/lib/msgraph";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// GET /api/sharepoint/search?q= — search files in the configured SharePoint
// site so a lawyer can pick one and attach it as a LINK document.
export async function GET(req: NextRequest) {
  return handle(async () => {
    const user = await requirePermission("client:manage");
    const { m365 } = await resolveIntegrations(user.companyId);
    if (!m365) return { configured: false, files: [] };
    if (!m365.sharepointHost || !m365.sharepointSite) throw new AuthError(422, "sharepoint_site_not_set");
    const q = req.nextUrl.searchParams.get("q") ?? "";
    const files = await sharepointSearch(m365, q);
    return { configured: true, files };
  });
}

/*
 * Dentons KMN ERP
 * Copyright (c) 2026 Bouquet Innovation SA. All rights reserved.
 * Proprietary and confidential. Unauthorised copying, distribution, modification,
 * or use of this file, via any medium, is strictly prohibited.
 */
import { NextRequest } from "next/server";
import { handle } from "@/lib/api";
import { requirePermission, AuthError } from "@/lib/auth";
import {
  SETTING_KEYS, setSetting, deleteSetting, resolveIntegrations, maskKey,
} from "@/lib/settings";
import { integrationsSchema } from "@/lib/validation";
import { testM365, sendTeamsMessage } from "@/lib/msgraph";
import { writeAudit } from "@/lib/audit";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

async function payload(companyId: string) {
  const { m365, teamsWebhookUrl, esignApiKey } = await resolveIntegrations(companyId);
  return {
    m365: {
      configured: !!m365,
      tenantId: m365?.tenantId ?? "",
      clientId: m365?.clientId ?? "",
      secretMasked: m365 ? maskKey(m365.clientSecret) : null,
      sharepointHost: m365?.sharepointHost ?? "",
      sharepointSite: m365?.sharepointSite ?? "",
    },
    teams: { configured: !!teamsWebhookUrl },
    esign: { configured: !!esignApiKey, keyMasked: esignApiKey ? maskKey(esignApiKey) : null },
  };
}

// GET /api/settings/integrations — current integration status (IT Admin).
export async function GET() {
  return handle(async () => {
    const admin = await requirePermission("user:manage");
    return payload(admin.companyId);
  });
}

// PUT /api/settings/integrations — save settings. Empty string clears a value.
export async function PUT(req: NextRequest) {
  return handle(async () => {
    const admin = await requirePermission("user:manage");
    const input = integrationsSchema.parse(await req.json());

    const map: [keyof typeof input, string, boolean][] = [
      ["m365TenantId", SETTING_KEYS.m365TenantId, false],
      ["m365ClientId", SETTING_KEYS.m365ClientId, false],
      ["m365ClientSecret", SETTING_KEYS.m365ClientSecret, true],
      ["m365SharepointHost", SETTING_KEYS.m365SharepointHost, false],
      ["m365SharepointSite", SETTING_KEYS.m365SharepointSite, false],
      ["teamsWebhookUrl", SETTING_KEYS.teamsWebhookUrl, true],
      ["esignApiKey", SETTING_KEYS.esignApiKey, true],
    ];
    for (const [field, key, secret] of map) {
      const v = input[field];
      if (v === undefined) continue;
      if (v === "") await deleteSetting(admin.companyId, key);
      else await setSetting(admin.companyId, key, v.trim(), { secret, updatedBy: admin.id });
    }

    await writeAudit({
      companyId: admin.companyId, actorId: admin.id, action: "INTEGRATIONS_UPDATED",
      entityType: "Setting", entityId: null,
      after: Object.fromEntries(Object.keys(input).map((k) => [k, "changed"])),
    });
    return payload(admin.companyId);
  });
}

// POST /api/settings/integrations — test a connection: {test: "m365" | "teams"}.
export async function POST(req: NextRequest) {
  return handle(async () => {
    const admin = await requirePermission("user:manage");
    const { test } = (await req.json()) as { test?: string };
    const { m365, teamsWebhookUrl } = await resolveIntegrations(admin.companyId);

    if (test === "m365") {
      if (!m365) throw new AuthError(422, "m365_not_configured");
      try {
        const r = await testM365(m365);
        return { ok: true, siteName: r.siteName };
      } catch (e) {
        return { ok: false, error: e instanceof Error ? e.message : "m365_failed" };
      }
    }
    if (test === "teams") {
      if (!teamsWebhookUrl) throw new AuthError(422, "teams_not_configured");
      const r = await sendTeamsMessage(
        teamsWebhookUrl,
        "Dentons KMN ERP — test message",
        `Teams integration is working. Sent by ${admin.fullName}.`,
      );
      return r.ok ? { ok: true } : { ok: false, error: r.reason };
    }
    throw new AuthError(422, "unknown_test");
  });
}

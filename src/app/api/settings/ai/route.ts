/*
 * Dentons KMN ERP
 * Copyright (c) 2026 Bouquet Innovation SA. All rights reserved.
 * Proprietary and confidential. Unauthorised copying, distribution, modification,
 * or use of this file, via any medium, is strictly prohibited.
 */
import { NextRequest } from "next/server";
import { z } from "zod";
import { handle } from "@/lib/api";
import { requirePermission } from "@/lib/auth";
import {
  SETTING_KEYS,
  setSetting,
  deleteSetting,
  resolveAiConfig,
  resolveGeminiConfig,
  maskKey,
} from "@/lib/settings";
import { writeAudit } from "@/lib/audit";

export const dynamic = "force-dynamic";

const putSchema = z.object({
  apiKey: z
    .string()
    .trim()
    .max(300)
    .refine((k) => k === "" || k.startsWith("sk-ant-"), {
      message: "Anthropic keys start with sk-ant-",
    })
    .optional(),
  model: z.string().trim().max(80).optional(),
  geminiApiKey: z
    .string()
    .trim()
    .max(300)
    .refine((k) => k === "" || k.startsWith("AIza"), {
      message: "Gemini keys start with AIza",
    })
    .optional(),
  geminiModel: z.string().trim().max(80).optional(),
});

async function aiSettingsPayload(companyId: string) {
  const [cfg, gem] = await Promise.all([resolveAiConfig(companyId), resolveGeminiConfig(companyId)]);
  return {
    // Anthropic (Claude) — NL reports, OCR, assistant.
    configured: !!cfg.apiKey,
    source: cfg.source, // settings | env | none
    maskedKey: cfg.apiKey ? maskKey(cfg.apiKey) : null,
    model: cfg.model,
    // Gemini — KYC internet screening (free-tier Google Search grounding).
    geminiConfigured: !!gem.apiKey,
    geminiSource: gem.source,
    geminiMaskedKey: gem.apiKey ? maskKey(gem.apiKey) : null,
    geminiModel: gem.model,
  };
}

// GET /api/settings/ai — current AI configuration (keys masked). IT Admin only.
export async function GET() {
  return handle(async () => {
    const admin = await requirePermission("user:manage");
    return aiSettingsPayload(admin.companyId);
  });
}

// PUT /api/settings/ai — set or clear the Anthropic key / model. IT Admin only.
// The key is encrypted at rest; an empty apiKey clears the in-app key (env
// fallback, if any, then applies again).
export async function PUT(req: NextRequest) {
  return handle(async () => {
    const admin = await requirePermission("user:manage");
    const input = putSchema.parse(await req.json());

    if (input.apiKey !== undefined) {
      if (input.apiKey === "") {
        await deleteSetting(admin.companyId, SETTING_KEYS.aiApiKey);
      } else {
        await setSetting(admin.companyId, SETTING_KEYS.aiApiKey, input.apiKey, {
          secret: true,
          updatedBy: admin.id,
        });
      }
    }
    if (input.model !== undefined && input.model !== "") {
      await setSetting(admin.companyId, SETTING_KEYS.aiModel, input.model, {
        updatedBy: admin.id,
      });
    }

    if (input.geminiApiKey !== undefined) {
      if (input.geminiApiKey === "") {
        await deleteSetting(admin.companyId, SETTING_KEYS.geminiApiKey);
      } else {
        await setSetting(admin.companyId, SETTING_KEYS.geminiApiKey, input.geminiApiKey, {
          secret: true,
          updatedBy: admin.id,
        });
      }
    }
    if (input.geminiModel !== undefined && input.geminiModel !== "") {
      await setSetting(admin.companyId, SETTING_KEYS.geminiModel, input.geminiModel, {
        updatedBy: admin.id,
      });
    }

    await writeAudit({
      companyId: admin.companyId,
      actorId: admin.id,
      action: "AI_SETTINGS_UPDATED",
      entityType: "Setting",
      entityId: null,
      // Never write the keys themselves to the audit log.
      after: {
        keyChanged: input.apiKey !== undefined,
        keyCleared: input.apiKey === "",
        model: input.model || undefined,
        geminiKeyChanged: input.geminiApiKey !== undefined,
        geminiKeyCleared: input.geminiApiKey === "",
        geminiModel: input.geminiModel || undefined,
      },
    });

    return aiSettingsPayload(admin.companyId);
  });
}

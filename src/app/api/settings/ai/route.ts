import { NextRequest } from "next/server";
import { z } from "zod";
import { handle } from "@/lib/api";
import { requirePermission } from "@/lib/auth";
import {
  SETTING_KEYS,
  setSetting,
  deleteSetting,
  resolveAiConfig,
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
});

// GET /api/settings/ai — current AI configuration (key masked). IT Admin only.
export async function GET() {
  return handle(async () => {
    const admin = await requirePermission("user:manage");
    const cfg = await resolveAiConfig(admin.companyId);
    return {
      configured: !!cfg.apiKey,
      source: cfg.source, // settings | env | none
      maskedKey: cfg.apiKey ? maskKey(cfg.apiKey) : null,
      model: cfg.model,
    };
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

    await writeAudit({
      companyId: admin.companyId,
      actorId: admin.id,
      action: "AI_SETTINGS_UPDATED",
      entityType: "Setting",
      entityId: null,
      // Never write the key itself to the audit log.
      after: {
        keyChanged: input.apiKey !== undefined,
        keyCleared: input.apiKey === "",
        model: input.model || undefined,
      },
    });

    const cfg = await resolveAiConfig(admin.companyId);
    return {
      configured: !!cfg.apiKey,
      source: cfg.source,
      maskedKey: cfg.apiKey ? maskKey(cfg.apiKey) : null,
      model: cfg.model,
    };
  });
}

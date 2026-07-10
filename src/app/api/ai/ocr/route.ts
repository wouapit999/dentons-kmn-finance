import { NextRequest } from "next/server";
import { z } from "zod";
import { handle } from "@/lib/api";
import { requirePermission } from "@/lib/auth";
import { extractInvoice, aiConfigured } from "@/lib/ai";
import { resolveAiConfig } from "@/lib/settings";
import { writeAudit } from "@/lib/audit";

export const dynamic = "force-dynamic";

const schema = z.object({
  base64: z.string().min(10),
  mime: z.string().min(3).max(60),
});

// POST /api/ai/ocr — extract structured fields from an invoice/receipt image or
// PDF so the AP bill form can be pre-filled. Requires ap:manage.
export async function POST(req: NextRequest) {
  return handle(async () => {
    const user = await requirePermission("ap:manage");
    const cfg = await resolveAiConfig(user.companyId);
    if (!aiConfigured(cfg)) {
      return {
        configured: false,
        error:
          "AI OCR is not configured. Ask your IT Administrator to add an Anthropic API key on the AI Assistant page.",
      };
    }
    const { base64, mime } = schema.parse(await req.json());
    const fields = await extractInvoice(base64, mime, cfg);
    await writeAudit({
      companyId: user.companyId,
      actorId: user.id,
      action: "AI_OCR_EXTRACT",
      entityType: "VendorBill",
      entityId: null,
      after: { supplierName: fields.supplierName, total: fields.total },
    });
    return { configured: true, fields };
  });
}

/*
 * Dentons KMN ERP
 * Copyright (c) 2026 Bouquet Innovation SA. All rights reserved.
 * Proprietary and confidential. Unauthorised copying, distribution, modification,
 * or use of this file, via any medium, is strictly prohibited.
 */
import { NextRequest } from "next/server";
import { handle } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { requirePermission, AuthError } from "@/lib/auth";
import { kycScreen, kycScreenGemini } from "@/lib/ai";
import { resolveAiConfig, resolveGeminiConfig } from "@/lib/settings";
import { writeAudit } from "@/lib/audit";

export const dynamic = "force-dynamic";

// POST /api/clients/:id/kyc-verify
// Runs KYC due diligence and files the report on the client:
//  - With an AI key configured: Claude web-search screening across the public
//    internet (sanctions/PEP, adverse media, registrations) with a risk rating.
//  - Without: an internal-data report (profile, history) marked as such.
// Outcome: LOW/MEDIUM risk -> kycStatus VERIFIED (amlRisk updated);
//          HIGH risk       -> stays PENDING + amlRisk HIGH for partner review.
export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  return handle(async () => {
    const user = await requirePermission("client:manage");
    const client = await prisma.client.findFirst({
      where: { id: params.id, companyId: user.companyId, deletedAt: null },
      include: {
        matters: { select: { code: true, status: true } },
        conflictChecks: { orderBy: { createdAt: "desc" }, take: 1 },
      },
    });
    if (!client) throw new AuthError(404, "not_found");

    const [anthropic, gemini] = await Promise.all([
      resolveAiConfig(user.companyId),
      resolveGeminiConfig(user.companyId),
    ]);
    const subject = {
      name: client.name, type: client.type, taxId: client.taxId, email: client.email, country: "Cameroon",
    };

    // Try each configured internet-screening engine in order. Gemini is first
    // because its free tier includes Google Search grounding (no paid credit);
    // Anthropic (Claude web search) is the fallback if a funded key is set.
    const engines: { name: string; run: () => Promise<{ report: string; riskLevel: "LOW" | "MEDIUM" | "HIGH" }> }[] = [];
    if (gemini.apiKey) engines.push({ name: "gemini", run: () => kycScreenGemini(subject, { apiKey: gemini.apiKey!, model: gemini.model }) });
    if (anthropic.apiKey) engines.push({ name: "anthropic", run: () => kycScreen(subject, anthropic) });

    let screening: string;
    let riskLevel: "LOW" | "MEDIUM" | "HIGH";
    let source: "internet" | "internal";
    let ran = false;
    riskLevel = "MEDIUM";
    source = "internal";
    screening = "";

    for (const engine of engines) {
      try {
        const r = await engine.run();
        screening = r.report;
        riskLevel = r.riskLevel;
        source = "internet";
        ran = true;
        break;
      } catch (e) {
        // Never silently swallow — log the real cause (server logs only, never the
        // client file) so failures stay diagnosable; then try the next engine.
        const detail = e instanceof Error ? `${e.name}: ${e.message}` : String(e);
        const status = (e as { status?: number })?.status;
        console.error(`kyc-verify: ${engine.name} screening failed (status=${status ?? "?"}) - ${detail}`);
      }
    }

    if (!ran) {
      if (engines.length === 0) {
        screening =
          "_Automated internet screening unavailable — no AI key configured. " +
          "This report is based on internal records only; complete manual screening " +
          "(sanctions lists, registry extracts) before onboarding high-value clients._";
        riskLevel = client.amlRisk === "HIGH" ? "HIGH" : "LOW";
      } else {
        // A key is configured but every provider errored — flag for manual review.
        screening = "_Automated internet screening failed (provider error). Manual screening required._";
        riskLevel = "MEDIUM";
      }
      source = "internal";
    }

    const lastConflict = client.conflictChecks[0];
    const report = [
      `# KYC Verification Report`,
      ``,
      `**Client:** ${client.name} (${client.type})`,
      `**Tax ID:** ${client.taxId ?? "—"}   **Email:** ${client.email ?? "—"}`,
      `**Verified by:** ${user.fullName}   **Date:** ${new Date().toISOString().slice(0, 10)}`,
      `**Screening source:** ${source === "internet" ? "Internet screening (AI-assisted web search)" : "Internal records only"}`,
      `**Risk assessment:** ${riskLevel}`,
      ``,
      `## Internal profile`,
      `- Declared AML risk at onboarding: ${client.amlRisk}`,
      `- Conflict status: ${client.conflictStatus}` +
        (lastConflict ? ` (last check ${lastConflict.createdAt.toISOString().slice(0, 10)})` : ""),
      `- Matters on file: ${client.matters.length}` +
        (client.matters.length ? ` (${client.matters.map((m) => m.code).join(", ")})` : ""),
      ``,
      `## Screening findings`,
      screening,
      ``,
      `---`,
      `Generated by Dentons KMN Finance. AI-assisted screening supports but does not ` +
        `replace the firm's regulatory KYC obligations; retain identity documents in the client file.`,
    ].join("\n");

    const verified = riskLevel !== "HIGH";
    const [doc] = await prisma.$transaction([
      prisma.clientDocument.create({
        data: {
          companyId: user.companyId,
          clientId: client.id,
          kind: "KYC_REPORT",
          filename: `kyc-report-${new Date().toISOString().slice(0, 10)}.md`,
          mime: "text/markdown",
          sizeBytes: Buffer.byteLength(report, "utf8"),
          data: Buffer.from(report, "utf8").toString("base64"),
          notes: `Risk: ${riskLevel} (${source})`,
          uploadedBy: user.id,
        },
      }),
      prisma.client.update({
        where: { id: client.id },
        data: {
          kycStatus: verified ? "VERIFIED" : "PENDING",
          amlRisk: riskLevel,
        },
      }),
    ]);

    await writeAudit({
      companyId: user.companyId,
      actorId: user.id,
      action: "KYC_VERIFIED",
      entityType: "Client",
      entityId: client.id,
      before: { kycStatus: client.kycStatus, amlRisk: client.amlRisk },
      after: { kycStatus: verified ? "VERIFIED" : "PENDING", riskLevel, source, reportDocId: doc.id },
    });

    return { kycStatus: verified ? "VERIFIED" : "PENDING", riskLevel, source, reportDocId: doc.id };
  });
}

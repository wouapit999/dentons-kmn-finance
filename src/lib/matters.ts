/*
 * Dentons KMN ERP
 * Copyright (c) 2026 Bouquet Innovation SA. All rights reserved.
 * Proprietary and confidential. Unauthorised copying, distribution, modification,
 * or use of this file, via any medium, is strictly prohibited.
 */
import "server-only";
import { prisma } from "./prisma";
import { AuthError } from "./auth";

interface MatterDetailInput {
  nature?: string;
  adversary?: string;
  mainLawyerId?: string;
  courtType?: string;
  courtLocation?: string;
  audienceAt?: string;
  notes?: string;
}

/**
 * Translate the optional litigation/summary fields from a validated request body
 * into a Prisma data patch. Empty strings clear the field; an absent field is
 * left untouched. `audienceAt` (a datetime-local string) becomes a Date.
 */
export function matterDetailData(input: MatterDetailInput): Record<string, unknown> {
  const d: Record<string, unknown> = {};
  if (input.nature !== undefined) d.nature = input.nature || null;
  if (input.adversary !== undefined) d.adversary = input.adversary || null;
  if (input.mainLawyerId !== undefined) d.mainLawyerId = input.mainLawyerId || null;
  if (input.courtType !== undefined) d.courtType = input.courtType || null;
  if (input.courtLocation !== undefined) d.courtLocation = input.courtLocation || null;
  if (input.notes !== undefined) d.notes = input.notes || null;
  if (input.audienceAt !== undefined) {
    if (input.audienceAt) {
      const dt = new Date(input.audienceAt);
      d.audienceAt = isNaN(dt.getTime()) ? null : dt;
    } else {
      d.audienceAt = null;
    }
  }
  return d;
}

/** Ensure a chosen main lawyer is an active employee of this company. */
export async function assertMainLawyer(companyId: string, mainLawyerId?: string): Promise<void> {
  if (!mainLawyerId) return;
  const emp = await prisma.employee.findFirst({
    where: { id: mainLawyerId, companyId, status: "ACTIVE" },
    select: { id: true },
  });
  if (!emp) throw new AuthError(422, "invalid_main_lawyer");
}

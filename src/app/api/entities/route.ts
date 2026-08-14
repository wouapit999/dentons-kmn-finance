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
import { legalEntitySchema, exchangeRateSchema } from "@/lib/validation";
import { writeAudit } from "@/lib/audit";

export const dynamic = "force-dynamic";

// GET /api/entities — global structure: entities, offices and current FX rates.
export async function GET() {
  return handle(async () => {
    const user = await requirePermission("proforma:read");
    const [entities, offices, rates, company] = await Promise.all([
      prisma.legalEntity.findMany({
        where: { companyId: user.companyId },
        orderBy: { code: "asc" },
        include: { _count: { select: { matters: true, proformas: true } } },
      }),
      prisma.office.findMany({ where: { companyId: user.companyId }, orderBy: { name: "asc" } }),
      prisma.exchangeRate.findMany({
        where: { companyId: user.companyId },
        orderBy: [{ currency: "asc" }, { asOf: "desc" }],
      }),
      prisma.company.findUnique({ where: { id: user.companyId }, select: { baseCurrency: true } }),
    ]);

    // Latest rate per currency.
    const latest = new Map<string, { rate: number; asOf: Date }>();
    for (const r of rates) {
      if (!latest.has(r.currency)) latest.set(r.currency, { rate: Number(r.rate), asOf: r.asOf });
    }

    return {
      baseCurrency: company?.baseCurrency ?? "XAF",
      entities: entities.map((e) => ({
        id: e.id, code: e.code, name: e.name, baseCurrency: e.baseCurrency,
        countryCode: e.countryCode, taxId: e.taxId, isDefault: e.isDefault,
        matters: e._count.matters, proformas: e._count.proformas,
      })),
      offices: offices.map((o) => ({
        id: o.id, name: o.name, countryCode: o.countryCode, currency: o.currency, timezone: o.timezone,
      })),
      rates: Array.from(latest.entries()).map(([currency, v]) => ({
        currency, rate: v.rate, asOf: v.asOf,
      })),
    };
  });
}

// POST /api/entities — create a legal entity, or set an FX rate when the body
// carries { fx: {...} }. Both require entity:manage (CFO).
export async function POST(req: NextRequest) {
  return handle(async () => {
    const user = await requirePermission("entity:manage");
    const body = await req.json();

    if (body && typeof body === "object" && "fx" in body) {
      const input = exchangeRateSchema.parse((body as { fx: unknown }).fx);
      const asOf = new Date(input.asOf);
      if (isNaN(asOf.getTime())) throw new AuthError(422, "invalid_date");
      const rate = await prisma.exchangeRate.upsert({
        where: {
          companyId_currency_asOf: {
            companyId: user.companyId, currency: input.currency.toUpperCase(), asOf,
          },
        },
        update: { rate: input.rate },
        create: {
          companyId: user.companyId, currency: input.currency.toUpperCase(),
          rate: input.rate, asOf,
        },
      });
      await writeAudit({
        companyId: user.companyId, actorId: user.id, action: "FX_RATE_SET",
        entityType: "ExchangeRate", entityId: rate.id,
        after: { currency: rate.currency, rate: Number(rate.rate), asOf: rate.asOf },
      });
      return { id: rate.id, currency: rate.currency, rate: Number(rate.rate) };
    }

    const input = legalEntitySchema.parse(body);
    const clash = await prisma.legalEntity.findFirst({
      where: { companyId: user.companyId, code: input.code },
      select: { id: true },
    });
    if (clash) throw new AuthError(409, "entity_code_exists");

    const created = await prisma.$transaction(async (tx) => {
      if (input.isDefault) {
        await tx.legalEntity.updateMany({
          where: { companyId: user.companyId, isDefault: true },
          data: { isDefault: false },
        });
      }
      return tx.legalEntity.create({
        data: {
          companyId: user.companyId,
          code: input.code,
          name: input.name,
          baseCurrency: input.baseCurrency,
          countryCode: input.countryCode.toUpperCase(),
          taxId: input.taxId || null,
          isDefault: input.isDefault,
        },
      });
    });

    await writeAudit({
      companyId: user.companyId, actorId: user.id, action: "ENTITY_CREATED",
      entityType: "LegalEntity", entityId: created.id,
      after: { code: created.code, name: created.name },
    });
    return { id: created.id, code: created.code };
  });
}

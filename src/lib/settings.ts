// Per-company settings store. Secret values (API keys) are encrypted at rest
// with AES-256-GCM using a key derived from AUTH_SECRET, so a database dump
// alone does not expose them.
import "server-only";
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "crypto";
import { prisma } from "./prisma";

export const SETTING_KEYS = {
  aiApiKey: "ai.anthropic_api_key", // encrypted
  aiModel: "ai.model", // plain
} as const;

const ENC_PREFIX = "enc:v1:";

function encKey(): Buffer {
  const secret = process.env.AUTH_SECRET ?? "insecure-dev-secret-change-me-please-32chars";
  return createHash("sha256").update(secret).digest();
}

export function encrypt(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encKey(), iv);
  const data = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return ENC_PREFIX + Buffer.concat([iv, tag, data]).toString("base64");
}

export function decrypt(stored: string): string | null {
  if (!stored.startsWith(ENC_PREFIX)) return stored;
  try {
    const raw = Buffer.from(stored.slice(ENC_PREFIX.length), "base64");
    const iv = raw.subarray(0, 12);
    const tag = raw.subarray(12, 28);
    const data = raw.subarray(28);
    const decipher = createDecipheriv("aes-256-gcm", encKey(), iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(data), decipher.final()]).toString("utf8");
  } catch {
    // Wrong AUTH_SECRET or corrupted value.
    return null;
  }
}

export async function getSetting(companyId: string, key: string): Promise<string | null> {
  const row = await prisma.setting.findUnique({
    where: { companyId_key: { companyId, key } },
  });
  if (!row) return null;
  return decrypt(row.value);
}

export async function setSetting(
  companyId: string,
  key: string,
  value: string,
  opts: { secret?: boolean; updatedBy?: string } = {},
): Promise<void> {
  const stored = opts.secret ? encrypt(value) : value;
  await prisma.setting.upsert({
    where: { companyId_key: { companyId, key } },
    update: { value: stored, updatedBy: opts.updatedBy ?? null },
    create: { companyId, key, value: stored, updatedBy: opts.updatedBy ?? null },
  });
}

export async function deleteSetting(companyId: string, key: string): Promise<void> {
  await prisma.setting.deleteMany({ where: { companyId, key } });
}

/**
 * Resolve the AI configuration for a company: the in-app key (set by the IT
 * Administrator) wins; the ANTHROPIC_API_KEY env var is the fallback.
 */
export async function resolveAiConfig(
  companyId: string,
): Promise<{ apiKey: string | null; model: string; source: "settings" | "env" | "none" }> {
  const [dbKey, dbModel] = await Promise.all([
    getSetting(companyId, SETTING_KEYS.aiApiKey),
    getSetting(companyId, SETTING_KEYS.aiModel),
  ]);
  // Strip a possible BOM / stray whitespace (shells prepend U+FEFF when a value
  // is piped into `vercel env add`), which would otherwise make Anthropic reject
  // the key or model id.
  const clean = (v: string | null | undefined) => (v ? v.replace(/^﻿/, "").trim() : "");
  const model = clean(dbModel) || clean(process.env.AI_MODEL) || "claude-sonnet-5";
  const settingsKey = clean(dbKey);
  const envKey = clean(process.env.ANTHROPIC_API_KEY);
  if (settingsKey) return { apiKey: settingsKey, model, source: "settings" };
  if (envKey) return { apiKey: envKey, model, source: "env" };
  return { apiKey: null, model, source: "none" };
}

/** Mask a key for display: sk-ant-••••••••1234 */
export function maskKey(key: string): string {
  if (key.length <= 8) return "••••••••";
  return key.slice(0, 7) + "••••••••" + key.slice(-4);
}

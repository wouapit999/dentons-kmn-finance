/*
 * Dentons KMN ERP
 * Copyright (c) 2026 Bouquet Innovation SA. All rights reserved.
 * Proprietary and confidential. Unauthorised copying, distribution, modification,
 * or use of this file, via any medium, is strictly prohibited.
 */
// Microsoft 365 integration via the Graph REST API (client-credentials flow —
// an Azure AD app registration with Sites.Read.All application permission).
// Teams notifications use a channel Incoming Webhook (no Azure app needed).
import "server-only";
import type { M365Config } from "./settings";

const GRAPH = "https://graph.microsoft.com/v1.0";

async function graphToken(cfg: M365Config): Promise<string> {
  const res = await fetch(`https://login.microsoftonline.com/${encodeURIComponent(cfg.tenantId)}/oauth2/v2.0/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: cfg.clientId,
      client_secret: cfg.clientSecret,
      scope: "https://graph.microsoft.com/.default",
      grant_type: "client_credentials",
    }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`m365_token_${res.status}: ${body.slice(0, 200)}`);
  }
  const data = (await res.json()) as { access_token?: string };
  if (!data.access_token) throw new Error("m365_token_missing");
  return data.access_token;
}

async function graphGet<T>(token: string, path: string): Promise<T> {
  const res = await fetch(`${GRAPH}${path}`, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`m365_graph_${res.status}: ${body.slice(0, 200)}`);
  }
  return (await res.json()) as T;
}

export interface SharePointFile {
  id: string;
  name: string;
  webUrl: string;
  size: number | null;
  lastModified: string | null;
}

/** Verify the connection: token + resolve the configured SharePoint site. */
export async function testM365(cfg: M365Config): Promise<{ ok: true; siteName: string | null }> {
  const token = await graphToken(cfg);
  if (cfg.sharepointHost && cfg.sharepointSite) {
    const site = await graphGet<{ displayName?: string }>(
      token,
      `/sites/${encodeURIComponent(cfg.sharepointHost)}:/${cfg.sharepointSite.replace(/^\/+/, "")}`,
    );
    return { ok: true, siteName: site.displayName ?? null };
  }
  await graphGet(token, "/sites?search=*&$top=1");
  return { ok: true, siteName: null };
}

/** Search files in the configured SharePoint site's default document library. */
export async function sharepointSearch(cfg: M365Config, query: string): Promise<SharePointFile[]> {
  const token = await graphToken(cfg);
  const site = await graphGet<{ id: string }>(
    token,
    `/sites/${encodeURIComponent(cfg.sharepointHost)}:/${cfg.sharepointSite.replace(/^\/+/, "")}`,
  );
  const q = query.trim() || "*";
  const result = await graphGet<{ value?: { id: string; name: string; webUrl: string; size?: number; lastModifiedDateTime?: string; folder?: unknown }[] }>(
    token,
    `/sites/${site.id}/drive/root/search(q='${encodeURIComponent(q.replace(/'/g, ""))}')?$top=25`,
  );
  return (result.value ?? [])
    .filter((f) => !f.folder)
    .map((f) => ({
      id: f.id,
      name: f.name,
      webUrl: f.webUrl,
      size: f.size ?? null,
      lastModified: f.lastModifiedDateTime ?? null,
    }));
}

/** Post a message card to a Teams channel via its Incoming Webhook URL. */
export async function sendTeamsMessage(
  webhookUrl: string,
  title: string,
  text: string,
): Promise<{ ok: boolean; reason?: string }> {
  try {
    const res = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        "@type": "MessageCard",
        "@context": "http://schema.org/extensions",
        themeColor: "6D28D9",
        summary: title,
        title,
        text,
      }),
    });
    if (!res.ok) return { ok: false, reason: `teams_${res.status}` };
    return { ok: true };
  } catch (e) {
    return { ok: false, reason: e instanceof Error ? e.message : "teams_failed" };
  }
}

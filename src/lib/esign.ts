/*
 * Dentons KMN ERP
 * Copyright (c) 2026 Bouquet Innovation SA. All rights reserved.
 * Proprietary and confidential. Unauthorised copying, distribution, modification,
 * or use of this file, via any medium, is strictly prohibited.
 */
// E-signature via the Dropbox Sign (HelloSign) REST API. API key comes from the
// per-company integration settings. test_mode=1 is used automatically for keys
// on free/test accounts (Dropbox Sign ignores the flag on paid production sends
// only when disabled account-side, so it is safe to always pass it via env).
import "server-only";

const API = "https://api.hellosign.com/v3";

function authHeader(apiKey: string): string {
  return "Basic " + Buffer.from(`${apiKey}:`).toString("base64");
}

export async function sendSignatureRequest(
  apiKey: string,
  opts: {
    title: string;
    subject: string;
    message?: string;
    signerName: string;
    signerEmail: string;
    fileBase64: string;
    filename: string;
    testMode?: boolean;
  },
): Promise<{ requestId: string; status: string }> {
  const form = new FormData();
  form.append("title", opts.title);
  form.append("subject", opts.subject);
  if (opts.message) form.append("message", opts.message);
  form.append("signers[0][name]", opts.signerName);
  form.append("signers[0][email_address]", opts.signerEmail);
  form.append("test_mode", opts.testMode === false ? "0" : "1");
  const bytes = Buffer.from(opts.fileBase64, "base64");
  form.append("files[0]", new Blob([new Uint8Array(bytes)], { type: "application/pdf" }), opts.filename);

  const res = await fetch(`${API}/signature_request/send`, {
    method: "POST",
    headers: { Authorization: authHeader(apiKey) },
    body: form,
  });
  const body = (await res.json().catch(() => ({}))) as {
    signature_request?: { signature_request_id: string; is_complete: boolean };
    error?: { error_msg?: string };
  };
  if (!res.ok || !body.signature_request) {
    throw new Error(body.error?.error_msg || `esign_send_${res.status}`);
  }
  return {
    requestId: body.signature_request.signature_request_id,
    status: body.signature_request.is_complete ? "SIGNED" : "SENT",
  };
}

export async function getSignatureStatus(
  apiKey: string,
  requestId: string,
): Promise<{ status: "SENT" | "VIEWED" | "SIGNED" | "DECLINED"; detail: string | null }> {
  const res = await fetch(`${API}/signature_request/${encodeURIComponent(requestId)}`, {
    headers: { Authorization: authHeader(apiKey) },
  });
  const body = (await res.json().catch(() => ({}))) as {
    signature_request?: {
      is_complete: boolean;
      is_declined: boolean;
      signatures?: { status_code?: string; last_viewed_at?: number | null }[];
    };
    error?: { error_msg?: string };
  };
  if (!res.ok || !body.signature_request) {
    throw new Error(body.error?.error_msg || `esign_status_${res.status}`);
  }
  const sr = body.signature_request;
  if (sr.is_declined) return { status: "DECLINED", detail: null };
  if (sr.is_complete) return { status: "SIGNED", detail: null };
  const viewed = (sr.signatures ?? []).some((s) => !!s.last_viewed_at);
  return { status: viewed ? "VIEWED" : "SENT", detail: sr.signatures?.[0]?.status_code ?? null };
}

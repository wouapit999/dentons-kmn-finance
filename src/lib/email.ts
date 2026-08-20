/*
 * Dentons KMN ERP
 * Copyright (c) 2026 Bouquet Innovation SA. All rights reserved.
 * Proprietary and confidential. Unauthorised copying, distribution, modification,
 * or use of this file, via any medium, is strictly prohibited.
 */
import "server-only";

// Lightweight transactional email via the Resend HTTP API (no SDK dependency).
// Enabled when RESEND_API_KEY is set; otherwise send() no-ops and reports why,
// so callers can degrade gracefully (log / in-app notification) instead of
// failing the operation.
export interface SendResult {
  sent: boolean;
  reason?: string;
  id?: string;
}

export function emailConfigured(): boolean {
  return !!process.env.RESEND_API_KEY;
}

export async function sendEmail(opts: {
  to: string | string[];
  subject: string;
  text: string;
  html?: string;
}): Promise<SendResult> {
  const key = process.env.RESEND_API_KEY;
  if (!key) return { sent: false, reason: "no_email_provider" };

  // A verified sender is required by Resend. Configure EMAIL_FROM to a verified
  // address on your domain (e.g. "Dentons KMN ERP <no-reply@bouquet-innovation.net>").
  const from = process.env.EMAIL_FROM || "Dentons KMN ERP <onboarding@resend.dev>";
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        from,
        to: Array.isArray(opts.to) ? opts.to : [opts.to],
        subject: opts.subject,
        text: opts.text,
        ...(opts.html ? { html: opts.html } : {}),
      }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      return { sent: false, reason: `provider_error_${res.status}: ${body.slice(0, 200)}` };
    }
    const data = (await res.json().catch(() => ({}))) as { id?: string };
    return { sent: true, id: data.id };
  } catch (e) {
    return { sent: false, reason: e instanceof Error ? e.message : "send_failed" };
  }
}

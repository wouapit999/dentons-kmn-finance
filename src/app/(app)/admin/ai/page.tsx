"use client";
/*
 * Dentons KMN ERP
 * Copyright (c) 2026 Bouquet Innovation SA. All rights reserved.
 * Proprietary and confidential. Unauthorised copying, distribution, modification,
 * or use of this file, via any medium, is strictly prohibited.
 */
import { useT } from "@/lib/useT";
import { AiSettingsCard } from "@/components/ai-settings-card";

// Dedicated AI configuration page for the IT Administrator. The nav entry and the
// underlying API are gated on user:manage; the card renders a notice if reached
// without the permission.
export default function AdminAiPage() {
  const t = useT();
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">{t("ai.settings")}</h1>
        <p className="text-sm text-slate-500">{t("ai.adminSubtitle")}</p>
      </div>
      <AiSettingsCard />
    </div>
  );
}

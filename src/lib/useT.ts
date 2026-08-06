"use client";
/*
 * Dentons KMN ERP
 * Copyright (c) 2026 Bouquet Innovation SA. All rights reserved.
 * Proprietary and confidential. Unauthorised copying, distribution, modification,
 * or use of this file, via any medium, is strictly prohibited.
 */
import { useUi } from "./store";
import { t, type MessageKey } from "./i18n";

/** Client translation hook bound to the UI locale store. */
export function useT() {
  const locale = useUi((s) => s.locale);
  return (key: MessageKey) => t(locale, key);
}

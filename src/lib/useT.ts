"use client";
import { useUi } from "./store";
import { t, type MessageKey } from "./i18n";

/** Client translation hook bound to the UI locale store. */
export function useT() {
  const locale = useUi((s) => s.locale);
  return (key: MessageKey) => t(locale, key);
}

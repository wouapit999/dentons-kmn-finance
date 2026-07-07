// Money formatting. Amounts are stored as Decimal (NUMERIC) and never as float.
// Presentation rounding follows each currency's minor units (XAF has 0).

const MINOR_UNITS: Record<string, number> = {
  XAF: 0,
  XOF: 0,
  EUR: 2,
  USD: 2,
  GBP: 2,
};

export function minorUnits(currency: string): number {
  return MINOR_UNITS[currency] ?? 2;
}

/** Format an amount (number or Decimal-like string) for display. */
export function formatMoney(amount: number | string, currency = "XAF"): string {
  const n = typeof amount === "string" ? Number(amount) : amount;
  const digits = minorUnits(currency);
  return new Intl.NumberFormat("en", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(n) + " " + currency;
}

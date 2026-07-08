// A starter SYSCOHADA (OHADA) chart of accounts for Cameroon, mapped to the
// five IFRS-reportable account types. This is a practical subset; the full
// plan can be extended via the Chart of Accounts screen (gl:manage).

export interface SeedAccount {
  code: string;
  name: string;
  type: "ASSET" | "LIABILITY" | "EQUITY" | "REVENUE" | "EXPENSE";
  syscohadaClass: string;
  ifrsCategory: string;
  isPostable?: boolean;
}

export const CHART_OF_ACCOUNTS: SeedAccount[] = [
  // Class 1 — Equity & long-term liabilities
  { code: "101000", name: "Share capital", type: "EQUITY", syscohadaClass: "1", ifrsCategory: "Equity" },
  { code: "110000", name: "Retained earnings", type: "EQUITY", syscohadaClass: "1", ifrsCategory: "Equity" },
  { code: "120000", name: "Result for the period", type: "EQUITY", syscohadaClass: "1", ifrsCategory: "Equity" },
  { code: "162000", name: "Bank loans", type: "LIABILITY", syscohadaClass: "1", ifrsCategory: "Non-current liabilities" },

  // Class 2 — Fixed assets
  { code: "213000", name: "Software & licenses", type: "ASSET", syscohadaClass: "2", ifrsCategory: "Intangible assets" },
  { code: "244000", name: "Office furniture & equipment", type: "ASSET", syscohadaClass: "2", ifrsCategory: "Property, plant & equipment" },
  { code: "245000", name: "IT equipment", type: "ASSET", syscohadaClass: "2", ifrsCategory: "Property, plant & equipment" },
  { code: "281000", name: "Accumulated depreciation", type: "ASSET", syscohadaClass: "2", ifrsCategory: "Property, plant & equipment" },

  // Class 3 — Inventory (minimal for a law firm)
  { code: "311000", name: "Office supplies inventory", type: "ASSET", syscohadaClass: "3", ifrsCategory: "Inventories" },

  // Class 4 — Third parties (receivables/payables)
  { code: "411000", name: "Clients (accounts receivable)", type: "ASSET", syscohadaClass: "4", ifrsCategory: "Trade receivables" },
  { code: "401000", name: "Suppliers (accounts payable)", type: "LIABILITY", syscohadaClass: "4", ifrsCategory: "Trade payables" },
  { code: "421000", name: "Personnel — salaries payable", type: "LIABILITY", syscohadaClass: "4", ifrsCategory: "Employee liabilities" },
  { code: "431000", name: "CNPS payable", type: "LIABILITY", syscohadaClass: "4", ifrsCategory: "Social security payable" },
  { code: "443100", name: "VAT collected (output)", type: "LIABILITY", syscohadaClass: "4", ifrsCategory: "Tax payable" },
  { code: "445200", name: "VAT deductible (input)", type: "ASSET", syscohadaClass: "4", ifrsCategory: "Tax receivable" },
  { code: "447000", name: "PAYE / withholding tax payable", type: "LIABILITY", syscohadaClass: "4", ifrsCategory: "Tax payable" },
  { code: "449000", name: "Withholding tax receivable (suffered)", type: "ASSET", syscohadaClass: "4", ifrsCategory: "Tax receivable" },
  { code: "462000", name: "Client trust liability (funds held)", type: "LIABILITY", syscohadaClass: "4", ifrsCategory: "Client money" },

  // Class 5 — Treasury (cash & bank)
  { code: "521000", name: "Bank — operating account", type: "ASSET", syscohadaClass: "5", ifrsCategory: "Cash & cash equivalents" },
  { code: "522000", name: "Bank — trust account", type: "ASSET", syscohadaClass: "5", ifrsCategory: "Cash & cash equivalents" },
  { code: "571000", name: "Petty cash", type: "ASSET", syscohadaClass: "5", ifrsCategory: "Cash & cash equivalents" },

  // Class 6 — Expenses
  { code: "601000", name: "Office supplies expense", type: "EXPENSE", syscohadaClass: "6", ifrsCategory: "Operating expenses" },
  { code: "622000", name: "Professional & legal fees", type: "EXPENSE", syscohadaClass: "6", ifrsCategory: "Operating expenses" },
  { code: "624000", name: "Travel & disbursements", type: "EXPENSE", syscohadaClass: "6", ifrsCategory: "Operating expenses" },
  { code: "627000", name: "Bank charges", type: "EXPENSE", syscohadaClass: "6", ifrsCategory: "Finance costs" },
  { code: "641000", name: "Salaries & wages", type: "EXPENSE", syscohadaClass: "6", ifrsCategory: "Employee benefits" },
  { code: "645000", name: "Employer social charges (CNPS)", type: "EXPENSE", syscohadaClass: "6", ifrsCategory: "Employee benefits" },
  { code: "681000", name: "Depreciation expense", type: "EXPENSE", syscohadaClass: "6", ifrsCategory: "Depreciation & amortisation" },

  // Class 7 — Revenue
  { code: "706000", name: "Legal fee income", type: "REVENUE", syscohadaClass: "7", ifrsCategory: "Revenue" },
  { code: "707000", name: "Disbursement recoveries", type: "REVENUE", syscohadaClass: "7", ifrsCategory: "Revenue" },
  { code: "771000", name: "Interest income", type: "REVENUE", syscohadaClass: "7", ifrsCategory: "Finance income" },
  { code: "776000", name: "Foreign exchange gains", type: "REVENUE", syscohadaClass: "7", ifrsCategory: "Finance income" },
];

export const JOURNALS: { code: string; name: string; type: string }[] = [
  { code: "SAL", name: "Sales / Billing Journal", type: "SALES" },
  { code: "PUR", name: "Purchases Journal", type: "PURCHASES" },
  { code: "BNK", name: "Bank Journal", type: "BANK" },
  { code: "CSH", name: "Cash Journal", type: "CASH" },
  { code: "GEN", name: "General Journal", type: "GENERAL" },
  { code: "PAY", name: "Payroll Journal", type: "PAYROLL" },
];

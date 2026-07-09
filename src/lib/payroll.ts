// Cameroon payroll computation engine.
//
// All rates and tables are gathered here so future statutory changes are a
// single-file edit. Figures are monthly XAF, rounded to whole francs.
// This is a practical implementation of the common Cameroon scheme; verify the
// current-year rates with your accountant before production payroll.

export const PAYROLL_RATES = {
  cnpsCeilingMonthly: 750_000, // CNPS contribution ceiling
  cnpsEmployeePension: 0.042, // employee old-age pension
  cnpsEmployerPension: 0.042, // employer old-age pension
  cnpsEmployerFamily: 0.07, // employer family allowances
  cnpsEmployerRisk: 0.0175, // employer industrial-accident (indicative)
  cfcEmployee: 0.01, // Crédit Foncier employee
  cfcEmployer: 0.015, // Crédit Foncier employer
  fneEmployer: 0.01, // National Employment Fund (employer)
  professionalAbatement: 0.3, // 30% professional-expenses abatement for IRPP
  cacRate: 0.1, // Additional Council Tax = 10% of IRPP
};

// IRPP (personal income tax) — annual progressive bands on net taxable income.
export const IRPP_BANDS = [
  { upTo: 2_000_000, rate: 0.1 },
  { upTo: 3_000_000, rate: 0.15 },
  { upTo: 5_000_000, rate: 0.25 },
  { upTo: Infinity, rate: 0.35 },
];

// CRTV / RAV (audiovisual royalty) — fixed monthly amount by taxable-salary band.
export const CRTV_TABLE = [
  { upTo: 50_000, amount: 0 },
  { upTo: 100_000, amount: 750 },
  { upTo: 200_000, amount: 1_950 },
  { upTo: 300_000, amount: 3_250 },
  { upTo: 400_000, amount: 4_550 },
  { upTo: 500_000, amount: 5_850 },
  { upTo: 600_000, amount: 7_150 },
  { upTo: 700_000, amount: 8_450 },
  { upTo: 800_000, amount: 9_750 },
  { upTo: 900_000, amount: 11_050 },
  { upTo: 1_000_000, amount: 12_350 },
  { upTo: Infinity, amount: 13_000 },
];

const r = (n: number) => Math.round(n);

function progressiveIrppAnnual(annualTaxable: number): number {
  let tax = 0;
  let lower = 0;
  for (const band of IRPP_BANDS) {
    if (annualTaxable <= lower) break;
    const slice = Math.min(annualTaxable, band.upTo) - lower;
    if (slice > 0) tax += slice * band.rate;
    lower = band.upTo;
  }
  return tax;
}

function crtvFor(taxableMonthly: number): number {
  for (const b of CRTV_TABLE) if (taxableMonthly <= b.upTo) return b.amount;
  return 0;
}

export interface PayslipFigures {
  gross: number;
  cnpsBase: number;
  cnpsEmployee: number;
  cnpsEmployer: number;
  cfcEmployee: number;
  cfcEmployer: number;
  fne: number;
  taxableMonthly: number;
  irpp: number;
  cac: number;
  crtv: number;
  employeeDeductions: number;
  employerCharges: number;
  net: number;
}

/** Compute a monthly payslip from gross components. */
export function computePayslip(
  baseSalary: number,
  housingAllowance = 0,
  transportAllowance = 0,
): PayslipFigures {
  const R = PAYROLL_RATES;
  const gross = r(baseSalary + housingAllowance + transportAllowance);

  const cnpsBase = Math.min(gross, R.cnpsCeilingMonthly);
  const cnpsEmployee = r(cnpsBase * R.cnpsEmployeePension);
  const cnpsEmployer = r(
    cnpsBase * (R.cnpsEmployerPension + R.cnpsEmployerFamily + R.cnpsEmployerRisk),
  );
  const cfcEmployee = r(gross * R.cfcEmployee);
  const cfcEmployer = r(gross * R.cfcEmployer);
  const fne = r(gross * R.fneEmployer);

  // IRPP base: gross less CNPS, then the 30% professional abatement.
  const afterCnps = gross - cnpsEmployee;
  const taxableMonthly = r(afterCnps * (1 - R.professionalAbatement));
  const irpp = r(progressiveIrppAnnual(taxableMonthly * 12) / 12);
  const cac = r(irpp * R.cacRate);
  const crtv = crtvFor(taxableMonthly);

  const employeeDeductions = cnpsEmployee + irpp + cac + crtv + cfcEmployee;
  const employerCharges = cnpsEmployer + cfcEmployer + fne;
  const net = gross - employeeDeductions;

  return {
    gross,
    cnpsBase,
    cnpsEmployee,
    cnpsEmployer,
    cfcEmployee,
    cfcEmployer,
    fne,
    taxableMonthly,
    irpp,
    cac,
    crtv,
    employeeDeductions,
    employerCharges,
    net,
  };
}

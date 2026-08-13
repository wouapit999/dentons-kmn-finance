/*
 * Dentons KMN ERP
 * Copyright (c) 2026 Bouquet Innovation SA. All rights reserved.
 * Proprietary and confidential. Unauthorised copying, distribution, modification,
 * or use of this file, via any medium, is strictly prohibited.
 */
// Payslip (bulletin de paie) document generator - one payslip per employee on a
// Dentons KMN letterhead, in English or French, as PDF or DOCX. Pure JS
// (pdf-lib + docx), so it runs on serverless with no native binaries.
import "server-only";
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, WidthType,
  AlignmentType, BorderStyle, PageBreak, ShadingType,
} from "docx";

export type PayLang = "en" | "fr";

export interface PayslipData {
  matricule: string;
  name: string;
  position: string | null;
  cnpsNo: string | null;
  baseSalary: number;
  housingAllowance: number;
  transportAllowance: number;
  gross: number;
  cnpsEmployee: number;
  cfcEmployee: number;
  crtv: number;
  irpp: number;
  cac: number;
  totalDeductions: number;
  net: number;
}
export interface PayslipRun {
  company: string;
  period: string; // e.g. "February 2024"
  items: PayslipData[];
}

const L: Record<PayLang, Record<string, string>> = {
  en: {
    payslip: "PAYSLIP", month: "For the month of", staffId: "Staff ID", name: "Full name",
    position: "Position", cnps: "CNPS No.", code: "CODE", libelle: "DESCRIPTION", base: "BASE",
    rate: "RATE/QTY", gains: "EARNINGS", retenues: "DEDUCTIONS",
    baseSalary: "Base salary", housing: "Housing allowance", transport: "Transport allowance",
    grossSalary: "Gross salary", cnpsEmp: "CNPS employee contribution",
    cfc: "Housing fund (employee)", crtv: "Audiovisual fee (RAV)", irpp: "Income tax (IRPP)",
    cac: "Council additional tax (CAC)", totalGains: "TOTAL EARNINGS", totalRet: "TOTAL DEDUCTIONS",
    net: "NET PAY", sBrut: "GROSS", sIrpp: "IRPP", sTcRav: "CT/RAV", sCac: "CAC", sCnps: "CNPS",
    sCf: "HOUSING", footer: "Computer-generated payslip - Dentons KMN ERP by Bouquet Innovation SA",
  },
  fr: {
    payslip: "BULLETIN DE PAIE", month: "Du mois de", staffId: "Matricule", name: "Nom & Prenom",
    position: "Emploi", cnps: "N° CNPS", code: "CODE", libelle: "LIBELLE", base: "BASE",
    rate: "TAUX/NB", gains: "GAINS", retenues: "RETENUES",
    baseSalary: "Salaire de base", housing: "Indemnite de logement", transport: "Indemnite de transport",
    grossSalary: "Salaire brut", cnpsEmp: "Cot. PV CNPS part ouvriere",
    cfc: "Credit foncier part ouvriere", crtv: "Redevance audio-visuelle", irpp: "IRPP mensuel",
    cac: "CAC sur IRPP", totalGains: "TOTAL DES GAINS", totalRet: "TOTAL DES RETENUES",
    net: "NET A PAYER", sBrut: "BRUT", sIrpp: "IRPP", sTcRav: "TC/RAV", sCac: "C.A.C", sCnps: "CNPS",
    sCf: "CF", footer: "Bulletin genere par ordinateur - Dentons KMN ERP par Bouquet Innovation SA",
  },
};

function money(n: number, lang: PayLang): string {
  const sep = lang === "fr" ? "." : ",";
  return Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, sep);
}
// WinAnsi-safe text for pdf-lib.
function enc(s: string): string {
  return String(s).replace(/[’]/g, "'").replace(/[–—]/g, "-").replace(/[^\x20-\x7E -ÿ]/g, "");
}

// Earnings and deduction line rows for one payslip.
function rows(d: PayslipData, t: Record<string, string>) {
  const earnings = [
    { code: "0100", label: t.baseSalary, base: d.baseSalary, amount: d.baseSalary },
    { code: "0132", label: t.housing, base: d.housingAllowance, amount: d.housingAllowance },
    { code: "0315", label: t.transport, base: d.transportAllowance, amount: d.transportAllowance },
  ].filter((r) => r.amount > 0);
  const deductions = [
    { code: "7042", label: t.cnpsEmp, base: Math.min(d.gross, 750000), amount: d.cnpsEmployee },
    { code: "7020", label: t.cfc, base: d.gross, amount: d.cfcEmployee },
    { code: "7035", label: t.crtv, base: d.gross, amount: d.crtv },
    { code: "7070", label: t.irpp, base: d.gross, amount: d.irpp },
    { code: "7080", label: t.cac, base: d.irpp, amount: d.cac },
  ].filter((r) => r.amount > 0);
  return { earnings, deductions };
}

// ============================ PDF ============================
export async function buildPayslipsPdf(run: PayslipRun, lang: PayLang): Promise<Buffer> {
  const t = L[lang];
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const W = 595.28, H = 841.89, M = 40;
  const PURPLE = rgb(0.43, 0.13, 0.47), INK = rgb(0.1, 0.1, 0.12), GRAY = rgb(0.45, 0.45, 0.5), LINE = rgb(0.8, 0.8, 0.82), HEADBG = rgb(0.95, 0.93, 0.97);

  for (const d of run.items) {
    const page = pdf.addPage([W, H]);
    let y = H - M;
    const txt = (s: string, x: number, yy: number, o: { size?: number; f?: PDFFont; color?: any; right?: number } = {}) => {
      const size = o.size ?? 9, f = o.f ?? font;
      const str = enc(s);
      const x2 = o.right != null ? o.right - f.widthOfTextAtSize(str, size) : x;
      page.drawText(str, { x: x2, y: yy, size, font: f, color: o.color ?? INK });
    };

    // --- Letterhead (Dentons KMN wordmark) ---
    page.drawRectangle({ x: M, y: y - 30, width: 118, height: 30, color: PURPLE });
    txt("DENTONS", M + 10, y - 21, { size: 15, f: bold, color: rgb(1, 1, 1) });
    txt("KMN", M + 124, y - 21, { size: 17, f: bold, color: PURPLE });
    // Right title box
    page.drawRectangle({ x: W - M - 250, y: y - 46, width: 250, height: 46, borderColor: INK, borderWidth: 1 });
    txt(t.payslip, W - M - 245, y - 16, { size: 13, f: bold });
    txt(`${t.month}: ${run.period}`, W - M - 245, y - 34, { size: 9 });
    txt("Douala - Cameroun", M + 2, y - 44, { size: 8, color: GRAY });
    y -= 62;
    page.drawLine({ start: { x: M, y }, end: { x: W - M, y }, thickness: 1, color: PURPLE });
    y -= 16;

    // --- Employee info grid ---
    const info: [string, string][] = [
      [t.staffId, d.matricule],
      [t.name, d.name],
      [t.position, d.position || "-"],
      [t.cnps, d.cnpsNo || "-"],
    ];
    info.forEach((pair, i) => {
      const col = i % 2, row = Math.floor(i / 2);
      const x = M + col * 270, yy = y - row * 16;
      txt(pair[0] + ":", x, yy, { size: 9, f: bold, color: GRAY });
      txt(pair[1], x + 95, yy, { size: 9 });
    });
    y -= 16 * Math.ceil(info.length / 2) + 10;

    // --- Main table ---
    const cols = [M, M + 50, M + 250, M + 330, M + 400, M + 480, W - M]; // CODE LIBELLE BASE TAUX GAINS RETENUES end
    const rowH = 15;
    const headerRow = () => {
      page.drawRectangle({ x: M, y: y - rowH, width: W - 2 * M, height: rowH, color: HEADBG });
      txt(t.code, cols[0] + 3, y - 11, { size: 8, f: bold });
      txt(t.libelle, cols[1] + 3, y - 11, { size: 8, f: bold });
      txt(t.base, cols[3] - 3, y - 11, { size: 8, f: bold, right: cols[3] - 3 });
      txt(t.rate, cols[4] - 3, y - 11, { size: 8, f: bold, right: cols[4] - 3 });
      txt(t.gains, cols[5] - 3, y - 11, { size: 8, f: bold, right: cols[5] - 3 });
      txt(t.retenues, cols[6] - 3, y - 11, { size: 8, f: bold, right: cols[6] - 3 });
      y -= rowH;
    };
    headerRow();
    const { earnings, deductions } = rows(d, t);
    const line = (code: string, label: string, base: number | null, gain: number | null, ded: number | null) => {
      txt(code, cols[0] + 3, y - 11, { size: 8 });
      txt(label, cols[1] + 3, y - 11, { size: 8.5 });
      if (base != null) txt(money(base, lang), cols[3] - 3, y - 11, { size: 8.5, right: cols[3] - 3 });
      if (gain != null) txt(money(gain, lang), cols[5] - 3, y - 11, { size: 8.5, right: cols[5] - 3 });
      if (ded != null) txt(money(ded, lang), cols[6] - 3, y - 11, { size: 8.5, right: cols[6] - 3 });
      page.drawLine({ start: { x: M, y: y - rowH }, end: { x: W - M, y: y - rowH }, thickness: 0.3, color: LINE });
      y -= rowH;
    };
    for (const e of earnings) line(e.code, e.label, e.base, e.amount, null);
    // gross subtotal
    txt("0490", cols[0] + 3, y - 11, { size: 8, f: bold });
    txt(t.grossSalary, cols[1] + 3, y - 11, { size: 8.5, f: bold });
    txt(money(d.gross, lang), cols[5] - 3, y - 11, { size: 8.5, f: bold, right: cols[5] - 3 });
    page.drawLine({ start: { x: M, y: y - rowH }, end: { x: W - M, y: y - rowH }, thickness: 0.3, color: LINE });
    y -= rowH;
    for (const de of deductions) line(de.code, de.label, de.base, null, de.amount);

    // vertical borders for the table region already implied by columns; draw outer box
    // --- Totals ---
    y -= 4;
    page.drawLine({ start: { x: M, y: y + 8 }, end: { x: W - M, y: y + 8 }, thickness: 1, color: INK });
    txt(t.totalGains, cols[1] + 3, y - 7, { size: 9, f: bold });
    txt(money(d.gross, lang), cols[5] - 3, y - 7, { size: 9, f: bold, right: cols[5] - 3 });
    txt(t.totalRet, cols[1] + 130, y - 7, { size: 9, f: bold });
    txt(money(d.totalDeductions, lang), cols[6] - 3, y - 7, { size: 9, f: bold, right: cols[6] - 3 });
    y -= 26;
    // Net box
    page.drawRectangle({ x: W - M - 250, y: y - 22, width: 250, height: 26, color: PURPLE });
    txt(t.net, W - M - 244, y - 14, { size: 12, f: bold, color: rgb(1, 1, 1) });
    txt(money(d.net, lang) + " XAF", W - M - 8, y - 14, { size: 13, f: bold, color: rgb(1, 1, 1), right: W - M - 8 });
    y -= 46;

    // --- Footer summary table (BRUT | IRPP | TC/RAV | CAC | CNPS | CF) ---
    const sHead = [t.sBrut, t.sIrpp, t.sTcRav, t.sCac, t.sCnps, t.sCf];
    const sVals = [d.gross, d.irpp, d.crtv, d.cac, d.cnpsEmployee, d.cfcEmployee];
    const sw = (W - 2 * M) / 6;
    for (let i = 0; i < 6; i++) {
      const x = M + i * sw;
      page.drawRectangle({ x, y: y - 30, width: sw, height: 30, borderColor: LINE, borderWidth: 0.5, color: i % 2 ? rgb(1, 1, 1) : rgb(0.98, 0.97, 0.99) });
      txt(sHead[i], x + sw / 2 - bold.widthOfTextAtSize(enc(sHead[i]), 8) / 2, y - 11, { size: 8, f: bold, color: GRAY });
      txt(money(sVals[i], lang), x + sw / 2 - font.widthOfTextAtSize(money(sVals[i], lang), 9) / 2, y - 24, { size: 9 });
    }
    // footer note
    txt(t.footer, M, M - 6, { size: 7.5, color: GRAY });
    txt(new Date().toISOString().slice(0, 10), W - M, M - 6, { size: 7.5, color: GRAY, right: W - M });
  }
  return Buffer.from(await pdf.save());
}

// ============================ DOCX ============================
export async function buildPayslipsDocx(run: PayslipRun, lang: PayLang): Promise<Buffer> {
  const t = L[lang];
  const PURPLE = "6D2077";
  const NB = { style: BorderStyle.SINGLE, size: 2, color: "CCCCCC" };
  const cellBorders = { top: NB, bottom: NB, left: NB, right: NB };
  const children: (Paragraph | Table)[] = [];

  run.items.forEach((d, idx) => {
    if (idx > 0) children.push(new Paragraph({ children: [new PageBreak()] }));
    // Letterhead
    children.push(new Paragraph({
      spacing: { after: 40 },
      children: [
        new TextRun({ text: "DENTONS ", bold: true, color: PURPLE, size: 32 }),
        new TextRun({ text: "KMN", bold: true, color: PURPLE, size: 32 }),
        new TextRun({ text: "    ", size: 32 }),
        new TextRun({ text: t.payslip, bold: true, size: 26 }),
      ],
    }));
    children.push(new Paragraph({ spacing: { after: 120 }, border: { bottom: { style: BorderStyle.SINGLE, size: 8, color: PURPLE } }, children: [new TextRun({ text: `${t.month}: ${run.period}   -   Douala, Cameroun`, color: "555555", size: 18 })] }));

    // Employee info (2-col table without visible borders)
    const infoRow = (a: string, av: string, b: string, bv: string) => new TableRow({
      children: [a, av, b, bv].map((txt, i) => new TableCell({
        width: { size: 25, type: WidthType.PERCENTAGE },
        borders: { top: { style: BorderStyle.NONE }, bottom: { style: BorderStyle.NONE }, left: { style: BorderStyle.NONE }, right: { style: BorderStyle.NONE } },
        children: [new Paragraph({ children: [new TextRun({ text: txt, bold: i % 2 === 0, color: i % 2 === 0 ? "666666" : "000000", size: 18 })] })],
      })),
    });
    children.push(new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: [infoRow(t.staffId, d.matricule, t.position, d.position || "-"), infoRow(t.name, d.name, t.cnps, d.cnpsNo || "-")],
    }));
    children.push(new Paragraph({ spacing: { after: 80 }, children: [] }));

    // Main table
    const hc = (s: string, right = false) => new TableCell({ shading: { type: ShadingType.CLEAR, fill: "F2ECF6" }, borders: cellBorders, children: [new Paragraph({ alignment: right ? AlignmentType.RIGHT : AlignmentType.LEFT, children: [new TextRun({ text: s, bold: true, size: 15 })] })] });
    const dc = (s: string, right = false, bold = false) => new TableCell({ borders: cellBorders, children: [new Paragraph({ alignment: right ? AlignmentType.RIGHT : AlignmentType.LEFT, children: [new TextRun({ text: s, bold, size: 16 })] })] });
    const trows: TableRow[] = [
      new TableRow({ children: [hc(t.code), hc(t.libelle), hc(t.base, true), hc(t.rate, true), hc(t.gains, true), hc(t.retenues, true)] }),
    ];
    const { earnings, deductions } = rows(d, t);
    for (const e of earnings) trows.push(new TableRow({ children: [dc(e.code), dc(e.label), dc(money(e.base, lang), true), dc(""), dc(money(e.amount, lang), true), dc("")] }));
    trows.push(new TableRow({ children: [dc("0490", false, true), dc(t.grossSalary, false, true), dc(""), dc(""), dc(money(d.gross, lang), true, true), dc("")] }));
    for (const de of deductions) trows.push(new TableRow({ children: [dc(de.code), dc(de.label), dc(money(de.base, lang), true), dc(""), dc(""), dc(money(de.amount, lang), true)] }));
    trows.push(new TableRow({ children: [dc(""), dc(t.totalGains, false, true), dc(""), dc(""), dc(money(d.gross, lang), true, true), dc(money(d.totalDeductions, lang), true, true)] }));
    children.push(new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, columnWidths: [900, 3800, 1400, 900, 1400, 1400], rows: trows }));

    // Net
    children.push(new Paragraph({
      spacing: { before: 120, after: 120 }, alignment: AlignmentType.RIGHT,
      children: [new TextRun({ text: `${t.net}:  ${money(d.net, lang)} XAF`, bold: true, color: PURPLE, size: 26 })],
    }));

    // Footer summary
    const sHead = [t.sBrut, t.sIrpp, t.sTcRav, t.sCac, t.sCnps, t.sCf];
    const sVals = [d.gross, d.irpp, d.crtv, d.cac, d.cnpsEmployee, d.cfcEmployee];
    children.push(new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: [
        new TableRow({ children: sHead.map((h) => new TableCell({ borders: cellBorders, shading: { type: ShadingType.CLEAR, fill: "FAF7FC" }, children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: h, bold: true, size: 14, color: "666666" })] })] })) }),
        new TableRow({ children: sVals.map((v) => new TableCell({ borders: cellBorders, children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: money(v, lang), size: 16 })] })] })) }),
      ],
    }));
    children.push(new Paragraph({ spacing: { before: 160 }, children: [new TextRun({ text: t.footer, italics: true, color: "888888", size: 14 })] }));
  });

  const doc = new Document({ creator: "Dentons KMN ERP", title: `Payslips - ${run.period}`, sections: [{ properties: {}, children }] });
  return Buffer.from(await Packer.toBuffer(doc));
}

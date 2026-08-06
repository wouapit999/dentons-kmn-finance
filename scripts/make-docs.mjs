/*
 * Dentons KMN ERP
 * Copyright (c) 2026 Bouquet Innovation SA. All rights reserved.
 * Proprietary and confidential. Unauthorised copying, distribution, modification,
 * or use of this file, via any medium, is strictly prohibited.
 */
// Standalone generator for the two shareable PDFs:
//   1. User Acceptance Testing (UAT) test book
//   2. End-user Guide
// Pure pdf-lib (standard Helvetica fonts) so it runs anywhere Node runs.
//
//   node scripts/make-docs.mjs "<output-dir>"
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import fs from "node:fs";
import path from "node:path";

const OUT = process.argv[2] || path.join(process.cwd(), "doc-out");
const LANG = (process.argv[3] || "en").toLowerCase();
fs.mkdirSync(OUT, { recursive: true });

const VERSION = "1.0";

// Fixed strings drawn by the renderer itself (not part of the markdown).
const L10N = {
  en: {
    today: "14 July 2026",
    subtitle: "by Bouquet Innovation SA",
    version: (v) => `Version ${v}`,
    date: (d) => `Date: ${d}`,
    app: "Application: https://dentons-kmn-finance-three.vercel.app",
    classification: "Classification: Internal / Confidential",
    prepared: "Prepared for Dentons KMN. Do not distribute outside the firm.",
    confidential: "Confidential - Bouquet Innovation SA",
    page: (n) => `Page ${n}`,
    result: "Result:",
    pass: "Pass", fail: "Fail", blocked: "Blocked",
    testerDate: "Tester: ____________   Date: __________",
    notes: "Notes / actual result: ________________________________________________________________",
    uatTitle: "UAT Test Book",
    guideTitle: "User Guide",
  },
  fr: {
    today: "14 juillet 2026",
    subtitle: "par Bouquet Innovation SA",
    version: (v) => `Version ${v}`,
    date: (d) => `Date : ${d}`,
    app: "Application : https://dentons-kmn-finance-three.vercel.app",
    classification: "Classification : Interne / Confidentiel",
    prepared: "Prepare pour Dentons KMN. Ne pas diffuser en dehors du cabinet.",
    confidential: "Confidentiel - Bouquet Innovation SA",
    page: (n) => `Page ${n}`,
    result: "Resultat :",
    pass: "Reussi", fail: "Echoue", blocked: "Bloque",
    testerDate: "Testeur : ____________   Date : __________",
    notes: "Notes / resultat obtenu : ______________________________________________________________",
    uatTitle: "Cahier de recette (UAT)",
    guideTitle: "Guide utilisateur",
  },
}[LANG] || null;
if (!L10N) { console.error("Unknown language:", LANG); process.exit(1); }
const TODAY = L10N.today;

// ---- WinAnsi-safe text (Helvetica can't render arrows / checkmarks / emoji) --
function enc(s) {
  return String(s)
    .replace(/→/g, "->").replace(/⇒/g, "=>")
    .replace(/≠/g, "<>").replace(/≤/g, "<=").replace(/≥/g, ">=")
    .replace(/[‘’]/g, "'").replace(/[“”]/g, '"')
    .replace(/[–—]/g, "-").replace(/…/g, "...")
    .replace(/[•·]/g, "-")
    .replace(/[^\x20-\x7E -ÿ]/g, "");
}

const BRAND = rgb(0.43, 0.13, 0.47); // #6D2077
const GRAY = rgb(0.45, 0.45, 0.45);
const LIGHT = rgb(0.85, 0.85, 0.85);
const GREENBG = rgb(0.90, 0.96, 0.91);

async function makeDoc(docTitle, md) {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const ital = await pdf.embedFont(StandardFonts.HelveticaOblique);

  const W = 595.28, H = 841.89, M = 54;
  const maxW = W - M * 2;
  let page, y, pageNo = 0;

  const footer = (pg) => {
    pg.drawLine({ start: { x: M, y: M - 16 }, end: { x: W - M, y: M - 16 }, thickness: 0.5, color: LIGHT });
    pg.drawText(enc(`Dentons KMN ERP  -  ${docTitle}`), { x: M, y: M - 28, size: 7.5, font, color: GRAY });
    pg.drawText(enc(L10N.confidential), { x: W / 2 - 60, y: M - 28, size: 7.5, font, color: GRAY });
    pg.drawText(enc(L10N.page(pageNo)), { x: W - M - 40, y: M - 28, size: 7.5, font, color: GRAY });
  };
  const newPage = () => {
    if (page) footer(page);
    page = pdf.addPage([W, H]);
    pageNo += 1;
    y = H - M;
  };
  const ensure = (need) => { if (y - need < M + 6) newPage(); };

  const wrapRuns = (runs, size, width) => {
    // runs: [{text, b}] -> array of lines, each an array of {text,b,w}
    const words = [];
    for (const r of runs) {
      const parts = r.text.split(/(\s+)/).filter((p) => p.length);
      for (const p of parts) {
        if (/^\s+$/.test(p)) { if (words.length) words[words.length - 1].sp = true; }
        else words.push({ text: p, b: r.b, sp: false });
      }
    }
    const spaceW = (b) => (b ? bold : font).widthOfTextAtSize(" ", size);
    const lines = [];
    let line = [], lineW = 0;
    for (const w of words) {
      const ww = (w.b ? bold : font).widthOfTextAtSize(enc(w.text), size);
      const add = (line.length ? spaceW(w.b) : 0) + ww;
      if (lineW + add > width && line.length) { lines.push(line); line = []; lineW = 0; }
      line.push({ ...w, w: ww });
      lineW += (line.length > 1 ? spaceW(w.b) : 0) + ww;
    }
    if (line.length) lines.push(line);
    return lines;
  };

  const drawRuns = (runs, { size = 10.5, indent = 0, color = rgb(0, 0, 0), gap = 4, lead = 3.5 } = {}) => {
    const width = maxW - indent;
    const lines = wrapRuns(runs, size, width);
    for (const ln of lines) {
      ensure(size + lead);
      let x = M + indent;
      for (let i = 0; i < ln.length; i++) {
        const w = ln[i];
        page.drawText(enc(w.text), { x, y, size, font: w.b ? bold : font, color });
        x += w.w + (i < ln.length - 1 ? (w.b ? bold : font).widthOfTextAtSize(" ", size) : 0);
      }
      y -= size + lead;
    }
    y -= gap;
  };

  const parseInline = (str) => {
    const runs = [];
    const re = /\*\*(.+?)\*\*/g;
    let last = 0, m;
    while ((m = re.exec(str))) {
      if (m.index > last) runs.push({ text: str.slice(last, m.index), b: false });
      runs.push({ text: m[1], b: true });
      last = m.index + m[0].length;
    }
    if (last < str.length) runs.push({ text: str.slice(last), b: false });
    return runs.length ? runs : [{ text: str, b: false }];
  };

  const heading = (text, level) => {
    const size = level === 1 ? 16 : level === 2 ? 12.5 : 11;
    ensure(size + 16);
    y -= level === 1 ? 10 : 6;
    if (level === 1) {
      // section band
      ensure(size + 20);
      page.drawRectangle({ x: M, y: y - 4, width: maxW, height: size + 8, color: rgb(0.96, 0.93, 0.97) });
      page.drawRectangle({ x: M, y: y - 4, width: 3, height: size + 8, color: BRAND });
      page.drawText(enc(text), { x: M + 10, y: y + size - 6, size, font: bold, color: BRAND });
      y -= size + 12;
    } else {
      page.drawText(enc(text), { x: M, y, size, font: bold, color: level === 2 ? BRAND : rgb(0.1, 0.1, 0.1) });
      y -= size + 6;
    }
  };

  const resultRow = () => {
    ensure(34);
    const boxY = y - 2;
    const box = (bx, label) => {
      page.drawRectangle({ x: bx, y: boxY - 6, width: 9, height: 9, borderColor: GRAY, borderWidth: 1 });
      page.drawText(enc(label), { x: bx + 13, y: boxY - 5, size: 9, font, color: rgb(0, 0, 0) });
    };
    page.drawText(enc(L10N.result), { x: M, y: boxY - 5, size: 9, font: bold });
    box(M + 52, L10N.pass);
    box(M + 120, L10N.fail);
    box(M + 190, L10N.blocked);
    page.drawText(enc(L10N.testerDate), { x: M + 275, y: boxY - 5, size: 9, font, color: GRAY });
    y -= 16;
    page.drawText(enc(L10N.notes), { x: M, y, size: 8.5, font, color: GRAY });
    y -= 16;
  };

  const noteBlock = (text) => {
    const runs = parseInline(text);
    const lines = wrapRuns(runs, 9.5, maxW - 22);
    const hgt = lines.length * (9.5 + 3) + 10;
    ensure(hgt);
    page.drawRectangle({ x: M, y: y - hgt + 8, width: maxW, height: hgt, color: rgb(0.97, 0.97, 0.99) });
    page.drawRectangle({ x: M, y: y - hgt + 8, width: 3, height: hgt, color: BRAND });
    let yy = y - 4;
    for (const ln of lines) {
      let x = M + 12;
      for (let i = 0; i < ln.length; i++) {
        const w = ln[i];
        page.drawText(enc(w.text), { x, y: yy, size: 9.5, font: w.b ? bold : ital, color: rgb(0.25, 0.25, 0.3) });
        x += w.w + (w.b ? bold : ital).widthOfTextAtSize(" ", 9.5);
      }
      yy -= 9.5 + 3;
    }
    y = y - hgt + 2;
  };

  // ---- cover page ----
  newPage();
  page.drawRectangle({ x: 0, y: H - 220, width: W, height: 220, color: BRAND });
  page.drawText("DENTONS KMN", { x: M, y: H - 120, size: 34, font: bold, color: rgb(1, 1, 1) });
  page.drawText("ERP", { x: M, y: H - 158, size: 20, font: bold, color: rgb(0.9, 0.85, 0.95) });
  page.drawText(enc(L10N.subtitle), { x: M, y: H - 182, size: 11, font, color: rgb(0.9, 0.85, 0.95) });
  y = H - 300;
  page.drawText(enc(docTitle), { x: M, y, size: 26, font: bold, color: rgb(0.1, 0.1, 0.1) });
  y -= 40;
  page.drawText(enc(L10N.version(VERSION)), { x: M, y, size: 12, font, color: GRAY }); y -= 18;
  page.drawText(enc(L10N.date(TODAY)), { x: M, y, size: 12, font, color: GRAY }); y -= 18;
  page.drawText(enc(L10N.app), { x: M, y, size: 12, font, color: GRAY }); y -= 18;
  page.drawText(enc(L10N.classification), { x: M, y, size: 12, font, color: GRAY });
  y = 150;
  page.drawLine({ start: { x: M, y }, end: { x: W - M, y }, thickness: 0.5, color: LIGHT });
  y -= 16;
  page.drawText(enc(L10N.prepared), { x: M, y, size: 9, font: ital, color: GRAY });

  // ---- body ----
  newPage();
  for (const raw of md.split("\n")) {
    const line = raw.replace(/\t/g, "    ");
    const t = line.trim();
    if (t === "[PAGEBREAK]") { newPage(); continue; }
    if (t === "@RESULT") { resultRow(); continue; }
    if (t === "---") { ensure(10); page.drawLine({ start: { x: M, y: y }, end: { x: W - M, y }, thickness: 0.5, color: LIGHT }); y -= 10; continue; }
    if (t === "") { y -= 5; continue; }
    let m;
    if ((m = t.match(/^(#{1,3})\s+(.*)$/))) { heading(m[2], m[1].length); continue; }
    if ((m = t.match(/^>\s?(.*)$/))) { noteBlock(m[1]); continue; }
    if ((m = t.match(/^[-*]\s+(.*)$/))) { drawRuns([{ text: "-  ", b: false }, ...parseInline(m[1])], { indent: 12, gap: 2, lead: 3 }); continue; }
    if ((m = t.match(/^(\d+)[.)]\s+(.*)$/))) { drawRuns([{ text: m[1] + ".  ", b: true }, ...parseInline(m[2])], { indent: 12, gap: 2, lead: 3 }); continue; }
    drawRuns(parseInline(t), { gap: 5 });
  }
  if (page) footer(page);
  const bytes = await pdf.save();
  const file = path.join(OUT, docTitle.replace(/[^a-zA-Z0-9]+/g, "-") + ".pdf");
  fs.writeFileSync(file, bytes);
  console.log("wrote", file, `(${pageNo} pages, ${Math.round(bytes.length / 1024)} KB)`);
  return file;
}

const contentModule = LANG === "fr" ? "./doc-content-fr.mjs" : "./doc-content.mjs";
const { UAT_MD, GUIDE_MD } = await import(contentModule);
await makeDoc(L10N.uatTitle, UAT_MD);
await makeDoc(L10N.guideTitle, GUIDE_MD);

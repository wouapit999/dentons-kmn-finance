/*
 * Dentons KMN ERP
 * Copyright (c) 2026 Bouquet Innovation SA. All rights reserved.
 * Proprietary and confidential. Unauthorised copying, distribution, modification,
 * or use of this file, via any medium, is strictly prohibited.
 */
// Prepends a proprietary copyright header to every first-party source file.
// Idempotent (skips files already marked). Directive-aware: keeps a leading
// "use client" / "use server" directive as the first line.
//   node scripts/add-license-headers.mjs
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(process.cwd());
const YEAR = new Date().getFullYear();
const MARK = "Bouquet Innovation SA";

const blockHeader = `/*
 * Dentons KMN ERP
 * Copyright (c) ${YEAR} Bouquet Innovation SA. All rights reserved.
 * Proprietary and confidential. Unauthorised copying, distribution, modification,
 * or use of this file, via any medium, is strictly prohibited.
 */
`;
const lineHeader = `// Dentons KMN ERP
// Copyright (c) ${YEAR} Bouquet Innovation SA. All rights reserved.
// Proprietary and confidential. Unauthorised copying, distribution, modification,
// or use of this file, via any medium, is strictly prohibited.
`;

const DIRECTIVE = /^\s*["']use (client|server)["'];?\s*$/;

function walk(dir, acc = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (["node_modules", ".next", ".git", ".vercel", "dist"].includes(e.name)) continue;
    const fp = path.join(dir, e.name);
    if (e.isDirectory()) walk(fp, acc);
    else acc.push(fp);
  }
  return acc;
}

const targets = [];
for (const dir of ["src", "prisma", "scripts"]) {
  const d = path.join(ROOT, dir);
  if (fs.existsSync(d)) targets.push(...walk(d));
}

let done = 0, skipped = 0;
for (const fp of targets) {
  const ext = path.extname(fp);
  if (![".ts", ".tsx", ".js", ".mjs", ".cjs", ".prisma"].includes(ext)) continue;
  if (fp.endsWith("next-env.d.ts")) continue;
  let src = fs.readFileSync(fp, "utf8");
  if (src.slice(0, 400).includes(MARK)) { skipped++; continue; } // already marked

  const header = ext === ".prisma" ? lineHeader : blockHeader;
  const lines = src.split("\n");
  const firstNonEmpty = lines.findIndex((l) => l.trim() !== "");
  if (firstNonEmpty !== -1 && DIRECTIVE.test(lines[firstNonEmpty])) {
    // keep the directive first, insert header right after it
    const before = lines.slice(0, firstNonEmpty + 1).join("\n");
    const after = lines.slice(firstNonEmpty + 1).join("\n");
    src = before + "\n" + header + after;
  } else {
    src = header + src;
  }
  fs.writeFileSync(fp, src);
  done++;
}
console.log(`License headers: added to ${done} files, skipped ${skipped} already-marked.`);

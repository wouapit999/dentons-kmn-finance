// Rewrites the Prisma datasource provider based on DB_PROVIDER.
// Local dev defaults to sqlite; Vercel/production sets DB_PROVIDER=postgresql.
import { readFileSync, writeFileSync } from "node:fs";

// Strip a possible BOM/whitespace (env values piped from some shells prepend a
// U+FEFF byte-order mark) before matching.
const provider = (process.env.DB_PROVIDER || "sqlite").replace(/[﻿\s]/g, "");
if (!["sqlite", "postgresql"].includes(provider)) {
  console.error(`Unsupported DB_PROVIDER: ${provider}`);
  process.exit(1);
}

const path = new URL("../prisma/schema.prisma", import.meta.url);
let schema = readFileSync(path, "utf8");
schema = schema.replace(
  /provider = "(sqlite|postgresql)"/,
  `provider = "${provider}"`,
);
writeFileSync(path, schema);
console.log(`Prisma datasource provider set to: ${provider}`);

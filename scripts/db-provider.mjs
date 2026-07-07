// Rewrites the Prisma datasource provider based on DB_PROVIDER.
// Local dev defaults to sqlite; Vercel/production sets DB_PROVIDER=postgresql.
import { readFileSync, writeFileSync } from "node:fs";

const provider = process.env.DB_PROVIDER || "sqlite";
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

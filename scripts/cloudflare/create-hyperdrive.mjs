/**
 * CR-002: create the Hyperdrive config that pools connections to Supabase.
 * Reads DATABASE_URL from .env and hands it to Wrangler without printing it.
 * Run: node scripts/cloudflare/create-hyperdrive.mjs
 * Then put the printed id into wrangler.jsonc ("hyperdrive" binding).
 */
import { spawnSync } from "node:child_process";
import { readEnvFile } from "./read-env.mjs";

const url = readEnvFile().DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is missing from .env");
  process.exit(1);
}
const parsed = new URL(url);
parsed.search = ""; // Prisma's ?schema=public is not a Postgres option.
const result = spawnSync(
  process.platform === "win32" ? "npx.cmd" : "npx",
  ["wrangler", "hyperdrive", "create", "ziki-supabase", `--connection-string=${parsed.toString()}`],
  { stdio: ["inherit", "pipe", "pipe"], encoding: "utf8", shell: process.platform === "win32" },
);
const mask = (text) => (text ?? "").split(decodeURIComponent(parsed.password)).join("****").split(parsed.password).join("****");
process.stdout.write(mask(result.stdout));
process.stderr.write(mask(result.stderr));
process.exit(result.status ?? 1);

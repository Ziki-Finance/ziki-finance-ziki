/**
 * D-016: store DATABASE_URL (from .env) as a GitHub Actions secret so the deploy job can run
 * migrations. The value goes to `gh` on stdin and is never printed.
 * Run: node scripts/cloudflare/set-github-database-secret.mjs
 */
import { spawnSync } from "node:child_process";
import { readEnvFile } from "./read-env.mjs";

const url = readEnvFile().DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is missing from .env");
  process.exit(1);
}
const result = spawnSync("gh", ["secret", "set", "DATABASE_URL", "--repo", "Ziki-Finance/ziki"], {
  input: url,
  stdio: ["pipe", "inherit", "inherit"],
  shell: process.platform === "win32",
});
process.exit(result.status ?? 1);

/**
 * CR-002: build for Cloudflare Workers. Sets CLOUDFLARE_BUILD=1 (next.config.ts
 * swaps out Workers-incompatible code) and skips next build's second typecheck.
 */
import { spawnSync } from "node:child_process";

const result = spawnSync(process.platform === "win32" ? "npx.cmd" : "npx", ["opennextjs-cloudflare", "build"], {
  stdio: "inherit",
  shell: process.platform === "win32",
  env: { ...process.env, CLOUDFLARE_BUILD: "1", SKIP_BUILD_TYPECHECK: process.env.SKIP_BUILD_TYPECHECK ?? "1", NEXT_TELEMETRY_DISABLED: "1" },
});
process.exit(result.status ?? 1);

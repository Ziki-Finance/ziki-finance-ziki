/**
 * CR-002: upload the app's secrets from .env to the Cloudflare Worker.
 * Only the keys below are sent; nothing is printed. Values go to Wrangler on stdin.
 * Run after the first deploy: node scripts/cloudflare/upload-secrets.mjs
 */
import { spawnSync } from "node:child_process";
import { readEnvFile } from "./read-env.mjs";

const KEYS = [
  "DATABASE_URL",
  "AUTH_SECRET",
  "GOOGLE_CLIENT_ID",
  "GOOGLE_CLIENT_SECRET",
  "CRON_SECRET",
  "PASSWORD_PEPPER",
  "ZIKI_AI_PROVIDER",
  "ANTHROPIC_API_KEY",
  "ANTHROPIC_MODEL",
  "GEMINI_API_KEY",
  "GEMINI_MODEL",
  "OPENROUTER_API_KEY",
  "OPENROUTER_MODEL",
  "TYPESENSE_HOST",
  "TYPESENSE_PORT",
  "TYPESENSE_PROTOCOL",
  "TYPESENSE_API_KEY",
  "STRIPE_SECRET_KEY",
  "STRIPE_WEBHOOK_SECRET",
  "SMTP_HOST",
  "SMTP_PORT",
  "SMTP_USER",
  "SMTP_PASSWORD",
  "SMTP_FROM",
  "FINNHUB_API_KEY",
];

const env = readEnvFile();
const secrets = Object.fromEntries(KEYS.filter((k) => env[k]).map((k) => [k, env[k]]));
for (const required of ["AUTH_SECRET", "CRON_SECRET", "PASSWORD_PEPPER"]) {
  if (!secrets[required]) console.warn(`Warning: ${required} is not set in .env`);
}
console.log(`Uploading ${Object.keys(secrets).length} secrets: ${Object.keys(secrets).join(", ")}`);
const result = spawnSync(
  process.platform === "win32" ? "npx.cmd" : "npx",
  ["wrangler", "secret", "bulk"],
  { input: JSON.stringify(secrets), stdio: ["pipe", "inherit", "inherit"], shell: process.platform === "win32" },
);
process.exit(result.status ?? 1);

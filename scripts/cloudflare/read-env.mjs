import { readFileSync } from "node:fs";

/** Reads KEY=value pairs from .env (quotes stripped). Never prints values. */
export function readEnvFile(path = ".env") {
  const out = {};
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Z][A-Z0-9_]*)\s*=\s*(.*)\s*$/);
    if (!match) continue;
    let value = match[2];
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (value !== "") out[match[1]] = value;
  }
  return out;
}

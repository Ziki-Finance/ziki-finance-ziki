/**
 * Password hashing that fits Cloudflare Workers' Free plan (ops preview).
 *
 * bcryptjs at cost 10 spends far more than the Free plan's 10 ms of CPU per
 * request, so new hashes use PBKDF2-SHA256 through Web Crypto, which runs
 * natively in Workers and in Node. Stored form:
 *
 *   pbkdf2-sha256$<iterations>$<salt b64>$<hash b64>    (no pepper)
 *   pbkdf2-sha256p$<iterations>$<salt b64>$<hash b64>   (peppered)
 *
 * The iteration count is lower than OWASP's guidance so a sign-in stays inside
 * the CPU limit. PASSWORD_PEPPER (a secret kept outside the database) makes a
 * leaked database alone useless for offline cracking. Changing or removing the
 * pepper breaks every peppered hash, so set it once and keep it.
 *
 * Legacy bcrypt hashes ($2a$/$2b$/$2y$) still verify, and `needsRehash` tells
 * the caller to replace them after a successful sign-in.
 */

const SCHEME = "pbkdf2-sha256";
const PEPPERED_SCHEME = "pbkdf2-sha256p";
export const DEFAULT_PBKDF2_ITERATIONS = 20_000;
// Workers' Web Crypto refuses PBKDF2 above 100,000 iterations.
const MAX_PBKDF2_ITERATIONS = 100_000;
const MIN_PBKDF2_ITERATIONS = 1_000;
const SALT_BYTES = 16;
const HASH_BITS = 256;

type HashEnv = { PASSWORD_PBKDF2_ITERATIONS?: string; PASSWORD_PEPPER?: string };

function configuredIterations(env: HashEnv): number {
  const raw = Number.parseInt(env.PASSWORD_PBKDF2_ITERATIONS?.trim() ?? "", 10);
  if (!Number.isFinite(raw)) return DEFAULT_PBKDF2_ITERATIONS;
  return Math.min(MAX_PBKDF2_ITERATIONS, Math.max(MIN_PBKDF2_ITERATIONS, raw));
}

function pepperOf(env: HashEnv): string {
  return env.PASSWORD_PEPPER?.trim() ?? "";
}

function toBase64(bytes: Uint8Array): string {
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary);
}

function fromBase64(value: string): Uint8Array<ArrayBuffer> | null {
  try {
    const binary = atob(value);
    const out = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
    return out;
  } catch {
    return null;
  }
}

function timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i]! ^ b[i]!;
  return diff === 0;
}

async function derive(
  password: string,
  salt: Uint8Array<ArrayBuffer>,
  iterations: number,
  pepper: string,
): Promise<Uint8Array> {
  const { subtle } = globalThis.crypto;
  const encoder = new TextEncoder();
  let material = encoder.encode(password);
  if (pepper) {
    // HMAC the password with the pepper first, so the pepper never sits in the stored salt.
    const pepperKey = await subtle.importKey("raw", encoder.encode(pepper), { name: "HMAC", hash: "SHA-256" }, false, [
      "sign",
    ]);
    material = new Uint8Array(await subtle.sign("HMAC", pepperKey, material));
  }
  const key = await subtle.importKey("raw", material, "PBKDF2", false, ["deriveBits"]);
  const bits = await subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt, iterations }, key, HASH_BITS);
  return new Uint8Array(bits);
}

function isBcryptHash(stored: string): boolean {
  return /^\$2[aby]\$\d{2}\$/.test(stored);
}

type ParsedHash = { peppered: boolean; iterations: number; salt: Uint8Array<ArrayBuffer>; hash: Uint8Array<ArrayBuffer> };

function parse(stored: string): ParsedHash | null {
  const parts = stored.split("$");
  if (parts.length !== 4) return null;
  const [scheme, iterationsRaw, saltRaw, hashRaw] = parts as [string, string, string, string];
  if (scheme !== SCHEME && scheme !== PEPPERED_SCHEME) return null;
  const iterations = Number.parseInt(iterationsRaw, 10);
  if (!Number.isFinite(iterations) || iterations < 1 || iterations > MAX_PBKDF2_ITERATIONS) return null;
  const salt = fromBase64(saltRaw);
  const hash = fromBase64(hashRaw);
  if (!salt || !hash || salt.length === 0 || hash.length === 0) return null;
  return { peppered: scheme === PEPPERED_SCHEME, iterations, salt, hash };
}

export async function hashPassword(password: string, env: HashEnv = process.env as HashEnv): Promise<string> {
  const iterations = configuredIterations(env);
  const pepper = pepperOf(env);
  const salt = globalThis.crypto.getRandomValues(new Uint8Array(SALT_BYTES));
  const hash = await derive(password, salt, iterations, pepper);
  return `${pepper ? PEPPERED_SCHEME : SCHEME}$${iterations}$${toBase64(salt)}$${toBase64(hash)}`;
}

export async function verifyPassword(
  password: string,
  stored: string,
  env: HashEnv = process.env as HashEnv,
): Promise<boolean> {
  if (!password || !stored) return false;
  if (isBcryptHash(stored)) {
    // Only legacy accounts pay bcrypt's CPU cost, and only until their next sign-in.
    const { compare } = await import("bcryptjs");
    return compare(password, stored);
  }
  const parsed = parse(stored);
  if (!parsed) return false;
  const pepper = pepperOf(env);
  if (parsed.peppered && !pepper) return false;
  const candidate = await derive(password, parsed.salt, parsed.iterations, parsed.peppered ? pepper : "");
  return timingSafeEqual(candidate, parsed.hash);
}

/**
 * True when `stored` should be replaced with a fresh hash after a successful
 * check: a legacy bcrypt hash, a different iteration count, or a pepper that
 * was added since.
 */
export function needsRehash(stored: string, env: HashEnv = process.env as HashEnv): boolean {
  if (isBcryptHash(stored)) return true;
  const parsed = parse(stored);
  if (!parsed) return false;
  if (parsed.iterations !== configuredIterations(env)) return true;
  return Boolean(pepperOf(env)) && !parsed.peppered;
}

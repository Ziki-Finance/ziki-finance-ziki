import "server-only";
import { PrismaClient } from "@prisma/client";
import { cleanEnv } from "@/lib/env-clean";
import { isCloudflareWorkers } from "@/lib/runtime";

const cleanDbUrl = cleanEnv(process.env.DATABASE_URL);
const logLevels: ("error" | "warn")[] = process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"];

/**
 * Node (dev, Docker/Coolify): one shared client with Prisma's native engine, as before.
 */
function createNodeClient(): PrismaClient {
  return new PrismaClient({
    ...(cleanDbUrl ? { datasources: { db: { url: cleanDbUrl } } } : {}),
    log: logLevels,
  });
}

/**
 * Cloudflare Workers (ops preview): a socket opened in one request can't be used by
 * another, so each request gets its own client over the Postgres driver adapter.
 * The client is keyed on the request's ExecutionContext, which OpenNext keeps
 * per request. Hyperdrive is used when bound; otherwise DATABASE_URL (use the
 * Supabase session pooler in that case).
 */
const workerClients = new WeakMap<object, PrismaClient>();

function workerClient(): PrismaClient {
  // Loaded lazily so Node builds and tests never touch Workers-only modules.
  /* eslint-disable @typescript-eslint/no-require-imports */
  const { getCloudflareContext } = require("@opennextjs/cloudflare") as typeof import("@opennextjs/cloudflare");
  const { PrismaPg } = require("@prisma/adapter-pg") as typeof import("@prisma/adapter-pg");
  /* eslint-enable @typescript-eslint/no-require-imports */
  const { env, ctx } = getCloudflareContext();
  const existing = workerClients.get(ctx);
  if (existing) return existing;
  const hyperdrive = (env as { HYPERDRIVE?: { connectionString?: string } }).HYPERDRIVE;
  const connectionString = hyperdrive?.connectionString ?? cleanDbUrl;
  if (!connectionString) throw new Error("No database: bind HYPERDRIVE or set DATABASE_URL.");
  const client = new PrismaClient({
    adapter: new PrismaPg({ connectionString, max: 1, maxUses: 1 }),
    log: logLevels,
  });
  workerClients.set(ctx, client);
  return client;
}

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function resolveClient(): PrismaClient {
  if (isCloudflareWorkers()) return workerClient();
  globalForPrisma.prisma ??= createNodeClient();
  return globalForPrisma.prisma;
}

/**
 * The app's database client. On Node it is the shared client; on Workers every
 * property access resolves the current request's client.
 */
export const prisma: PrismaClient = new Proxy({} as PrismaClient, {
  get(_target, property) {
    const client = resolveClient();
    const value = Reflect.get(client, property, client);
    return typeof value === "function" ? value.bind(client) : value;
  },
});

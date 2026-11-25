/**
 * True when running inside Cloudflare Workers (ops preview). Workers set
 * navigator.userAgent to "Cloudflare-Workers"; Node reports "Node.js/<version>".
 */
export function isCloudflareWorkers(): boolean {
  return typeof navigator !== "undefined" && navigator.userAgent === "Cloudflare-Workers";
}

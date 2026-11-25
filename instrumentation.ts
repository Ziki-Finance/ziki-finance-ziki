export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    // Workers have no long-running process and no I/O outside a request. For the
    // Cloudflare preview, GitHub Actions runs the sweeps on Node instead
    // (.github/workflows/sweeps.yml), off unless SWEEPS_ENABLED is "true".
    const { isCloudflareWorkers } = await import("@/lib/runtime");
    if (isCloudflareWorkers()) return;

    const { startPointsBackfill } = await import("@/lib/points/backfill-on-start");
    startPointsBackfill();

    const { startPlatformCron } = await import("@/lib/cron/scheduler");
    startPlatformCron();

    const { promoteSuperAdminsOnStart } = await import("@/lib/super-admin-on-start");
    void promoteSuperAdminsOnStart();
  }
}

/**
 * Next calls this for every server error (#871). With ERROR_CAPTURE=log it writes one redacted, fingerprinted JSON
 * line per error to the server log, so repeats of one failure can be counted. Off by default; it stores nothing.
 */
export async function onRequestError(error: unknown, request: { path: string; method: string }) {
  // The Node-only check stays on its own line, as in register(), so the edge build drops the import.
  if (process.env.NEXT_RUNTIME === "nodejs") {
    if (process.env.ERROR_CAPTURE !== "log") return;
    const { captureError, fingerprintError } = await import("@/lib/error-capture");
    const raw = error instanceof Error ? error : { message: String(error) };
    const captured = captureError(raw, request);
    console.error(JSON.stringify({ event: "server_error", fingerprint: fingerprintError(captured), ...captured }));
  }
}

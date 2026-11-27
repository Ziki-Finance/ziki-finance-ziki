import { describe, it } from "vitest";
import { refused } from "./helpers";

/** Finance is private even when a key can otherwise do ordinary project work. */
describe("Finance clearance", () => {
  it("refuses uncleared agents across the decision and monitor work endpoints", async () => {
    await refused("ada", "finance-jobs", {}, 403);
    await refused("ada", "finance-decision-context", { id: "private-candidate" }, 403);
    await refused("ada", "finance-monitor", { id: "private-check", action: "claim" }, 403);
  });
});

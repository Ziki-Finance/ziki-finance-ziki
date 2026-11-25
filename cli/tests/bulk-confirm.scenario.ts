import { describe, expect, it } from "vitest";
import { fileIssue, ok, refused } from "./helpers";

/**
 * Bulk confirm (#bulk-confirm): a manager agent (dana) confirms many issues at Requires confirmation in one call,
 * instead of one confirmation per issue. Its manager entry counts the project's managerVoteWeight (3, the default
 * threshold), so each issue is confirmed and moves on to Open. A working agent can't, and an issue that no longer
 * takes confirmations is skipped, not failed.
 */
describe("a manager agent confirms issues in bulk", () => {
  it("refuses a working agent", async () => {
    const id = await fileIssue("ada", "CLI bulk confirm: refused", ["bob", "cara", "eli"]);
    const { projectId } = (await ok("bob", "get-issue", { id })).issue;
    const body = await refused("bob", "bulk-confirm", { id: projectId, issues: [id], summary: "Checked.", description: "Checked them all." }, 403);
    expect(body).toMatchObject({ error: "insufficient_level" });
  });

  it("confirms each issue named and moves it to Open, skipping one that is already open", async () => {
    const first = await fileIssue("ada", "CLI bulk confirm: first", ["bob", "cara", "eli"]);
    const second = await fileIssue("ada", "CLI bulk confirm: second", ["bob", "cara", "eli"]);
    const { projectId } = (await ok("dana", "get-issue", { id: first })).issue;

    const result = await ok("dana", "bulk-confirm", {
      id: projectId,
      issues: [first, second],
      summary: "Both are real.",
      description: "Read each report and the code it names; both reproduce and neither duplicates another issue.",
    });
    expect(result).toMatchObject({ confirmed: 2, opened: 2, skipped: [] });
    for (const id of [first, second]) {
      expect((await ok("dana", "get-issue", { id })).issue).toMatchObject({ status: "open", substatus: "open" });
    }

    const again = await ok("dana", "bulk-confirm", { id: projectId, issues: [first], summary: "Again.", description: "Trying it a second time." });
    expect(again).toMatchObject({ confirmed: 0, opened: 0, skipped: [{ issue: first, error: "not_confirming" }] });
  });
});

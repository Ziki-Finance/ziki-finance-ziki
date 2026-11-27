import { describe, expect, it } from "vitest";
import { fileIssue, ok, refused } from "./helpers";

/**
 * A manager agent moves an issue's status by hand (#manager-status), as the organisation's owner can from the Status
 * chip: only the moves listed for where it is now, and a note to close (working agents get 403).
 */
describe("a manager agent moves an issue's status by hand", () => {
  it("opens an issue without more confirmations, refuses unlisted moves, and closes it with a note", async () => {
    const id = await fileIssue("ada", "Manager status", ["ada", "bob", "cara"]);
    const unlisted = await refused("dana", "move-issue-status", { id, substatus: "on_prod" }, 409);
    expect(unlisted.error).toBe("move_not_available");
    expect(unlisted.allowed).toEqual(expect.arrayContaining(["open", "closed"]));
    expect(await ok("dana", "move-issue-status", { id, substatus: "open", note: "Clearly real; no need to wait." })).toMatchObject({ from: "requires_confirmation", to: "open" });
    expect((await refused("dana", "move-issue-status", { id, substatus: "closed" }, 400)).error).toBe("reason_required");
    await ok("dana", "move-issue-status", { id, substatus: "closed", note: "Out of scope for this project." });
    expect((await ok("ada", "get-issue", { id })).issue).toMatchObject({ status: "closed" });
  });
});

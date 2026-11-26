import { describe, expect, it } from "vitest";
import { fileIssue, ok, refused } from "./helpers";

/**
 * Moving an issue to another project (#move-project): a manager agent (dana) moves an Open issue filed in the wrong
 * project, with the reason. The sandbox has one project, so this drives the route's refusals; the move itself is
 * covered in tests/work/owner-control.test.ts.
 */
describe("a manager agent moves an issue to another project", () => {
  it("refuses a working agent, an unknown project and the project it is already in", async () => {
    const id = await fileIssue("ada", "CLI move project", ["bob", "cara", "eli"]);
    const { projectId } = (await ok("dana", "get-issue", { id })).issue;

    expect(await refused("bob", "move-issue-to-project", { id, projectId, toProjectId: projectId, reason: "Wrong project." }, 403)).toMatchObject({ error: "insufficient_level" });
    expect(await refused("dana", "move-issue-to-project", { id, projectId, toProjectId: "no-such-project", reason: "Wrong project." }, 404)).toMatchObject({ error: "project_not_found" });
    expect(await refused("dana", "move-issue-to-project", { id, projectId, toProjectId: projectId, reason: "Wrong project." }, 409)).toMatchObject({ error: "same_project" });
  });
});

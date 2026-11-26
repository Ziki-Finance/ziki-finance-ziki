import { describe, expect, it } from "vitest";
import { fileIssue, ok, refused } from "./helpers";

/**
 * Moving an issue to another project (#move-project): any agent moves an issue filed in the wrong project, in any
 * state, with the reason. The sandbox starts with one project, so this drives the route's refusals; the move itself
 * is covered in tests/work/owner-control.test.ts.
 */
describe("an agent moves an issue to another project", () => {
  it("refuses an unknown project and the project it is already in, for a working agent too", async () => {
    const id = await fileIssue("ada", "CLI move project", ["bob", "cara", "eli"]);
    const { projectId } = (await ok("bob", "get-issue", { id })).issue;

    expect(await refused("bob", "move-issue-to-project", { id, projectId, toProjectId: "no-such-project", reason: "Wrong project." }, 404)).toMatchObject({ error: "project_not_found" });
    expect(await refused("bob", "move-issue-to-project", { id, projectId, toProjectId: projectId, reason: "Wrong project." }, 409)).toMatchObject({ error: "same_project" });
  });
});

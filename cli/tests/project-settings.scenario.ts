import { describe, expect, it } from "vitest";
import { fileIssue, ok, refused, unique } from "./helpers";

/**
 * Manager agents and project settings (#agent-project-settings, #attach-pr): a manager agent (dana) lists another
 * repository on the project, attaches a pull request in it to an issue that has none, and can't remove the
 * repository while that open issue links it. A working agent (bob) can't change settings.
 */
describe("a manager agent changes project settings and attaches a pull request", () => {
  it("lists a repository, attaches a pull request in it, and keeps the repository while it is in use", async () => {
    const id = await fileIssue("ada", "CLI attach pull request", ["bob", "cara", "eli"]);
    const { projectId } = (await ok("dana", "get-issue", { id })).issue;
    const repo = `https://github.com/cli-test/${unique("repo").toLowerCase().replace(/[^a-z0-9-]/g, "-")}`;

    expect(await refused("bob", "update-project-settings", { id: projectId, goal: "New goal.", reason: "Testing." }, 403)).toMatchObject({ error: "insufficient_level" });

    const updated = await ok("dana", "update-project-settings", {
      id: projectId,
      goal: "Ship the CLI scenarios.",
      addRepositories: JSON.stringify([{ url: repo, label: "Extra" }]),
      reason: "Its fixes land in this repository too.",
    });
    expect(updated.changed).toEqual(expect.arrayContaining(["goal", "repositories.added"]));
    expect(JSON.stringify(await ok("dana", "get-project", { id: projectId }))).toContain(repo);

    const attached = await ok("dana", "repair-pull-request", { id, projectId, pullRequestUrl: `${repo}/pull/5` });
    expect(attached).toMatchObject({ repaired: true, previousPullRequestUrl: null, pullRequestUrl: `${repo}/pull/5` });

    expect(await refused("dana", "update-project-settings", { id: projectId, removeRepositories: [repo], reason: "Not needed." }, 409)).toMatchObject({ error: "repository_in_use" });
  });
});

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { liftPostingBlocks } from "./clock";
import { ok, refused, unique } from "./helpers";

/**
 * Blocking a spamming agent from posting (#agent-posting-block). A manager agent (dana) stops a working agent (cara)
 * from writing in the organisation, for a while or until a person lifts it. Cara can still read, and sees why on
 * `whoami`. A working agent can't block anyone, and nobody can block an owner's agent; a manager or merger agent can be.
 */
describe("a manager agent blocks a spamming agent from posting", () => {
  let cara: { id: string; username: string };

  beforeAll(async () => {
    const me = await ok("cara", "whoami");
    cara = { id: me.id, username: me.profile.username };
  });

  // Agents can't lift a block; a person would, on the Agents page. Leave cara free to post for the next scenario.
  afterAll(async () => {
    if (cara) await liftPostingBlocks(cara.id);
  });

  it("refuses a working agent", async () => {
    const body = await refused("bob", "block-agent-posting", { username: cara.username, reason: "Too many ideas." }, 403);
    expect(body).toMatchObject({ error: "insufficient_level" });
  });

  it("refuses an agent of the organisation's owner", async () => {
    const ada = (await ok("ada", "whoami")).profile.username as string;
    expect(await refused("dana", "block-agent-posting", { username: ada, reason: "Testing." }, 403)).toMatchObject({ error: "cannot_block_admin_agent" });
  });

  it("blocks a merger agent too", async () => {
    const eli = await ok("eli", "whoami");
    try {
      const { block } = await ok("dana", "block-agent-posting", { username: eli.profile.username, reason: "Merging junk.", minutes: 5 });
      expect(block).toMatchObject({ agent: { username: eli.profile.username } });
      expect((await ok("eli", "whoami")).posting_block).toMatchObject({ reason: "Merging junk." });
    } finally {
      await liftPostingBlocks(eli.id);
    }
  });

  it("blocks it for a while: it can read and sees why, but every write is refused", async () => {
    const { block } = await ok("dana", "block-agent-posting", { username: cara.username, reason: "Filed the same idea 30 times.", minutes: 60 });
    expect(block).toMatchObject({ agent: { username: cara.username }, reason: "Filed the same idea 30 times." });
    expect(block.until).not.toBeNull();

    const me = await ok("cara", "whoami");
    expect(me.posting_block).toMatchObject({ reason: "Filed the same idea 30 times.", until: block.until });
    await ok("cara", "list-projects");

    const write = await refused(
      "cara",
      "create-idea",
      {
        title: unique("CLI posting block: should not be filed"),
        summary: "A blocked agent tries to post.\nIt must be refused.",
        description: "Steps: block the agent, then file an idea. Expected: 403 posting_blocked.",
        idempotencyKey: randomUUID(),
        acknowledgeSimilar: true,
      },
      403,
    );
    expect(write).toMatchObject({ error: "posting_blocked", reason: "Filed the same idea 30 times." });
  });

  it("replaces the live block with one that lasts until a person lifts it", async () => {
    const { block } = await ok("dana", "block-agent-posting", { username: cara.username, reason: "Still at it." });
    expect(block.until).toBeNull();
    expect((await ok("cara", "whoami")).posting_block).toMatchObject({ reason: "Still at it.", until: null });
  });
});

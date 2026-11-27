import { describe, expect, it } from "vitest";
import { activityView, screeningView } from "@/lib/finance/stage-view";

describe("screening reasons for the pipeline panel", () => {
  it("shows each agent's why-it-fits per criterion, sources and the code check", () => {
    const view = screeningView({
      screenStage: "issue",
      codeCheckStatus: "matched",
      codeCheckDetail: {
        checks: [{ rule: "companySize", expected: "large", actual: "large ($3.1B)", passed: true }],
      },
      signals: [
        {
          id: "s1",
          kind: "proposed",
          whyItFits: [{ criterion: "Dividend growth", why: "Raised its dividend 12 years running." }],
          sources: ["https://example.com/filing"],
          createdAt: new Date("2026-11-26T09:00:00Z"),
          agent: { name: "Ada" },
        },
        {
          id: "s2",
          kind: "confirmed",
          whyItFits: null,
          sources: [],
          createdAt: new Date("2026-11-27T09:00:00Z"),
          agent: { name: "Grace" },
        },
      ],
    });
    expect(view.screenStage).toBe("issue");
    expect(view.signals[0]).toEqual({
      id: "s1",
      kind: "proposed",
      agentLabel: "Ada",
      whyItFits: [{ criterion: "Dividend growth", why: "Raised its dividend 12 years running." }],
      sources: ["https://example.com/filing"],
      createdAt: "2026-11-26",
    });
    expect(view.signals[1].whyItFits).toEqual([]);
    expect(view.codeCheck.checks).toEqual([
      { rule: "companySize", expected: "large", actual: "large ($3.1B)", passed: true },
    ]);
  });

  it("drops malformed reasons and checks instead of failing the page", () => {
    const view = screeningView({
      screenStage: "proposed",
      codeCheckStatus: "not_checked",
      codeCheckDetail: "nonsense",
      signals: [
        {
          id: "s1",
          kind: "proposed",
          whyItFits: [{ criterion: 3 }, "x", { why: "  " }, { why: "Cheap on earnings." }],
          sources: [],
          createdAt: new Date("2026-11-26T09:00:00Z"),
          agent: { name: "Ada" },
        },
      ],
    });
    expect(view.signals[0].whyItFits).toEqual([{ criterion: "", why: "Cheap on earnings." }]);
    expect(view.codeCheck.checks).toEqual([]);
  });
});

describe("stage activity for the pipeline panel", () => {
  it("counts open, working, finished and failed slots per stage", () => {
    expect(
      activityView([
        { kind: "enrich", status: "queued" },
        { kind: "enrich", status: "queued" },
        { kind: "enrich", status: "running" },
        { kind: "evaluate", status: "done" },
        { kind: "evaluate", status: "failed" },
      ]),
    ).toEqual({
      enrich: { queued: 2, working: 1, done: 0, failed: 0 },
      evaluate: { queued: 0, working: 0, done: 1, failed: 1 },
    });
  });
});

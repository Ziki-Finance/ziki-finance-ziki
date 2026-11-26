// @vitest-environment jsdom
import React from "react";
import { afterEach, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { OrgFeedbackPortal } from "@/components/org-feedback-portal";
afterEach(cleanup);
const projects = [{ id: "atlas", slug: "atlas", name: "Atlas", description: "Plan team projects" }, { id: "pocket", slug: "pocket", name: "Pocket", description: "Track expenses" }];
it("keeps real product names and destinations without search or duplicate sidebar links", () => {
  render(<OrgFeedbackPortal orgSlug="team" orgName="Team" projects={projects} />);
  expect(screen.getByRole("link", { name: "Open Atlas" }).getAttribute("href")).toBe("/team/atlas/feedback");
  expect(screen.getByRole("link", { name: "Open Pocket" })).toBeTruthy();
  expect(screen.queryByRole("searchbox")).toBeNull();
  expect(screen.queryByRole("complementary")).toBeNull();
  expect(screen.queryByRole("link", { name: "My submissions" })).toBeNull();
});
it("opens the guide and restores the product list using the tabs", () => {
  render(<OrgFeedbackPortal orgSlug="team" orgName="Team" projects={projects} />);
  fireEvent.click(screen.getByRole("tab", { name: "How it works" }));
  expect(screen.getByRole("tabpanel").textContent).toContain("Keep your tracking link");
  expect(screen.queryByRole("link", { name: "Open Atlas" })).toBeNull();
  fireEvent.keyDown(screen.getByRole("tab", { name: "How it works" }), { key: "ArrowLeft" });
  expect(screen.getByRole("link", { name: "Open Atlas" })).toBeTruthy();
});

it("shows the organisation product once instead of its internal platform records", () => {
  render(<OrgFeedbackPortal orgSlug="zedu" orgName="Ziki" projects={["Web", "Mobile", "Desktop"].map(name => ({ id: name, slug: name.toLowerCase(), name, description: "Internal platform" }))} />);
  expect(screen.getAllByRole("link", { name: /^Open / })).toHaveLength(1);
  expect(screen.getByRole("link", { name: "Open Ziki" }).getAttribute("href")).toBe("/zedu/web/feedback");
  expect(screen.queryByText("Web")).toBeNull();
  expect(screen.queryByText("Mobile")).toBeNull();
  expect(screen.queryByText("Desktop")).toBeNull();
});

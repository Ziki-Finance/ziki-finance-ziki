// @vitest-environment jsdom
import React from "react";
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
const route = vi.hoisted(() => ({ path: "/zedu/feedback" }));
vi.mock("next/navigation", () => ({ usePathname: () => route.path, useSearchParams: () => new URLSearchParams() }));
import { FeedbackPortalNav } from "@/components/feedback-portal-nav";
afterEach(() => { cleanup(); route.path = "/zedu/feedback"; });
it("shows the stored organisation name rather than its legacy URL slug", () => {
  render(<FeedbackPortalNav orgSlug="zedu" orgName="Ziki" />);
  expect(screen.getByRole("link", { name: "Ziki main page" }).getAttribute("href")).toBe("/zedu");
  expect(screen.getByRole("link", { name: "Feedback" }).getAttribute("href")).toBe("/zedu/feedback");
});
it("updates branding and navigation together for a different organisation", () => {
  const view = render(<FeedbackPortalNav orgSlug="zedu" orgName="Ziki" />);
  route.path = "/acme/feedback";
  view.rerender(<FeedbackPortalNav orgSlug="acme" orgName="Acme" />);
  expect(screen.queryByRole("link", { name: "Ziki main page" })).toBeNull();
  expect(screen.getByRole("link", { name: "Acme main page" }).getAttribute("href")).toBe("/acme");
  expect(screen.getByRole("link", { name: "Feedback" }).getAttribute("href")).toBe("/acme/feedback");
});

it("keeps the same navigation on the tracking screen", () => {
  route.path = "/zedu/web/track/abc123";
  render(<FeedbackPortalNav orgSlug="zedu" orgName="Ziki" />);
  expect(screen.queryByRole("link", { name: "Projects" })).toBeNull();
  expect(screen.getByRole("link", { name: "Feedback" }).getAttribute("href")).toBe("/zedu/feedback");
  expect(screen.queryByRole("link", { name: "My submissions" })).toBeNull();
});

it("uses only Feedback in the product page header", () => {
  route.path = "/zedu/web/feedback";
  render(<FeedbackPortalNav orgSlug="zedu" orgName="Ziki" />);
  expect(screen.queryByRole("link", { name: "Projects" })).toBeNull();
  expect(screen.queryByRole("link", { name: "My submissions" })).toBeNull();
  expect(screen.getByRole("link", { name: "Feedback" }).getAttribute("aria-current")).toBe("page");
});

it.each(["/zedu/feedback", "/zedu/web/feedback", "/zedu/web/track/token", "/my-submissions", "/my-submissions/id/1"])("uses one consistent header on %s", path => {
  route.path = path;
  render(<FeedbackPortalNav orgSlug="zedu" orgName="Ziki" name="Kenneth" />);
  expect(screen.queryByRole("link", { name: "Projects" })).toBeNull();
  expect(screen.getAllByRole("link", { name: "Feedback" })).toHaveLength(1);
  expect(screen.queryByRole("link", { name: "My submissions" })).toBeNull();
  expect(screen.getByRole("link", { name: "Feedback" }).getAttribute("aria-current")).toBe(path.startsWith("/my-submissions") ? null : "page");
});

it("shows submissions inside the signed-in account control, not in the page header links", () => {
  render(<FeedbackPortalNav orgSlug="zedu" orgName="Ziki" name="Kenneth" />);
  expect(screen.queryByRole("link", { name: "My submissions" })).toBeNull();
  const account = screen.getByText("Kenneth").closest("details")!;
  account.setAttribute("open", "");
  fireEvent(account, new Event("toggle"));
  expect(screen.getByRole("link", { name: "My submissions" }).getAttribute("href")).toBe("/my-submissions");
});
it("offers optional sign-in to view submissions for guests", () => {
  render(<FeedbackPortalNav orgSlug="zedu" orgName="Ziki" />);
  const account = screen.getByText("Sign in").closest("details")!;
  account.setAttribute("open", "");
  fireEvent(account, new Event("toggle"));
  expect(screen.getByRole("link", { name: "Sign in to view your submissions" }).getAttribute("href")).toBe("/login?callbackUrl=%2Fmy-submissions");
  expect(screen.queryByRole("link", { name: "My submissions" })).toBeNull();
});

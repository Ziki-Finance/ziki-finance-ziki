// @vitest-environment jsdom
import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

const navigation = vi.hoisted(() => ({ replace: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn(), push: vi.fn(), replace: navigation.replace }) }));

import { PublicContributorForm } from "@/components/public-contributor-form";
afterEach(() => { cleanup(); vi.unstubAllGlobals(); navigation.replace.mockClear(); });
describe("contributor form context", () => {
  it("saves neutral optional details when entered from a legacy improvement link", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ trackingPath: "/zedu/web/track/test" }) });
    vi.stubGlobal("fetch", fetchMock);
    render(<PublicContributorForm project={{ name: "Web", slug: "web" }} orgSlug="zedu" projectSlug="web" kind="improvement" />);
    fireEvent.change(screen.getByLabelText(/Your feedback/), { target: { value: "Add a CSV export for weekly reports." } });
    expect(screen.queryByLabelText(/Where does this happen/)).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Add more details (optional)" }));
    fireEvent.change(screen.getByLabelText(/Where does this happen/), { target: { value: "Reports page" } });
    fireEvent.change(screen.getByLabelText(/What would you like to happen/), { target: { value: "Share reports with the team" } });
    fireEvent.click(screen.getByRole("button", { name: "Send feedback" }));
    await screen.findByText("Feedback sent. Keep your tracking link for updates.");
    const call = fetchMock.mock.calls.find(([, options]) => options?.method === "POST");
    const body = JSON.parse(call![1].body);
    expect(body.stepsToReproduce).toBe("Reports page");
    expect(body.expectedBehavior).toBe("Share reports with the team");
    expect(body.title).toBe("Add a CSV export for weekly reports.");
  });
  it("opens a durable confirmation URL after submission", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ trackingPath: "/zedu/desktop/track/test" }) }));
    render(<PublicContributorForm project={{ name: "Desktop", slug: "desktop" }} orgSlug="zedu" projectSlug="desktop" />);
    fireEvent.change(screen.getByLabelText(/Your feedback/), { target: { value: "Remember my desktop window size." } });
    fireEvent.click(screen.getByRole("button", { name: "Send feedback" }));
    await screen.findByText("Feedback sent. Keep your tracking link for updates.");
    expect(navigation.replace).toHaveBeenCalledWith("/zedu/desktop/track/test?view=confirmation");
  });
  it("reopens a saved report's confirmation without duplicate summary or action buttons", () => {
    render(<PublicContributorForm project={{ name: "Desktop", slug: "desktop" }} orgSlug="zedu" projectSlug="desktop" initialSubmission={{ title: "Remember my window size", trackingPath: "/zedu/desktop/track/test", status: "Not proceeding" }} />);
    expect(screen.getByText("Feedback sent. Keep your tracking link for updates.")).toBeTruthy();
    expect(screen.getByLabelText("Tracking link")).toBeTruthy();
    expect(screen.queryByText("Remember my window size")).toBeNull();
    expect(screen.queryByRole("link", { name: /Track your report/ })).toBeNull();
    expect(screen.queryByRole("link", { name: /Back to product/ })).toBeNull();
    expect(screen.queryByRole("button", { name: "Send feedback" })).toBeNull();
  });
  it("uses an account submission link without advertising it as a guest tracking link", () => {
    render(<PublicContributorForm project={{ name: "Desktop", slug: "desktop" }} orgSlug="zedu" projectSlug="desktop" privateTracking={false} initialSubmission={{ title: "Window size", trackingPath: "/zedu/desktop/track/account-link" }} />);
    expect(screen.getByLabelText("Submission link")).toBeTruthy();
    expect(screen.queryByText(/Anyone with this link/)).toBeNull();
  });
  it("opens the same neutral form from a legacy problem link", () => {
    render(<PublicContributorForm project={{ name: "Web", slug: "web" }} orgSlug="zedu" projectSlug="web" kind="problem" />);
    expect(screen.getByLabelText(/Your feedback/)).toBeTruthy();
    expect(screen.queryByLabelText(/Where does this happen/)).toBeNull();
    expect(screen.queryByText("Review your report")).toBeNull();
  });
});

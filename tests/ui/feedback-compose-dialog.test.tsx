// @vitest-environment jsdom
import React from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
vi.mock("@/components/public-contributor-form", () => ({ PublicContributorForm: ({ project, onCancel }: { project: { slug: string }; onCancel: () => void }) => <form data-product={project.slug}><textarea aria-label="Details" /><button type="button" onClick={onCancel}>Cancel</button></form> }));
import { FeedbackComposeDialog } from "@/components/feedback-compose-dialog";
const product = { id: "web-id", organisationId: "team-id", slug: "web", name: "Ziki", goal: null, visibility: "public" as const, acceptsGuestIdeas: true, organisation: { name: "Ziki", slug: "team" } };
beforeEach(() => {
  HTMLDialogElement.prototype.showModal = function () { this.setAttribute("open", ""); };
  HTMLDialogElement.prototype.close = function () { this.removeAttribute("open"); };
});
afterEach(cleanup);
it("opens the existing intake for the exact product and focuses its textarea", () => {
  render(<FeedbackComposeDialog product={product} signedIn={false} />);
  expect(screen.queryByRole("dialog")).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Add feedback" }));
  const dialog = screen.getByRole("dialog", { name: "Add feedback" });
  expect(dialog.querySelector("form")?.getAttribute("data-product")).toBe("web");
  expect(document.activeElement).toBe(screen.getByRole("textbox", { name: "Details" }));
  fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
  expect(screen.queryByRole("dialog")).toBeNull();
});

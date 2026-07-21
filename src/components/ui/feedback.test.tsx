import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { InstallPrompt, OfflineBanner } from "./feedback";

describe("connection and install feedback", () => {
  beforeEach(() => window.localStorage.clear());

  it("explains the privacy-safe offline state", () => {
    render(<OfflineBanner forceOffline />);
    expect(screen.getByRole("status")).toHaveTextContent("You’re offline");
    expect(screen.getByRole("status")).toHaveTextContent(
      "Private care information stays online-only",
    );
  });

  it("offers installation without blocking use", async () => {
    const user = userEvent.setup();
    const prompt = vi.fn().mockResolvedValue(undefined);
    const event = new Event("beforeinstallprompt", { cancelable: true });
    Object.assign(event, {
      prompt,
      userChoice: Promise.resolve({ outcome: "accepted", platform: "web" }),
    });
    render(<InstallPrompt />);

    act(() => window.dispatchEvent(event));
    const suggestion = await screen.findByRole("complementary", { name: "Install CareCadence" });
    expect(suggestion).toHaveTextContent("You can keep using the site without it");
    expect(screen.getByRole("button", { name: "Dismiss install suggestion" })).toBeVisible();

    await user.click(screen.getByRole("button", { name: /^Install$/ }));
    await waitFor(() => expect(prompt).toHaveBeenCalledOnce());
    expect(
      screen.queryByRole("complementary", { name: "Install CareCadence" }),
    ).not.toBeInTheDocument();
  });
});

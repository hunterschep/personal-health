import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createTransport: vi.fn(),
  sendMail: vi.fn(),
}));

vi.mock("nodemailer", () => ({
  default: { createTransport: mocks.createTransport },
}));

import { SmtpIdentityMailer } from "./identity-email";

describe("SMTP identity mailer", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.createTransport.mockReturnValue({ sendMail: mocks.sendMail });
    mocks.sendMail.mockResolvedValue({ accepted: ["adult@example.test"] });
  });

  it("disables external content access and sends a neutral verification link", async () => {
    const mailer = new SmtpIdentityMailer(
      {
        host: "smtp.example.test",
        port: 465,
        secure: true,
        username: "mailer",
        password: "synthetic-password",
        from: "CareCadence <accounts@example.test>",
      },
      "https://care.example.test/base",
    );

    expect(mocks.createTransport).toHaveBeenCalledWith(
      expect.objectContaining({
        host: "smtp.example.test",
        disableFileAccess: true,
        disableUrlAccess: true,
      }),
    );
    await mailer.sendEmailVerification("adult@example.test", "token_with-safe.characters");

    expect(mocks.sendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "adult@example.test",
        subject: "Confirm your CareCadence email",
        text: expect.stringContaining(
          "https://care.example.test/verify-email?token=token_with-safe.characters",
        ),
        html: expect.not.stringContaining("health"),
      }),
    );
  });

  it("builds a password reset link without account or health details", async () => {
    const mailer = new SmtpIdentityMailer(
      {
        host: "smtp.example.test",
        port: 587,
        secure: false,
        username: "mailer",
        password: "synthetic-password",
        from: "CareCadence <accounts@example.test>",
      },
      "https://care.example.test",
    );

    await mailer.sendPasswordReset("adult@example.test", "reset-token");

    expect(mocks.sendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        subject: "Reset your CareCadence password",
        text: expect.stringContaining("https://care.example.test/reset-password?token=reset-token"),
        headers: { "X-Auto-Response-Suppress": "All" },
      }),
    );
  });
});

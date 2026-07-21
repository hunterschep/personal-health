import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createTransport: vi.fn(),
  sendMail: vi.fn(),
  verify: vi.fn(),
}));

vi.mock("nodemailer", () => ({
  default: { createTransport: mocks.createTransport },
}));

import {
  resetSmtpDeliveryStatusForTests,
  SmtpReminderMailer,
  verifyConfiguredSmtpAtStartup,
} from "./email";

describe("SMTP reminder adapter", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.createTransport.mockReturnValue({ sendMail: mocks.sendMail, verify: mocks.verify });
    mocks.sendMail.mockResolvedValue({ accepted: ["person@example.test"] });
    mocks.verify.mockResolvedValue(true);
    resetSmtpDeliveryStatusForTests();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("disables file and URL access and sends neutral escaped reminder mail", async () => {
    const mailer = new SmtpReminderMailer({
      host: "smtp.example.test",
      port: 465,
      secure: true,
      username: "mailer",
      password: "synthetic-password",
      from: "CareCadence <reminders@example.test>",
    });

    expect(mocks.createTransport).toHaveBeenCalledWith(
      expect.objectContaining({
        host: "smtp.example.test",
        disableFileAccess: true,
        disableUrlAccess: true,
      }),
    );
    await mailer.verify();
    await mailer.send({
      to: "person@example.test",
      text: "Review <private> & follow up",
      deepLink: "https://care.example.test/app/reminders?next=1&safe=true",
    });

    expect(mocks.verify).toHaveBeenCalledOnce();
    expect(mocks.sendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "person@example.test",
        subject: "CareCadence reminder",
        text: expect.stringContaining("Review <private> & follow up"),
        html: expect.stringContaining("Review &lt;private&gt; &amp; follow up"),
      }),
    );
  });

  it("keeps startup available and reports a neutral unavailable state on verification failure", async () => {
    const result = await verifyConfiguredSmtpAtStartup({
      verify: vi.fn(async () => {
        throw new Error("synthetic credential and host detail");
      }),
      send: vi.fn(),
    });

    expect(result).toMatchObject({ status: "unavailable", checkedAt: expect.any(Date) });
    expect(JSON.stringify(result)).not.toContain("credential");
  });

  it("bounds startup verification time", async () => {
    vi.useFakeTimers();
    const verification = verifyConfiguredSmtpAtStartup(
      { verify: vi.fn(() => new Promise<void>(() => undefined)), send: vi.fn() },
      100,
    );

    await vi.advanceTimersByTimeAsync(100);

    await expect(verification).resolves.toMatchObject({ status: "unavailable" });
  });
});

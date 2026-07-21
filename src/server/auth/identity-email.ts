import nodemailer, { type Transporter } from "nodemailer";
import { getServerEnv } from "@/config/env";
import { smtpSettings } from "@/server/reminders/email";

export interface IdentityMailer {
  sendEmailVerification(to: string, token: string): Promise<void>;
  sendPasswordReset(to: string, token: string): Promise<void>;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export class SmtpIdentityMailer implements IdentityMailer {
  readonly #transport: Transporter;
  readonly #from: string;
  readonly #baseUrl: string;

  constructor(settings: NonNullable<ReturnType<typeof smtpSettings>>, baseUrl: string) {
    this.#from = settings.from;
    this.#baseUrl = baseUrl;
    this.#transport = nodemailer.createTransport({
      host: settings.host,
      port: settings.port,
      secure: settings.secure,
      auth: { user: settings.username, pass: settings.password },
      connectionTimeout: 10_000,
      greetingTimeout: 10_000,
      socketTimeout: 20_000,
      disableFileAccess: true,
      disableUrlAccess: true,
    });
  }

  async #send(to: string, subject: string, path: string, action: string): Promise<void> {
    const link = new URL(path, this.#baseUrl).href;
    await this.#transport.sendMail({
      from: this.#from,
      to,
      subject,
      text: `${action}: ${link}\n\nIf you did not request this, you can ignore this message.`,
      html: `<p><a href="${escapeHtml(link)}">${escapeHtml(action)}</a></p><p>If you did not request this, you can ignore this message.</p>`,
      headers: { "X-Auto-Response-Suppress": "All" },
    });
  }

  sendEmailVerification(to: string, token: string): Promise<void> {
    return this.#send(
      to,
      "Confirm your CareCadence email",
      `/verify-email?token=${encodeURIComponent(token)}`,
      "Confirm your email",
    );
  }

  sendPasswordReset(to: string, token: string): Promise<void> {
    return this.#send(
      to,
      "Reset your CareCadence password",
      `/reset-password?token=${encodeURIComponent(token)}`,
      "Choose a new password",
    );
  }
}

export function configuredIdentityMailer(): IdentityMailer | null {
  const settings = smtpSettings();
  const baseUrl = getServerEnv().APP_BASE_URL;
  return settings === null || baseUrl === undefined
    ? null
    : new SmtpIdentityMailer(settings, baseUrl);
}

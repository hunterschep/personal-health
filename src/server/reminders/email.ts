import nodemailer, { type Transporter } from "nodemailer";

import { getServerEnv } from "@/config/env";

export type ReminderEmail = {
  to: string;
  text: string;
  deepLink: string;
};

export interface ReminderMailer {
  verify(): Promise<void>;
  send(message: ReminderEmail): Promise<void>;
}

type SmtpSettings = {
  host: string;
  port: number;
  secure: boolean;
  username: string;
  password: string;
  from: string;
};

export function smtpSettings(): SmtpSettings | null {
  const environment = getServerEnv();
  if (
    environment.SMTP_HOST === undefined ||
    environment.SMTP_PORT === undefined ||
    environment.SMTP_USERNAME === undefined ||
    environment.SMTP_PASSWORD === undefined ||
    environment.SMTP_FROM === undefined
  ) {
    return null;
  }
  return {
    host: environment.SMTP_HOST,
    port: environment.SMTP_PORT,
    secure: environment.SMTP_SECURE,
    username: environment.SMTP_USERNAME,
    password: environment.SMTP_PASSWORD,
    from: environment.SMTP_FROM,
  };
}

function html(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export class SmtpReminderMailer implements ReminderMailer {
  readonly #transport: Transporter;
  readonly #from: string;

  constructor(settings: SmtpSettings) {
    this.#from = settings.from;
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

  async verify(): Promise<void> {
    await this.#transport.verify();
  }

  async send(message: ReminderEmail): Promise<void> {
    const subject = "CareCadence reminder";
    const text = `${message.text}\n\nOpen CareCadence: ${message.deepLink}\n\nCareCadence organizes preventive care and does not provide medical advice.`;
    await this.#transport.sendMail({
      from: this.#from,
      to: message.to,
      subject,
      text,
      html: `<p>${html(message.text)}</p><p><a href="${html(message.deepLink)}">Open CareCadence</a></p><p><small>CareCadence organizes preventive care and does not provide medical advice.</small></p>`,
      headers: { "X-Auto-Response-Suppress": "All" },
    });
  }
}

export function configuredReminderMailer(): ReminderMailer | null {
  const settings = smtpSettings();
  return settings === null ? null : new SmtpReminderMailer(settings);
}

export type SmtpDeliveryStatus = {
  status: "disabled" | "checking" | "ready" | "unavailable";
  checkedAt: Date | null;
};

let startupStatus: SmtpDeliveryStatus = { status: "checking", checkedAt: null };

export function smtpDeliveryStatus(): SmtpDeliveryStatus {
  if (smtpSettings() === null) return { status: "disabled", checkedAt: null };
  return startupStatus;
}

export async function verifyConfiguredSmtpAtStartup(
  mailer: ReminderMailer | null = configuredReminderMailer(),
  timeoutMs = 10_000,
): Promise<SmtpDeliveryStatus> {
  if (mailer === null) return { status: "disabled", checkedAt: null };
  startupStatus = { status: "checking", checkedAt: null };
  try {
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(
        () => reject(new Error("SMTP verification timed out.")),
        timeoutMs,
      );
      void mailer.verify().then(
        () => {
          clearTimeout(timeout);
          resolve();
        },
        (error: unknown) => {
          clearTimeout(timeout);
          reject(error);
        },
      );
    });
    startupStatus = { status: "ready", checkedAt: new Date() };
  } catch {
    startupStatus = { status: "unavailable", checkedAt: new Date() };
  }
  return startupStatus;
}

export function resetSmtpDeliveryStatusForTests(): void {
  startupStatus = { status: "checking", checkedAt: null };
}

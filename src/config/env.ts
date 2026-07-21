import { z } from "zod";

const optionalUrl = z.preprocess((value) => (value === "" ? undefined : value), z.url().optional());

const optionalString = z.preprocess(
  (value) => (value === "" ? undefined : value),
  z.string().min(1).optional(),
);

const booleanFromString = (defaultValue: "true" | "false" = "false") =>
  z
    .enum(["true", "false"])
    .default(defaultValue)
    .transform((value) => value === "true");

const optionalBooleanFromString = z
  .preprocess(
    (value) => (value === "" || value === undefined ? undefined : value),
    z.enum(["true", "false"]).optional(),
  )
  .transform((value) => (value === undefined ? undefined : value === "true"));

export const serverEnvSchema = z
  .object({
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
    DATABASE_URL: z.string().min(1, "DATABASE_URL is required."),
    AUTH_SECRET: z.string().min(32, "AUTH_SECRET must contain at least 32 characters."),
    AUTH_TRUST_HOST: booleanFromString("true"),
    SESSION_COOKIE_SECURE: optionalBooleanFromString,
    APP_BASE_URL: optionalUrl,
    UPLOAD_DIR: z.string().min(1).default("./uploads"),
    MAX_UPLOAD_BYTES: z.coerce.number().int().positive().default(10_485_760),
    SOURCE_SYNC_ENABLED: booleanFromString(),
    SOURCE_STALE_DAYS: z.coerce.number().int().positive().default(180),
    DEMO_SEED_ENABLED: booleanFromString(),
    DEMO_USER_EMAIL: z.email().default("demo@carecadence.local"),
    DEMO_USER_PASSWORD: z.string().min(12).default("carecadence-demo-only"),
    DEFAULT_TIMEZONE: z.string().default("America/New_York"),
    SMTP_HOST: optionalString,
    SMTP_PORT: z.preprocess(
      (value) => (value === "" || value === undefined ? undefined : value),
      z.coerce.number().int().min(1).max(65_535).optional(),
    ),
    SMTP_SECURE: booleanFromString(),
    SMTP_USERNAME: optionalString,
    SMTP_PASSWORD: optionalString,
    SMTP_FROM: optionalString,
    REMINDER_OVERDUE_SNOOZE_MAX_DAYS: z.coerce.number().int().positive().max(366).default(31),
    AUTH_RATE_LIMIT_ATTEMPTS: z.coerce.number().int().positive().default(8),
    AUTH_RATE_LIMIT_WINDOW_MINUTES: z.coerce.number().int().positive().default(15),
    SESSION_DURATION_DAYS: z.coerce.number().int().positive().max(90).default(30),
    LOG_LEVEL: z.enum(["error", "warn", "info", "debug"]).default("info"),
  })
  .superRefine((environment, context) => {
    const smtpValues = [
      environment.SMTP_HOST,
      environment.SMTP_PORT,
      environment.SMTP_USERNAME,
      environment.SMTP_PASSWORD,
      environment.SMTP_FROM,
    ];
    const configuredCount = smtpValues.filter((value) => value !== undefined).length;
    if (configuredCount !== 0 && configuredCount !== smtpValues.length) {
      context.addIssue({
        code: "custom",
        path: ["SMTP_HOST"],
        message: "Configure every SMTP value or leave all SMTP values empty.",
      });
    }
    if (
      environment.NODE_ENV === "production" &&
      environment.DEMO_SEED_ENABLED &&
      environment.DEMO_USER_PASSWORD === "carecadence-demo-only"
    ) {
      context.addIssue({
        code: "custom",
        path: ["DEMO_USER_PASSWORD"],
        message: "Default demo credentials cannot be enabled in production.",
      });
    }
  });

export type ServerEnv = z.infer<typeof serverEnvSchema>;

let cachedEnvironment: ServerEnv | undefined;

export function parseServerEnv(environment: Record<string, string | undefined>): ServerEnv {
  return serverEnvSchema.parse(environment);
}

export function getServerEnv(): ServerEnv {
  cachedEnvironment ??= parseServerEnv(process.env);
  return cachedEnvironment;
}

export function resetEnvironmentForTests(): void {
  cachedEnvironment = undefined;
}

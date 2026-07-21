import type { ServerEnv } from "./env";

export type Capabilities = {
  smtpConfigured: boolean;
  externalSourceSyncEnabled: boolean;
  demoMode: boolean;
};

export function capabilitiesFromEnvironment(environment: ServerEnv): Capabilities {
  return {
    smtpConfigured:
      environment.SMTP_HOST !== undefined &&
      environment.SMTP_PORT !== undefined &&
      environment.SMTP_FROM !== undefined,
    externalSourceSyncEnabled: environment.SOURCE_SYNC_ENABLED,
    demoMode: environment.DEMO_SEED_ENABLED,
  };
}

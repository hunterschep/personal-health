export function register(): void {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  void import("@/server/reminders/email")
    .then(({ verifyConfiguredSmtpAtStartup }) => verifyConfiguredSmtpAtStartup())
    .catch(() => undefined);
}

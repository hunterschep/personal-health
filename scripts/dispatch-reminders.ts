import { disconnectDatabase } from "../src/server/db/client";
import { dispatchDueReminders } from "../src/server/reminders/dispatch";

type Arguments = { dryRun: boolean; now: Date | undefined; batchSize: number };

function argumentsFromCommandLine(values: readonly string[]): Arguments {
  let dryRun = false;
  let now: Date | undefined;
  let batchSize = 100;
  for (const value of values) {
    if (value === "--dry-run") dryRun = true;
    else if (value.startsWith("--now=")) {
      const parsed = new Date(value.slice("--now=".length));
      if (Number.isNaN(parsed.getTime())) throw new RangeError("--now must be an ISO date-time.");
      now = parsed;
    } else if (value.startsWith("--batch=")) {
      batchSize = Number(value.slice("--batch=".length));
    } else {
      throw new RangeError(`Unknown argument: ${value}`);
    }
  }
  return { dryRun, now, batchSize };
}

async function main(): Promise<void> {
  const input = argumentsFromCommandLine(process.argv.slice(2));
  const result = await dispatchDueReminders({
    dryRun: input.dryRun,
    batchSize: input.batchSize,
    ...(input.now === undefined ? {} : { now: input.now }),
  });
  process.stdout.write(
    `Reminder dispatch: ${result.scanned} scanned, ${result.sentIds.length} sent, ${result.failedIds.length} failed, ${result.skippedIds.length} skipped${result.unavailable ? ", SMTP unavailable" : ""}.\n`,
  );
  if (result.sentIds.length > 0) process.stdout.write(`Sent IDs: ${result.sentIds.join(",")}\n`);
  if (result.failedIds.length > 0)
    process.stdout.write(`Failed IDs: ${result.failedIds.join(",")}\n`);
}

void main()
  .catch((error: unknown) => {
    const message = error instanceof Error ? error.message : "Unknown systemic failure.";
    process.stderr.write(`Reminder dispatch failed: ${message}\n`);
    process.exitCode = 1;
  })
  .finally(disconnectDatabase);

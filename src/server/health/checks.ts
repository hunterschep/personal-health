import { randomBytes } from "node:crypto";
import { mkdir, unlink, writeFile } from "node:fs/promises";
import path from "node:path";

export type DependencyStatus = "ok" | "error";

type DatabaseProbe = {
  $queryRawUnsafe<T>(query: string): Promise<T>;
};

async function withTimeout<T>(operation: Promise<T>, timeoutMs: number): Promise<T> {
  let timeout: ReturnType<typeof setTimeout> | undefined;
  const timeoutPromise = new Promise<never>((_resolve, reject) => {
    timeout = setTimeout(() => reject(new Error("HEALTH_CHECK_TIMEOUT")), timeoutMs);
  });

  try {
    return await Promise.race([operation, timeoutPromise]);
  } finally {
    if (timeout !== undefined) clearTimeout(timeout);
  }
}

export async function checkDatabase(
  database: DatabaseProbe,
  timeoutMs = 5_000,
): Promise<DependencyStatus> {
  try {
    await withTimeout(database.$queryRawUnsafe("SELECT 1 AS ok"), timeoutMs);
    return "ok";
  } catch {
    return "error";
  }
}

export async function checkStorage(
  uploadDirectory: string,
  timeoutMs = 5_000,
): Promise<DependencyStatus> {
  const root = path.resolve(uploadDirectory);
  const probePath = path.join(root, `.health-${randomBytes(12).toString("hex")}.tmp`);

  try {
    await withTimeout(
      (async () => {
        await mkdir(root, { recursive: true, mode: 0o700 });
        await writeFile(probePath, "carecadence-readiness\n", {
          encoding: "utf8",
          flag: "wx",
          mode: 0o600,
        });
        await unlink(probePath);
      })(),
      timeoutMs,
    );
    return "ok";
  } catch {
    await unlink(probePath).catch(() => undefined);
    return "error";
  }
}

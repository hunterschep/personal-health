// @vitest-environment node

import { chmod, mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";

import { afterEach, describe, expect, it } from "vitest";

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(
    temporaryDirectories.splice(0).map((directory) => rm(directory, { recursive: true })),
  );
});

async function createFakeDocker(parent: string): Promise<{ bin: string; log: string }> {
  const bin = path.join(parent, "bin");
  const log = path.join(parent, "docker.log");
  await mkdir(bin);
  const executable = path.join(bin, "docker");
  await writeFile(
    executable,
    `#!/usr/bin/env bash
set -Eeuo pipefail
printf '%s\\n' "$*" >>"$FAKE_DOCKER_LOG"
case "$*" in
  "compose ps --status running db --quiet"|"compose ps --status running web --quiet")
    printf 'container-id\\n'
    ;;
  "compose exec -T db sh -c "*)
    printf 'fake-postgresql-custom-dump\\n'
    ;;
  "compose run --rm --no-deps -T --entrypoint sh web -c "*)
    tar --create --file=- --files-from /dev/null
    ;;
  "compose config --format json")
    printf '{"name":"carecadence","services":{"web":{"environment":{"APP_BASE_URL":"http://localhost:3000"}}}}\\n'
    ;;
esac
`,
    { mode: 0o700 },
  );
  await chmod(executable, 0o700);
  return { bin, log };
}

describe("backup and restore operator scripts", () => {
  it("creates a checksummed archive and restores web after a consistent snapshot", async () => {
    const temporaryDirectory = await mkdtemp(path.join(os.tmpdir(), "carecadence-ops-"));
    temporaryDirectories.push(temporaryDirectory);
    const { bin, log } = await createFakeDocker(temporaryDirectory);
    const destination = path.join(temporaryDirectory, "backups");
    const environment = {
      ...process.env,
      PATH: `${bin}:${process.env.PATH ?? ""}`,
      FAKE_DOCKER_LOG: log,
      COMPOSE_PROJECT_NAME: "carecadence-ops-test",
    };

    const backup = spawnSync("bash", ["scripts/backup.sh", destination], {
      cwd: process.cwd(),
      env: environment,
      encoding: "utf8",
    });

    expect(backup.status, backup.stderr).toBe(0);
    expect(backup.stdout).toContain("Backup created:");
    const archivePath = backup.stdout.match(/Backup created: (.+\.tar\.gz)/)?.[1];
    expect(archivePath).toBeDefined();

    const listing = spawnSync("tar", ["-tzf", archivePath!], { encoding: "utf8" });
    expect(listing.status).toBe(0);
    expect(listing.stdout.split("\n")).toEqual(
      expect.arrayContaining(["manifest.json", "database.dump", "uploads.tar"]),
    );

    const dockerCalls = await readFile(log, "utf8");
    expect(dockerCalls).toContain("compose stop web");
    expect(dockerCalls).toContain("compose up -d --wait web");

    await writeFile(log, "");
    const restore = spawnSync("bash", ["scripts/restore.sh", archivePath!], {
      cwd: process.cwd(),
      env: environment,
      input: "cancel\n",
      encoding: "utf8",
    });

    expect(restore.status).toBe(1);
    expect(restore.stdout).toContain("WARNING: this replaces");
    expect(restore.stdout).toContain("Target Compose project: carecadence-ops-test");
    expect(restore.stdout).toContain("Restore cancelled.");
    const restoreCalls = await readFile(log, "utf8");
    expect(restoreCalls).toContain("compose config --format json");
    expect(restoreCalls).not.toContain("compose stop web");
    expect(restoreCalls).not.toContain("pg_restore");
  }, 15_000);
});

import { readFile, stat } from "node:fs/promises";

import { emailSchema, passwordSchema } from "@/contracts/auth";
import { createPrismaClient } from "@/server/db";
import { hashPassword } from "@/server/auth/password";

type Arguments = {
  email: string;
  passwordFile: string | null;
  passwordStdin: boolean;
};

function usage(): never {
  throw new Error(
    "Usage: pnpm account:recover -- --email user@example.com [--password-file /secure/path | --password-stdin]",
  );
}

function parseArguments(values: string[]): Arguments {
  let email: string | null = null;
  let passwordFile: string | null = null;
  let passwordStdin = false;
  for (let index = 0; index < values.length; index += 1) {
    const value = values[index];
    if (value === "--email") {
      email = values[index + 1] ?? usage();
      index += 1;
    } else if (value === "--password-file") {
      passwordFile = values[index + 1] ?? usage();
      index += 1;
    } else if (value === "--password-stdin") {
      passwordStdin = true;
    } else {
      usage();
    }
  }
  if (email === null || (passwordFile !== null && passwordStdin)) usage();
  return { email: emailSchema.parse(email), passwordFile, passwordStdin };
}

async function readAllStdin(): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk)));
  }
  return Buffer.concat(chunks)
    .toString("utf8")
    .replace(/[\r\n]+$/, "");
}

function readHidden(prompt: string): Promise<string> {
  if (!process.stdin.isTTY || !process.stdout.isTTY || process.stdin.setRawMode === undefined) {
    throw new Error(
      "Use --password-file or --password-stdin when no interactive terminal is attached.",
    );
  }
  return new Promise((resolve, reject) => {
    let value = "";
    const wasRaw = process.stdin.isRaw;
    const finish = (error?: Error) => {
      process.stdin.off("data", onData);
      process.stdin.setRawMode(wasRaw);
      process.stdin.pause();
      process.stdout.write("\n");
      if (error === undefined) resolve(value);
      else reject(error);
    };
    const onData = (chunk: Buffer | string) => {
      for (const character of String(chunk)) {
        if (character === "\r" || character === "\n") {
          finish();
          return;
        }
        if (character === "\u0003") {
          finish(new Error("Account recovery cancelled."));
          return;
        }
        if (character === "\u007f" || character === "\b") {
          value = value.slice(0, -1);
        } else if (character >= " ") {
          value += character;
        }
      }
    };
    process.stdout.write(prompt);
    process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdin.on("data", onData);
  });
}

async function recoveryPassword(arguments_: Arguments): Promise<string> {
  if (arguments_.passwordFile !== null) {
    const metadata = await stat(arguments_.passwordFile);
    if ((metadata.mode & 0o077) !== 0) {
      throw new Error(
        "The password file must not be readable or writable by group or other users.",
      );
    }
    return passwordSchema.parse(
      (await readFile(arguments_.passwordFile, "utf8")).replace(/[\r\n]+$/, ""),
    );
  }
  if (arguments_.passwordStdin) return passwordSchema.parse(await readAllStdin());
  const password = passwordSchema.parse(await readHidden("New password: "));
  const confirmation = await readHidden("Confirm password: ");
  if (password !== confirmation) throw new Error("Passwords do not match.");
  return password;
}

let database: ReturnType<typeof createPrismaClient> | null = null;

async function main(): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL;
  if (databaseUrl === undefined || databaseUrl.length === 0) {
    throw new Error("DATABASE_URL is required for local account recovery.");
  }

  const arguments_ = parseArguments(process.argv.slice(2));
  const password = await recoveryPassword(arguments_);
  const activeDatabase = createPrismaClient(databaseUrl);
  database = activeDatabase;
  const user = await activeDatabase.user.findFirst({
    where: { emailNormalized: arguments_.email, deletedAt: null },
    select: { id: true },
  });
  if (user === null) throw new Error("No active account exists for that normalized email address.");
  const passwordHash = await hashPassword(password);
  await activeDatabase.$transaction(async (transaction) => {
    await transaction.user.update({
      where: { id: user.id },
      data: { passwordHash, sessionVersion: { increment: 1 } },
    });
    await transaction.session.deleteMany({ where: { userId: user.id } });
    await transaction.auditLog.create({
      data: {
        actorUserId: user.id,
        action: "account.password_recovered_locally",
        entityType: "User",
        entityId: user.id,
        metadataJson: {},
      },
    });
  });
  process.stdout.write("Password replaced and all existing sessions revoked.\n");
}

void main()
  .catch((error: unknown) => {
    const message = error instanceof Error ? error.message : "Unknown account recovery failure.";
    process.stderr.write(`Account recovery failed: ${message}\n`);
    process.exitCode = 1;
  })
  .finally(async () => {
    await database?.$disconnect();
  });

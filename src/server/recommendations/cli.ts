import type { Prisma } from "@/generated/prisma/client";

export type RebuildCliOptions = {
  all: boolean;
  householdId: string | null;
  profileId: string | null;
  ruleStableKey: string | null;
  rulesChangedSince: string | null;
  dryRun: boolean;
  asOfDate: string | null;
  batchSize: number;
  afterProfileId: string | null;
  help: boolean;
};

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function nextValue(arguments_: readonly string[], index: number, option: string): string {
  const value = arguments_[index + 1];
  if (value === undefined || value.startsWith("--")) {
    throw new Error(`${option} requires a value.`);
  }
  return value;
}

function calendarDate(value: string, option: string): string {
  if (!DATE_PATTERN.test(value) || Number.isNaN(new Date(`${value}T00:00:00.000Z`).valueOf())) {
    throw new Error(`${option} must use YYYY-MM-DD.`);
  }
  return value;
}

export function parseRebuildCliOptions(arguments_: readonly string[]): RebuildCliOptions {
  const options: RebuildCliOptions = {
    all: false,
    householdId: null,
    profileId: null,
    ruleStableKey: null,
    rulesChangedSince: null,
    dryRun: false,
    asOfDate: null,
    batchSize: 100,
    afterProfileId: null,
    help: false,
  };

  for (let index = 0; index < arguments_.length; index += 1) {
    const argument = arguments_[index];
    switch (argument) {
      case "--all":
        options.all = true;
        break;
      case "--household":
        options.householdId = nextValue(arguments_, index, argument);
        index += 1;
        break;
      case "--profile":
        options.profileId = nextValue(arguments_, index, argument);
        index += 1;
        break;
      case "--rule":
        options.ruleStableKey = nextValue(arguments_, index, argument);
        index += 1;
        break;
      case "--rules-changed-since":
        options.rulesChangedSince = calendarDate(nextValue(arguments_, index, argument), argument);
        index += 1;
        break;
      case "--dry-run":
        options.dryRun = true;
        break;
      case "--as-of":
        options.asOfDate = calendarDate(nextValue(arguments_, index, argument), argument);
        index += 1;
        break;
      case "--batch-size": {
        const value = Number(nextValue(arguments_, index, argument));
        if (!Number.isInteger(value) || value < 1 || value > 1000) {
          throw new Error("--batch-size must be an integer from 1 through 1000.");
        }
        options.batchSize = value;
        index += 1;
        break;
      }
      case "--after":
        options.afterProfileId = nextValue(arguments_, index, argument);
        index += 1;
        break;
      case "--help":
      case "-h":
        options.help = true;
        break;
      default:
        throw new Error(`Unknown option: ${argument ?? ""}`);
    }
  }

  const targetCount =
    Number(options.all) + Number(options.householdId !== null) + Number(options.profileId !== null);
  if (targetCount > 1) throw new Error("Choose only one of --all, --household, or --profile.");
  if (targetCount === 0) options.all = true;
  return options;
}

export function rebuildProfileWhere(
  options: RebuildCliOptions,
  affectedJurisdictions: readonly string[],
): Prisma.ProfileWhereInput {
  const idFilters: Prisma.ProfileWhereInput[] = [
    ...(options.profileId === null ? [] : [{ id: options.profileId }]),
    ...(options.afterProfileId === null ? [] : [{ id: { gt: options.afterProfileId } }]),
  ];
  return {
    deletedAt: null,
    ...(options.householdId === null ? {} : { householdId: options.householdId }),
    ...(affectedJurisdictions.length === 0
      ? {}
      : { countryCode: { in: [...affectedJurisdictions] } }),
    ...(idFilters.length === 0 ? {} : { AND: idFilters }),
  };
}

export const REBUILD_CLI_HELP = `Usage: pnpm recommendations:rebuild [options]

Targets (choose one; defaults to --all):
  --all                         Rebuild every active profile
  --household <id>              Rebuild one household
  --profile <id>                Rebuild one profile

Rule scope:
  --rule <stable-key>           Rebuild jurisdictions affected by one rule
  --rules-changed-since <date>  Rebuild jurisdictions with rules updated since YYYY-MM-DD

Safety and batching:
  --dry-run                     Evaluate and classify without database writes
  --as-of <date>                Use a fixed local evaluation date (YYYY-MM-DD)
  --batch-size <1-1000>         Database page size (default 100)
  --after <profile-id>          Resume after the last completed profile ID
`;

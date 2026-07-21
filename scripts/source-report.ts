import { SOURCE_REGISTRY } from "../src/server/sources/registry";
import { buildSourceInventoryReport } from "../src/server/sources/verification";

function parseAsOfDate(arguments_: string[]): { asOfDate: string; json: boolean } {
  let asOfDate = new Date().toISOString().slice(0, 10);
  let json = false;
  for (let index = 0; index < arguments_.length; index += 1) {
    const argument = arguments_[index];
    if (argument === "--json") json = true;
    else if (argument === "--as-of") {
      const value = arguments_[index + 1];
      if (value === undefined) throw new TypeError("--as-of requires YYYY-MM-DD.");
      asOfDate = value;
      index += 1;
    } else {
      throw new TypeError(`Unknown argument: ${argument}`);
    }
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(asOfDate)) {
    throw new TypeError("--as-of requires YYYY-MM-DD.");
  }
  return { asOfDate, json };
}

function main(): void {
  const options = parseAsOfDate(process.argv.slice(2));
  const report = buildSourceInventoryReport(SOURCE_REGISTRY, options.asOfDate);
  if (options.json) {
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
    return;
  }

  const lines = [
    `CareCadence source inventory as of ${report.asOfDate}`,
    `${report.total} registered sources; ${report.active} active`,
    `Freshness: ${report.byFreshness.current} current, ${report.byFreshness.review_due} review due, ${report.byFreshness.future} future, ${report.byFreshness.inactive} inactive`,
    "",
    ...report.sources.map(
      (source) =>
        `${source.slug}\t${source.freshness}\t${source.organization}\t${source.lastVerifiedAt}`,
    ),
  ];
  process.stdout.write(`${lines.join("\n")}\n`);
}

try {
  main();
} catch (error) {
  const message = error instanceof Error ? error.message : "Unknown source report failure.";
  process.stderr.write(`Source report failed: ${message}\n`);
  process.exitCode = 1;
}

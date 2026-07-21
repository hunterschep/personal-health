import AxeBuilder from "@axe-core/playwright";
import { expect, type Page } from "@playwright/test";

function violationReport(
  violations: Awaited<ReturnType<AxeBuilder["analyze"]>>["violations"],
): string {
  return violations
    .map(
      (violation) =>
        `${violation.id} (${violation.impact ?? "unknown impact"}): ${violation.help}\n${violation.nodes
          .map((node) => `  ${node.target.join(" ")} — ${node.failureSummary ?? "failed"}`)
          .join("\n")}`,
    )
    .join("\n\n");
}

export async function expectNoAxeViolations(page: Page, context: string): Promise<void> {
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();

  expect(results.violations, `${context}\n${violationReport(results.violations)}`).toEqual([]);
}

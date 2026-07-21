import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { getPublicSourceMetadata, getSourceBySlug } from "@/server/sources/registry";
import { CachedContentNotice } from "./cached-content-notice";
import { MyHealthfinderContent } from "./myhealthfinder-content";
import { SourceMetadataPanel } from "./source-metadata-panel";
import { StaleSourceWarning } from "./stale-source-warning";

function myHealthfinderSource() {
  const source = getSourceBySlug("myhealthfinder-consumer-content-v4");
  if (source === null) throw new Error("MyHealthfinder source fixture is missing.");
  return source;
}

describe("source components", () => {
  it("always renders attribution with source-supplied MyHealthfinder content", () => {
    const source = myHealthfinderSource();
    const { container } = render(
      <MyHealthfinderContent
        title="Source topic"
        html={'<p onclick="bad()">Safe text</p><script>alert(1)</script>'}
        lastUpdated="2026-07-20"
        attribution={source.attribution}
      />,
    );

    expect(screen.getByText("Source-supplied content")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "MyHealthfinder" })).toHaveAttribute(
      "href",
      "https://odphp.health.gov/myhealthfinder",
    );
    expect(screen.getByLabelText("Source attribution")).toBeInTheDocument();
    expect(container.innerHTML).not.toMatch(/onclick|script/i);
  });

  it("labels cached fallback content with its fetch time", () => {
    render(
      <CachedContentNotice fetchedAt="2026-07-20T12:00:00.000Z" fallback={true} stale={true} />,
    );
    expect(screen.getByText("Showing the last available source copy")).toBeInTheDocument();
    expect(screen.getByText(/past its refresh window/i)).toBeInTheDocument();
  });

  it("uses the required non-alarmist stale-source copy", () => {
    render(<StaleSourceWarning />);
    expect(screen.getByText("Source review due")).toBeInTheDocument();
    expect(screen.getByText(/last reviewed source version/i)).toBeInTheDocument();
    expect(screen.queryByText(/unsafe|invalid|outdated/i)).not.toBeInTheDocument();
  });

  it("does not expose internal reviewer notes in source metadata", () => {
    const source = myHealthfinderSource();
    render(<SourceMetadataPanel source={getPublicSourceMetadata(source)} />);
    expect(screen.getByText(source.title)).toBeInTheDocument();
    expect(screen.queryByText(source.internalReviewerNote)).not.toBeInTheDocument();
  });
});

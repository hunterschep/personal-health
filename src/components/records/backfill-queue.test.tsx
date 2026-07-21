import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { BackfillQueue } from "./backfill-queue";

describe("BackfillQueue", () => {
  it("prefills the existing record while refining its date", () => {
    render(
      <BackfillQueue
        profileId="profile-1"
        questions={[
          {
            serviceId: "service-1",
            service: "Synthetic screening",
            eventId: "event-1",
            refining: true,
            why: "A more precise date narrows the range.",
            methods: [{ id: "method-1", name: "Synthetic method" }],
            existingEvent: {
              methodId: "method-1",
              precision: "year",
              date: "2024",
              result: "inconclusive",
              providerName: "Dr. Rivera",
              note: "Imported portal note",
            },
          },
        ]}
      />,
    );

    expect(screen.getByLabelText("Method")).toHaveValue("method-1");
    expect(screen.getByLabelText("How precise is the date?")).toHaveValue("year");
    expect(screen.getByLabelText("Year")).toHaveValue(2024);
    expect(screen.getByLabelText("Result category")).toHaveValue("inconclusive");
    expect(screen.getByLabelText("Provider (optional)")).toHaveValue("Dr. Rivera");
    expect(screen.getByLabelText("Note (optional)")).toHaveValue("Imported portal note");
  });
});

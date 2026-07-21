import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

const refresh = vi.hoisted(() => vi.fn());
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));

import { LinkedDocumentManager } from "./linked-document-manager";

describe("LinkedDocumentManager", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it("uploads a private document with its explicit medication link target", async () => {
    const fetchMock = vi.fn<typeof fetch>(async () =>
      Response.json({ id: "document-1" }, { status: 201 }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();
    render(
      <LinkedDocumentManager
        profileId="profile-1"
        medicationId="medication-1"
        documents={[]}
        editable
        label="Medication attachment"
      />,
    );

    const file = new File(["%PDF-1.7 synthetic"], "reviewed-record.pdf", {
      type: "application/pdf",
    });
    const input = screen.getByLabelText("Attach a private document to Medication attachment");
    await user.upload(input, file);
    const form = input.closest("form");
    if (form === null) throw new Error("Expected attachment form.");
    fireEvent.submit(form);

    await waitFor(() => expect(fetchMock).toHaveBeenCalledOnce());
    const [, request] = fetchMock.mock.calls[0]!;
    expect(request?.method).toBe("POST");
    expect(request?.body).toBeInstanceOf(FormData);
    const body = request?.body as FormData;
    expect(body.get("medicationId")).toBe("medication-1");
    expect(body.get("clinicianOverrideId")).toBeNull();
    expect(body.get("label")).toBe("Medication attachment");
    expect(refresh).toHaveBeenCalledOnce();
  });
});

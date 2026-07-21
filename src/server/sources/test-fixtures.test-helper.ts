export function myHealthfinderPayload(title = "Get Your Blood Pressure Checked") {
  return {
    Result: {
      Error: "False" as const,
      Total: 1,
      Query: { ApiVersion: "4" as const, ApiType: "myhealthfinder" },
      Resources: {
        All: {
          Resource: [
            {
              Type: "Topic",
              Id: "533",
              Title: title,
              LastUpdate: "1779203291",
              Sections: {
                section: [
                  {
                    Title: "The Basics",
                    Content: "<p>Source text</p>",
                  },
                ],
              },
            },
          ],
        },
      },
    },
  };
}

export function jsonResponse(payload: unknown, status = 200, headers?: HeadersInit): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "content-type": "application/json", ...headers },
  });
}

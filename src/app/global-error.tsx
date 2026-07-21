"use client";

export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body>
        <main style={{ maxWidth: 560, margin: "10vh auto", padding: 24, fontFamily: "sans-serif" }}>
          <h1>CareCadence could not start</h1>
          <p>No information was changed. Check the application connection and try again.</p>
          <button type="button" onClick={reset}>
            Try again
          </button>
        </main>
      </body>
    </html>
  );
}

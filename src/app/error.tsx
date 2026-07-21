"use client";

import { CircleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function ErrorPage({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main id="main-content" className="grid min-h-screen place-items-center px-5 py-12">
      <div className="max-w-md text-center">
        <div className="bg-rose-soft text-rose mx-auto grid size-14 place-items-center rounded-2xl">
          <CircleAlert aria-hidden="true" />
        </div>
        <h1 className="font-editorial mt-6 text-4xl font-semibold">We could not open this page</h1>
        <p className="text-ink-soft mt-3 leading-7">
          Your information has not been changed. Try again, or return to the overview.
        </p>
        <Button className="mt-6" onClick={reset}>
          Try again
        </Button>
      </div>
    </main>
  );
}

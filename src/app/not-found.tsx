import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function NotFoundPage() {
  return (
    <main id="main-content" className="grid min-h-[75vh] place-items-center px-5 py-12 text-center">
      <div className="max-w-md">
        <p className="font-editorial text-brand/25 text-8xl font-medium">404</p>
        <h1 className="font-editorial mt-2 text-4xl font-semibold">This page is not available</h1>
        <p className="text-ink-soft mt-3 leading-7">
          It may have moved, been deleted, or no longer be shared with this account.
        </p>
        <Button asChild className="mt-6">
          <Link href="/app">Return to overview</Link>
        </Button>
      </div>
    </main>
  );
}

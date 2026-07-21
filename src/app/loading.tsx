import { Skeleton } from "@/components/ui/skeleton";

export default function LoadingPage() {
  return (
    <main
      id="main-content"
      className="mx-auto max-w-6xl space-y-5 px-5 py-12"
      aria-label="Loading page"
    >
      <Skeleton className="h-10 w-64" />
      <Skeleton className="h-5 w-96 max-w-full" />
      <div className="grid gap-4 pt-5 md:grid-cols-3">
        <Skeleton className="h-44" />
        <Skeleton className="h-44" />
        <Skeleton className="h-44" />
      </div>
    </main>
  );
}

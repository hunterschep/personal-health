import { notFound } from "next/navigation";
import { isComponentGalleryEnabled } from "@/components/gallery/gallery-access";
import { GalleryFormControls, GalleryOverlays } from "@/components/gallery/gallery-interactions";
import {
  GalleryFeedbackFixtures,
  GalleryNavigationAndData,
  GallerySourceFixtures,
  GalleryStatusFixtures,
} from "@/components/gallery/gallery-fixtures";
import { Brand } from "@/components/shared/brand";
import { ThemeToggle } from "@/components/shared/theme-toggle";

export const dynamic = "force-dynamic";

export default function ComponentGalleryPage() {
  if (!isComponentGalleryEnabled(process.env.NODE_ENV)) notFound();

  return (
    <div className="min-h-screen">
      <header className="border-line bg-background/90 sticky top-0 z-30 border-b backdrop-blur-xl">
        <div className="mx-auto flex min-h-16 max-w-7xl items-center justify-between gap-4 px-5 sm:px-8">
          <Brand />
          <div className="flex items-center gap-2">
            <span className="bg-accent-soft text-ink hidden rounded-full px-3 py-1 text-xs font-bold sm:inline-flex">
              Development only
            </span>
            <ThemeToggle />
          </div>
        </div>
      </header>
      <main id="main-content" className="mx-auto max-w-7xl space-y-16 px-5 py-12 sm:px-8 sm:py-16">
        <header className="max-w-3xl">
          <p className="text-brand text-xs font-bold tracking-[0.12em] uppercase">Visual system</p>
          <h1 className="font-editorial mt-2 text-5xl font-semibold tracking-[-0.04em] sm:text-6xl">
            Component gallery
          </h1>
          <p className="text-ink-soft mt-5 text-lg leading-8">
            The complete CareCadence primitive inventory, including difficult fixture states and
            keyboard-operable overlays.
          </p>
        </header>
        <GalleryStatusFixtures />
        <GalleryFormControls />
        <GalleryOverlays />
        <GallerySourceFixtures />
        <GalleryFeedbackFixtures />
        <GalleryNavigationAndData />
      </main>
    </div>
  );
}

import type { ReactNode } from "react";
import { Brand } from "@/components/shared/brand";
import { ThemeToggle } from "@/components/shared/theme-toggle";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen">
      <header className="mx-auto flex max-w-7xl items-center justify-between px-5 py-5 sm:px-8 lg:px-10">
        <Brand />
        <ThemeToggle />
      </header>
      <main
        id="main-content"
        className="mx-auto grid max-w-7xl px-5 pt-8 pb-16 sm:px-8 lg:grid-cols-2 lg:gap-20 lg:px-10 lg:pt-16"
      >
        <div className="hidden max-w-lg lg:block">
          <p className="text-brand text-xs font-bold tracking-[0.14em] uppercase">
            A calmer way to prepare
          </p>
          <h1 className="font-editorial mt-5 text-6xl leading-[0.95] font-medium tracking-[-0.045em] text-balance">
            Your health history deserves a clear rhythm.
          </h1>
          <p className="text-ink-soft mt-7 text-lg leading-8">
            Keep dates honest, sources visible, and every adult profile private on its own terms.
          </p>
        </div>
        <div className="mx-auto w-full max-w-md">{children}</div>
      </main>
    </div>
  );
}

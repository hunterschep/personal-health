import Link from "next/link";
import { Brand } from "@/components/shared/brand";
import { ThemeToggle } from "@/components/shared/theme-toggle";
import { Button } from "@/components/ui/button";
import { routes } from "@/config";

export function PublicHeader() {
  return (
    <header className="relative z-10 mx-auto flex w-full max-w-7xl items-center justify-between px-5 py-5 sm:px-8 lg:px-10">
      <Brand />
      <nav aria-label="Public navigation" className="flex items-center gap-1 sm:gap-2">
        <ThemeToggle />
        <Button variant="ghost" asChild className="hidden sm:inline-flex">
          <Link href={routes.signIn}>Sign in</Link>
        </Button>
        <Button size="sm" asChild>
          <Link href={routes.register}>Create your plan</Link>
        </Button>
      </nav>
    </header>
  );
}

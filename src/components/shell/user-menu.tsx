"use client";

import { Database, LogOut, Settings, ShieldCheck, UserRound } from "lucide-react";
import Link from "next/link";
import { Button, IconButton } from "@/components/ui/button";
import { PopoverContent, PopoverRoot, PopoverTrigger } from "@/components/ui/overlays";

const menuLink =
  "text-ink hover:bg-surface-muted flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm font-semibold";

export function UserMenu({ userName }: { userName: string }) {
  return (
    <PopoverRoot>
      <PopoverTrigger asChild>
        <IconButton variant="ghost" aria-label="Open user menu">
          <UserRound aria-hidden="true" />
        </IconButton>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-64 p-2">
        <div className="border-line border-b px-3 py-2">
          <p className="truncate font-semibold">{userName}</p>
          <p className="text-ink-soft mt-0.5 text-xs">Account and privacy</p>
        </div>
        <nav aria-label="User menu" className="mt-2 grid gap-1">
          <Link href="/app/settings" className={menuLink}>
            <Settings aria-hidden="true" className="size-4" /> Settings
          </Link>
          <Link href="/app/settings/security" className={menuLink}>
            <ShieldCheck aria-hidden="true" className="size-4" /> Security
          </Link>
          <Link href="/app/settings/data" className={menuLink}>
            <Database aria-hidden="true" className="size-4" /> Data and exports
          </Link>
        </nav>
        <form action="/api/auth/sign-out" method="post" className="border-line mt-2 border-t pt-2">
          <Button type="submit" variant="ghost" className="w-full justify-start px-3">
            <LogOut aria-hidden="true" /> Sign out
          </Button>
        </form>
      </PopoverContent>
    </PopoverRoot>
  );
}

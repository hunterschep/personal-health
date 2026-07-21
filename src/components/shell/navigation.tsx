"use client";

import {
  Bell,
  CalendarDays,
  ClipboardList,
  HeartPulse,
  Home,
  Library,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  Pill,
  Settings,
  UsersRound,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Brand } from "@/components/shared/brand";
import { Button, IconButton } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type NavigationItem = {
  label: string;
  href: string;
  icon: typeof Home;
};

type NavigationProps = {
  profileId: string | null;
  canEdit: boolean;
  canManage: boolean;
};

function primaryNavigation(selectedProfileId: string | null): NavigationItem[] {
  return [
    { label: "Overview", href: "/app", icon: Home },
    ...(selectedProfileId === null
      ? []
      : [
          {
            label: "Care Plan",
            href: `/app/profile/${selectedProfileId}/care-plan`,
            icon: HeartPulse,
          },
          {
            label: "Timeline",
            href: `/app/profile/${selectedProfileId}/timeline`,
            icon: ClipboardList,
          },
          {
            label: "Calendar",
            href: `/app/profile/${selectedProfileId}/calendar`,
            icon: CalendarDays,
          },
          {
            label: "Records",
            href: `/app/profile/${selectedProfileId}/records`,
            icon: Library,
          },
          {
            label: "Medications",
            href: `/app/profile/${selectedProfileId}/medications`,
            icon: Pill,
          },
        ]),
    { label: "Family", href: "/app/family", icon: UsersRound },
  ];
}

function secondaryNavigation({ profileId, canEdit, canManage }: NavigationProps): NavigationItem[] {
  return [
    { label: "Reminders", href: "/app/reminders", icon: Bell },
    { label: "Sources", href: "/app/sources", icon: Library },
    ...(profileId !== null && canManage
      ? [
          {
            label: "Profile sharing",
            href: `/app/profile/${profileId}/sharing`,
            icon: UsersRound,
          },
        ]
      : []),
    ...(profileId !== null && canEdit
      ? [
          {
            label: "Profile settings",
            href: `/app/profile/${profileId}/settings`,
            icon: Settings,
          },
        ]
      : []),
    { label: "Settings", href: "/app/settings", icon: Settings },
  ];
}

function NavLink({
  label,
  href,
  icon: Icon,
  compact = false,
}: NavigationItem & { compact?: boolean }) {
  const pathname = usePathname();
  const active = pathname === href || (href !== "/app" && pathname.startsWith(href));
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "group flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-semibold transition",
        active
          ? "bg-brand-soft text-brand-strong"
          : "text-ink-soft hover:bg-surface-muted hover:text-ink",
        compact && "justify-center px-2",
      )}
    >
      <Icon aria-hidden="true" className="size-4.5 shrink-0" />
      {!compact ? <span>{label}</span> : <span className="sr-only">{label}</span>}
    </Link>
  );
}

export function DesktopSidebar(props: NavigationProps) {
  const [collapsed, setCollapsed] = useState(false);
  const primaryNav = primaryNavigation(props.profileId);
  const secondaryNav = secondaryNavigation(props);

  useEffect(() => {
    document.documentElement.dataset.sidebar = collapsed ? "collapsed" : "expanded";
  }, [collapsed]);

  function toggleCollapsed() {
    const next = !collapsed;
    setCollapsed(next);
  }

  return (
    <aside
      data-collapsed={collapsed}
      className={cn(
        "border-line bg-surface/90 fixed inset-y-0 left-0 z-30 hidden flex-col border-r px-3 py-5 backdrop-blur-xl transition-[width] lg:flex",
        collapsed ? "w-20" : "w-64",
      )}
    >
      <div
        className={cn(
          "flex items-center",
          collapsed ? "flex-col justify-center gap-2" : "justify-between gap-2 px-1",
        )}
      >
        <Brand compact={collapsed} className={cn(!collapsed && "px-1")} />
        <IconButton
          variant="ghost"
          aria-label={collapsed ? "Expand main navigation" : "Collapse main navigation"}
          aria-expanded={!collapsed}
          onClick={toggleCollapsed}
        >
          {collapsed ? <PanelLeftOpen aria-hidden="true" /> : <PanelLeftClose aria-hidden="true" />}
        </IconButton>
      </div>
      <nav
        aria-label="Main navigation"
        className={cn("flex flex-1 flex-col gap-1", collapsed ? "mt-5" : "mt-9")}
      >
        {primaryNav.map((item) => (
          <NavLink key={item.label} {...item} compact={collapsed} />
        ))}
        <div className="border-line my-3 border-t" />
        {secondaryNav.map((item) => (
          <NavLink key={item.label} {...item} compact={collapsed} />
        ))}
      </nav>
      {collapsed ? null : (
        <p className="text-ink-soft px-3 text-[0.68rem] leading-4">
          Organizes preventive care. Does not replace clinical advice.
        </p>
      )}
    </aside>
  );
}

export function MobileNavigation(props: NavigationProps) {
  const [open, setOpen] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);
  const moreButtonRef = useRef<HTMLButtonElement>(null);
  const primaryNav = primaryNavigation(props.profileId);
  const secondaryNav = secondaryNavigation(props);
  const quick =
    props.profileId === null
      ? primaryNav
      : ["Overview", "Care Plan", "Timeline", "Records"]
          .map((label) => primaryNav.find((item) => item.label === label))
          .filter((item): item is NavigationItem => item !== undefined);
  const quickLabels = new Set(quick.map((item) => item.label));
  const moreNavigation = [
    ...primaryNav.filter((item) => !quickLabels.has(item.label)),
    ...secondaryNav,
  ];

  useEffect(() => {
    if (!open) return;
    dialogRef.current?.querySelector<HTMLElement>("a, button")?.focus();
  }, [open]);

  function closeMenu() {
    setOpen(false);
    requestAnimationFrame(() => moreButtonRef.current?.focus());
  }

  function handleDialogKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    if (event.key === "Escape") {
      event.preventDefault();
      closeMenu();
      return;
    }
    if (event.key !== "Tab") return;

    const focusable = Array.from(
      dialogRef.current?.querySelectorAll<HTMLElement>("a[href], button:not([disabled])") ?? [],
    );
    const first = focusable[0];
    const last = focusable.at(-1);
    if (first === undefined || last === undefined) return;

    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  return (
    <>
      <nav
        aria-label="Mobile navigation"
        className="border-line bg-surface/95 fixed inset-x-0 bottom-0 z-40 grid border-t px-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] backdrop-blur-xl lg:hidden"
        style={{ gridTemplateColumns: `repeat(${quick.length + 1}, minmax(0, 1fr))` }}
      >
        {quick.map(({ label, href, icon: Icon }) => (
          <Link
            key={label}
            href={href}
            className="text-ink-soft flex min-h-14 flex-col items-center justify-center gap-1 text-[0.65rem] font-semibold"
          >
            <Icon aria-hidden="true" className="size-5" />
            {label}
          </Link>
        ))}
        <button
          ref={moreButtonRef}
          type="button"
          onClick={() => setOpen(true)}
          aria-haspopup="dialog"
          aria-expanded={open}
          aria-controls="mobile-navigation-dialog"
          className="text-ink-soft flex min-h-14 flex-col items-center justify-center gap-1 text-[0.65rem] font-semibold"
        >
          <Menu aria-hidden="true" className="size-5" /> More
        </button>
      </nav>
      {open ? (
        <div
          className="bg-ink/25 fixed inset-0 z-50 backdrop-blur-sm lg:hidden"
          onMouseDown={closeMenu}
        >
          <div
            id="mobile-navigation-dialog"
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-label="More navigation"
            className="border-line bg-surface absolute inset-x-0 bottom-0 max-h-[82vh] rounded-t-[2rem] border p-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] shadow-2xl"
            onMouseDown={(event) => event.stopPropagation()}
            onKeyDown={handleDialogKeyDown}
          >
            <div className="bg-line-strong mx-auto mb-5 h-1.5 w-12 rounded-full" />
            <div className="grid grid-cols-2 gap-2">
              {moreNavigation.map((item) => (
                <NavLink key={item.label} {...item} />
              ))}
            </div>
            <Button variant="secondary" className="mt-5 w-full" onClick={closeMenu}>
              Close
            </Button>
          </div>
        </div>
      ) : null}
    </>
  );
}

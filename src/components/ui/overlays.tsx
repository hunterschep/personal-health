"use client";

import { Check, Search, X } from "lucide-react";
import { AlertDialog as AlertDialogPrimitive, Dialog as DialogPrimitive, Popover } from "radix-ui";
import type { ComponentProps, ReactNode } from "react";
import { useId, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const PopoverRoot = Popover.Root;
export const PopoverTrigger = Popover.Trigger;
export const PopoverAnchor = Popover.Anchor;
export const PopoverClose = Popover.Close;

export function PopoverContent({
  className,
  align = "center",
  sideOffset = 8,
  ...props
}: ComponentProps<typeof Popover.Content>) {
  return (
    <Popover.Portal>
      <Popover.Content
        align={align}
        sideOffset={sideOffset}
        className={cn(
          "border-line bg-surface text-ink z-50 max-w-sm rounded-xl border p-4 shadow-2xl",
          className,
        )}
        {...props}
      />
    </Popover.Portal>
  );
}

export const Sheet = DialogPrimitive.Root;
export const SheetTrigger = DialogPrimitive.Trigger;
export const SheetClose = DialogPrimitive.Close;
export const SheetTitle = DialogPrimitive.Title;
export const SheetDescription = DialogPrimitive.Description;

type SheetSide = "left" | "right" | "bottom" | "full";

const sheetPosition: Record<SheetSide, string> = {
  left: "inset-y-0 left-0 h-full w-[min(26rem,calc(100%-2rem))] rounded-r-[1.75rem] border-r",
  right: "inset-y-0 right-0 h-full w-[min(26rem,calc(100%-2rem))] rounded-l-[1.75rem] border-l",
  bottom:
    "inset-x-0 bottom-0 max-h-[92vh] w-full rounded-t-[1.75rem] border-t sm:left-1/2 sm:max-w-2xl sm:-translate-x-1/2 sm:rounded-[1.75rem] sm:border",
  full: "inset-0 h-full w-full",
};

export function SheetContent({
  side = "right",
  className,
  children,
  ...props
}: ComponentProps<typeof DialogPrimitive.Content> & { side?: SheetSide }) {
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className="bg-ink/30 fixed inset-0 z-50 backdrop-blur-sm" />
      <DialogPrimitive.Content
        className={cn(
          "border-line bg-surface fixed z-50 overflow-y-auto p-6 shadow-2xl outline-none sm:p-7",
          sheetPosition[side],
          className,
        )}
        {...props}
      >
        {side === "bottom" ? (
          <div aria-hidden="true" className="bg-line-strong mx-auto mb-5 h-1.5 w-12 rounded-full" />
        ) : null}
        {children}
        <DialogPrimitive.Close className="text-ink-soft hover:bg-surface-muted hover:text-ink absolute top-4 right-4 grid size-11 place-items-center rounded-full">
          <X aria-hidden="true" className="size-4" />
          <span className="sr-only">Close</span>
        </DialogPrimitive.Close>
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
}

export const Drawer = DialogPrimitive.Root;
export const DrawerTrigger = DialogPrimitive.Trigger;
export const DrawerClose = DialogPrimitive.Close;
export const DrawerTitle = DialogPrimitive.Title;
export const DrawerDescription = DialogPrimitive.Description;

export function DrawerContent(props: Omit<ComponentProps<typeof SheetContent>, "side">) {
  return <SheetContent side="bottom" {...props} />;
}

export function ConfirmationDialog({
  trigger,
  title,
  description,
  confirmLabel,
  cancelLabel = "Cancel",
  destructive = false,
  onConfirm,
}: {
  trigger: ReactNode;
  title: string;
  description: string;
  confirmLabel: string;
  cancelLabel?: string;
  destructive?: boolean;
  onConfirm: () => void;
}) {
  return (
    <AlertDialogPrimitive.Root>
      <AlertDialogPrimitive.Trigger asChild>{trigger}</AlertDialogPrimitive.Trigger>
      <AlertDialogPrimitive.Portal>
        <AlertDialogPrimitive.Overlay className="bg-ink/30 fixed inset-0 z-50 backdrop-blur-sm" />
        <AlertDialogPrimitive.Content className="border-line bg-surface fixed top-1/2 left-1/2 z-50 w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-[1.5rem] border p-6 shadow-2xl outline-none sm:p-7">
          <AlertDialogPrimitive.Title className="font-editorial text-3xl font-semibold tracking-[-0.025em]">
            {title}
          </AlertDialogPrimitive.Title>
          <AlertDialogPrimitive.Description className="text-ink-soft mt-3 text-sm leading-6">
            {description}
          </AlertDialogPrimitive.Description>
          <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <AlertDialogPrimitive.Cancel asChild>
              <Button variant="secondary">{cancelLabel}</Button>
            </AlertDialogPrimitive.Cancel>
            <AlertDialogPrimitive.Action asChild>
              <Button variant={destructive ? "destructive" : "primary"} onClick={onConfirm}>
                {confirmLabel}
              </Button>
            </AlertDialogPrimitive.Action>
          </div>
        </AlertDialogPrimitive.Content>
      </AlertDialogPrimitive.Portal>
    </AlertDialogPrimitive.Root>
  );
}

export type CommandMenuItem = Readonly<{
  id: string;
  label: string;
  description?: string;
  keywords?: readonly string[];
  shortcut?: string;
  disabled?: boolean;
  onSelect: () => void;
}>;

export function CommandMenu({
  trigger,
  label = "Command menu",
  placeholder = "Search actions",
  items,
}: {
  trigger: ReactNode;
  label?: string;
  placeholder?: string;
  items: readonly CommandMenuItem[];
}) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const filteredItems = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase();
    if (normalized.length === 0) return items;
    return items.filter((item) =>
      [item.label, item.description, ...(item.keywords ?? [])]
        .filter((value): value is string => value !== undefined)
        .some((value) => value.toLocaleLowerCase().includes(normalized)),
    );
  }, [items, query]);

  function select(item: CommandMenuItem) {
    if (item.disabled) return;
    item.onSelect();
    setOpen(false);
    setQuery("");
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((index) => Math.min(index + 1, Math.max(filteredItems.length - 1, 0)));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((index) => Math.max(index - 1, 0));
    } else if (event.key === "Enter") {
      const active = filteredItems[activeIndex];
      if (active !== undefined) {
        event.preventDefault();
        select(active);
      }
    }
  }

  return (
    <DialogPrimitive.Root
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen);
        if (!nextOpen) setQuery("");
      }}
    >
      <DialogPrimitive.Trigger asChild>{trigger}</DialogPrimitive.Trigger>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="bg-ink/30 fixed inset-0 z-50 backdrop-blur-sm" />
        <DialogPrimitive.Content className="border-line bg-surface fixed top-[18vh] left-1/2 z-50 w-[calc(100%-2rem)] max-w-xl -translate-x-1/2 overflow-hidden rounded-[1.5rem] border shadow-2xl outline-none">
          <DialogPrimitive.Title className="sr-only">{label}</DialogPrimitive.Title>
          <DialogPrimitive.Description className="sr-only">
            Search and choose an available action.
          </DialogPrimitive.Description>
          <div className="border-line flex items-center gap-3 border-b px-5">
            <Search aria-hidden="true" className="text-ink-soft size-5" />
            <input
              autoFocus
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setActiveIndex(0);
              }}
              onKeyDown={handleKeyDown}
              role="combobox"
              aria-expanded="true"
              aria-controls={`${id}-commands`}
              aria-activedescendant={
                filteredItems[activeIndex] === undefined
                  ? undefined
                  : `${id}-command-${activeIndex}`
              }
              aria-label={label}
              placeholder={placeholder}
              className="text-ink placeholder:text-ink-soft min-h-14 min-w-0 flex-1 bg-transparent text-base outline-none"
            />
            <DialogPrimitive.Close className="text-ink-soft hover:bg-surface-muted grid size-11 place-items-center rounded-full">
              <X aria-hidden="true" className="size-4" />
              <span className="sr-only">Close</span>
            </DialogPrimitive.Close>
          </div>
          <div id={`${id}-commands`} role="listbox" className="max-h-[45vh] overflow-y-auto p-2">
            {filteredItems.length === 0 ? (
              <p className="text-ink-soft px-4 py-10 text-center text-sm">No matching actions.</p>
            ) : (
              filteredItems.map((item, index) => (
                <button
                  id={`${id}-command-${index}`}
                  key={item.id}
                  type="button"
                  role="option"
                  aria-selected={index === activeIndex}
                  disabled={item.disabled}
                  onMouseMove={() => setActiveIndex(index)}
                  onClick={() => select(item)}
                  className="hover:bg-surface-muted aria-selected:bg-brand-soft flex min-h-12 w-full items-center gap-3 rounded-xl px-4 py-2 text-left disabled:opacity-50"
                >
                  <Check
                    aria-hidden="true"
                    className={cn(
                      "text-brand size-4 shrink-0",
                      index !== activeIndex && "invisible",
                    )}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="text-ink block text-sm font-semibold">{item.label}</span>
                    {item.description === undefined ? null : (
                      <span className="text-ink-soft block truncate text-xs">
                        {item.description}
                      </span>
                    )}
                  </span>
                  {item.shortcut === undefined ? null : (
                    <kbd className="border-line bg-surface-raised text-ink-soft rounded-md border px-2 py-1 text-[0.65rem]">
                      {item.shortcut}
                    </kbd>
                  )}
                </button>
              ))
            )}
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

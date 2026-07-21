"use client";

import { Check, ChevronsUpDown, Search } from "lucide-react";
import { Checkbox as CheckboxPrimitive, Popover, RadioGroup as RadioPrimitive } from "radix-ui";
import type { ComponentProps } from "react";
import { useId, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/utils";

export function Checkbox({
  label,
  description,
  className,
  id: providedId,
  ...props
}: Omit<ComponentProps<typeof CheckboxPrimitive.Root>, "children"> & {
  label: string;
  description?: string;
}) {
  const generatedId = useId();
  const id = providedId ?? generatedId;
  const descriptionId = description === undefined ? undefined : `${id}-description`;

  return (
    <label htmlFor={id} className={cn("flex min-h-11 cursor-pointer items-start gap-3", className)}>
      <CheckboxPrimitive.Root
        id={id}
        aria-describedby={descriptionId}
        className="border-line-strong bg-surface-raised data-[state=checked]:border-brand data-[state=checked]:bg-brand mt-0.5 grid size-6 shrink-0 place-items-center rounded-md border shadow-sm transition"
        {...props}
      >
        <CheckboxPrimitive.Indicator className="text-white">
          <Check aria-hidden="true" className="size-4" strokeWidth={3} />
        </CheckboxPrimitive.Indicator>
      </CheckboxPrimitive.Root>
      <span>
        <span className="text-ink block text-sm font-semibold">{label}</span>
        {description === undefined ? null : (
          <span id={descriptionId} className="text-ink-soft mt-0.5 block text-xs leading-5">
            {description}
          </span>
        )}
      </span>
    </label>
  );
}

export type RadioOption = Readonly<{
  value: string;
  label: string;
  description?: string;
  disabled?: boolean;
}>;

export function RadioGroup({
  label,
  options,
  className,
  ...props
}: Omit<ComponentProps<typeof RadioPrimitive.Root>, "children"> & {
  label: string;
  options: readonly RadioOption[];
}) {
  const id = useId();
  return (
    <fieldset className={className}>
      <legend id={`${id}-label`} className="text-ink text-sm font-semibold">
        {label}
      </legend>
      <RadioPrimitive.Root aria-labelledby={`${id}-label`} className="mt-3 grid gap-2" {...props}>
        {options.map((option) => {
          const optionId = `${id}-${option.value}`;
          const descriptionId =
            option.description === undefined ? undefined : `${optionId}-description`;
          return (
            <label
              key={option.value}
              htmlFor={optionId}
              className="border-line hover:border-brand/50 has-data-[state=checked]:border-brand has-data-[state=checked]:bg-brand-soft flex min-h-11 cursor-pointer items-start gap-3 rounded-xl border p-3 transition has-disabled:cursor-not-allowed has-disabled:opacity-50"
            >
              <RadioPrimitive.Item
                id={optionId}
                value={option.value}
                disabled={option.disabled}
                aria-describedby={descriptionId}
                className="border-line-strong bg-surface-raised data-[state=checked]:border-brand mt-0.5 grid size-5 shrink-0 place-items-center rounded-full border"
              >
                <RadioPrimitive.Indicator className="bg-brand size-2.5 rounded-full" />
              </RadioPrimitive.Item>
              <span>
                <span className="text-ink block text-sm font-semibold">{option.label}</span>
                {option.description === undefined ? null : (
                  <span id={descriptionId} className="text-ink-soft mt-0.5 block text-xs leading-5">
                    {option.description}
                  </span>
                )}
              </span>
            </label>
          );
        })}
      </RadioPrimitive.Root>
    </fieldset>
  );
}

export type SelectOption = Readonly<{
  value: string;
  label: string;
  description?: string;
  keywords?: readonly string[];
  disabled?: boolean;
}>;

function filterOptions(options: readonly SelectOption[], query: string): readonly SelectOption[] {
  const normalized = query.trim().toLocaleLowerCase();
  if (normalized.length === 0) return options;
  return options.filter((option) =>
    [option.label, option.description, ...(option.keywords ?? [])]
      .filter((value): value is string => value !== undefined)
      .some((value) => value.toLocaleLowerCase().includes(normalized)),
  );
}

export function Combobox({
  label,
  options,
  value,
  defaultValue = "",
  onValueChange,
  name,
  placeholder = "Choose an option",
  emptyMessage = "No matching options.",
  disabled = false,
}: {
  label: string;
  options: readonly SelectOption[];
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  name?: string;
  placeholder?: string;
  emptyMessage?: string;
  disabled?: boolean;
}) {
  const id = useId();
  const searchRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [uncontrolledValue, setUncontrolledValue] = useState(defaultValue);
  const selectedValue = value ?? uncontrolledValue;
  const selected = options.find((option) => option.value === selectedValue);
  const filtered = useMemo(() => filterOptions(options, query), [options, query]);
  const [activeIndex, setActiveIndex] = useState(0);

  function select(nextValue: string) {
    if (value === undefined) setUncontrolledValue(nextValue);
    onValueChange?.(nextValue);
    setOpen(false);
    setQuery("");
  }

  function handleSearchKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((index) => Math.min(index + 1, Math.max(filtered.length - 1, 0)));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((index) => Math.max(index - 1, 0));
    } else if (event.key === "Enter") {
      const active = filtered[activeIndex];
      if (active !== undefined && !active.disabled) {
        event.preventDefault();
        select(active.value);
      }
    }
  }

  return (
    <div className="space-y-2">
      <span id={`${id}-label`} className="text-ink block text-sm font-semibold">
        {label}
      </span>
      {name === undefined ? null : <input type="hidden" name={name} value={selectedValue} />}
      <Popover.Root open={open} onOpenChange={setOpen}>
        <Popover.Trigger asChild>
          <button
            type="button"
            role="combobox"
            aria-labelledby={`${id}-label`}
            aria-controls={`${id}-options`}
            aria-expanded={open}
            disabled={disabled}
            className="border-line-strong bg-surface-raised text-ink focus:border-brand flex min-h-11 w-full items-center justify-between gap-3 rounded-xl border px-3.5 py-2.5 text-left text-base shadow-sm outline-none disabled:opacity-50 sm:text-sm"
          >
            <span className={cn("truncate", selected === undefined && "text-ink-soft")}>
              {selected?.label ?? placeholder}
            </span>
            <ChevronsUpDown aria-hidden="true" className="text-ink-soft size-4 shrink-0" />
          </button>
        </Popover.Trigger>
        <Popover.Portal>
          <Popover.Content
            align="start"
            sideOffset={8}
            className="border-line bg-surface z-50 w-[var(--radix-popover-trigger-width)] min-w-64 rounded-xl border p-2 shadow-2xl"
            onOpenAutoFocus={(event) => {
              event.preventDefault();
              searchRef.current?.focus();
            }}
          >
            <div className="border-line bg-surface-raised flex items-center gap-2 rounded-lg border px-3">
              <Search aria-hidden="true" className="text-ink-soft size-4" />
              <input
                ref={searchRef}
                type="search"
                value={query}
                onChange={(event) => {
                  setQuery(event.target.value);
                  setActiveIndex(0);
                }}
                onKeyDown={handleSearchKeyDown}
                aria-label={`Search ${label.toLocaleLowerCase()}`}
                aria-controls={`${id}-options`}
                aria-activedescendant={
                  filtered[activeIndex] === undefined ? undefined : `${id}-option-${activeIndex}`
                }
                className="text-ink placeholder:text-ink-soft min-h-11 min-w-0 flex-1 bg-transparent text-sm outline-none"
                placeholder="Search options"
              />
            </div>
            <div id={`${id}-options`} role="listbox" className="mt-2 max-h-64 overflow-y-auto">
              {filtered.length === 0 ? (
                <p className="text-ink-soft px-3 py-5 text-center text-sm">{emptyMessage}</p>
              ) : (
                filtered.map((option, index) => (
                  <button
                    id={`${id}-option-${index}`}
                    key={option.value}
                    type="button"
                    role="option"
                    aria-selected={option.value === selectedValue}
                    disabled={option.disabled}
                    onMouseMove={() => setActiveIndex(index)}
                    onClick={() => select(option.value)}
                    className="data-[active=true]:bg-surface-muted aria-selected:bg-brand-soft flex min-h-11 w-full items-start gap-3 rounded-lg px-3 py-2 text-left disabled:opacity-50"
                    data-active={activeIndex === index}
                  >
                    <Check
                      aria-hidden="true"
                      className={cn(
                        "text-brand mt-0.5 size-4 shrink-0",
                        option.value !== selectedValue && "invisible",
                      )}
                    />
                    <span>
                      <span className="text-ink block text-sm font-semibold">{option.label}</span>
                      {option.description === undefined ? null : (
                        <span className="text-ink-soft mt-0.5 block text-xs leading-5">
                          {option.description}
                        </span>
                      )}
                    </span>
                  </button>
                ))
              )}
            </div>
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>
    </div>
  );
}

export function MultiSelect({
  label,
  options,
  values,
  onValuesChange,
  name,
  placeholder = "Choose options",
}: {
  label: string;
  options: readonly SelectOption[];
  values: readonly string[];
  onValuesChange: (values: string[]) => void;
  name?: string;
  placeholder?: string;
}) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const selectedLabels = options
    .filter((option) => values.includes(option.value))
    .map((option) => option.label);

  function toggle(value: string) {
    onValuesChange(
      values.includes(value)
        ? values.filter((candidate) => candidate !== value)
        : [...values, value],
    );
  }

  return (
    <div className="space-y-2">
      <span id={`${id}-label`} className="text-ink block text-sm font-semibold">
        {label}
      </span>
      {name === undefined
        ? null
        : values.map((selectedValue) => (
            <input key={selectedValue} type="hidden" name={name} value={selectedValue} />
          ))}
      <Popover.Root open={open} onOpenChange={setOpen}>
        <Popover.Trigger asChild>
          <button
            type="button"
            aria-labelledby={`${id}-label`}
            aria-haspopup="listbox"
            aria-expanded={open}
            className="border-line-strong bg-surface-raised text-ink focus:border-brand flex min-h-11 w-full items-center justify-between gap-3 rounded-xl border px-3.5 py-2.5 text-left text-base shadow-sm outline-none sm:text-sm"
          >
            <span className={cn("truncate", selectedLabels.length === 0 && "text-ink-soft")}>
              {selectedLabels.length === 0 ? placeholder : selectedLabels.join(", ")}
            </span>
            <ChevronsUpDown aria-hidden="true" className="text-ink-soft size-4 shrink-0" />
          </button>
        </Popover.Trigger>
        <Popover.Portal>
          <Popover.Content
            align="start"
            sideOffset={8}
            className="border-line bg-surface z-50 w-[var(--radix-popover-trigger-width)] min-w-64 rounded-xl border p-2 shadow-2xl"
          >
            <div role="listbox" aria-multiselectable="true" aria-labelledby={`${id}-label`}>
              {options.map((option) => {
                const selected = values.includes(option.value);
                return (
                  <button
                    key={option.value}
                    type="button"
                    role="option"
                    aria-selected={selected}
                    disabled={option.disabled}
                    onClick={() => toggle(option.value)}
                    className="hover:bg-surface-muted aria-selected:bg-brand-soft flex min-h-11 w-full items-start gap-3 rounded-lg px-3 py-2 text-left disabled:opacity-50"
                  >
                    <span
                      aria-hidden="true"
                      className="border-line-strong bg-surface-raised aria-hidden grid size-5 shrink-0 place-items-center rounded-md border"
                    >
                      {selected ? <Check className="text-brand size-3.5" strokeWidth={3} /> : null}
                    </span>
                    <span>
                      <span className="text-ink block text-sm font-semibold">{option.label}</span>
                      {option.description === undefined ? null : (
                        <span className="text-ink-soft mt-0.5 block text-xs leading-5">
                          {option.description}
                        </span>
                      )}
                    </span>
                  </button>
                );
              })}
            </div>
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>
    </div>
  );
}

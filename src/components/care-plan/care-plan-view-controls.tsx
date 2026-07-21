"use client";

import { Printer } from "lucide-react";
import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/form";

const views = ["grouped", "compact", "source", "print"] as const;
export type CarePlanView = (typeof views)[number];

function isCarePlanView(value: string | null): value is CarePlanView {
  return views.some((view) => view === value);
}

export function CarePlanViewSelect({
  value,
  preferenceKey,
  explicit,
  queryString,
}: {
  value: CarePlanView;
  preferenceKey: string;
  explicit: boolean;
  queryString: string;
}) {
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (explicit) return;
    const stored = window.localStorage.getItem(preferenceKey);
    if (!isCarePlanView(stored) || stored === value) return;
    const query = new URLSearchParams(queryString);
    query.set("view", stored);
    router.replace(`${pathname}?${query.toString()}`);
  }, [explicit, pathname, preferenceKey, queryString, router, value]);

  return (
    <Select
      name="view"
      aria-label="Care-plan view"
      value={value}
      onChange={(event) => {
        if (isCarePlanView(event.target.value)) {
          window.localStorage.setItem(preferenceKey, event.target.value);
          const query = new URLSearchParams(queryString);
          query.set("view", event.target.value);
          router.push(`${pathname}?${query.toString()}`);
        }
      }}
    >
      <option value="grouped">Grouped cards</option>
      <option value="compact">Compact list</option>
      <option value="source">Source comparison</option>
      <option value="print">Print summary</option>
    </Select>
  );
}

export function PrintCarePlanButton() {
  return (
    <Button type="button" variant="secondary" onClick={() => window.print()}>
      <Printer aria-hidden="true" /> Print
    </Button>
  );
}

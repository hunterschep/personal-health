"use client";

import { Check, Monitor, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { useSyncExternalStore } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

const choices = [
  { value: "system", label: "System", description: "Follow this device", icon: Monitor },
  { value: "light", label: "Light", description: "Warm paper palette", icon: Sun },
  { value: "dark", label: "Dark", description: "Low-light ink palette", icon: Moon },
] as const;

const subscribeToHydration = () => () => undefined;

export function AppearanceSettings() {
  const { theme, setTheme } = useTheme();
  const mounted = useSyncExternalStore(
    subscribeToHydration,
    () => true,
    () => false,
  );

  return (
    <Card>
      <CardContent>
        <div className="grid gap-3 sm:grid-cols-3">
          {choices.map(({ value, label, description, icon: Icon }) => {
            const selected = mounted && theme === value;
            return (
              <Button
                key={value}
                type="button"
                variant={selected ? "primary" : "secondary"}
                className="h-auto justify-start px-4 py-4 text-left transition-none"
                aria-pressed={selected}
                onClick={() => setTheme(value)}
              >
                <Icon aria-hidden="true" className="size-5 shrink-0" />
                <span className="flex-1">
                  <span className="block font-semibold">{label}</span>
                  <span
                    className={
                      selected ? "block text-xs text-white/75" : "text-ink-soft block text-xs"
                    }
                  >
                    {description}
                  </span>
                </span>
                {selected ? <Check aria-hidden="true" className="size-4" /> : null}
              </Button>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

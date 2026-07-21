"use client";

import { Download, WifiOff, X } from "lucide-react";
import { useEffect, useState } from "react";
import { Toaster, toast } from "sonner";
import { Button, IconButton } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export { toast };

export function ToastProvider() {
  return (
    <Toaster
      position="bottom-right"
      closeButton
      richColors={false}
      toastOptions={{
        classNames: {
          toast: "!border-line !bg-surface !text-ink !rounded-xl !shadow-2xl",
          description: "!text-ink-soft",
          actionButton: "!bg-brand !text-white",
          cancelButton: "!bg-surface-muted !text-ink",
        },
      }}
    />
  );
}

export function OfflineBanner({
  forceOffline = false,
  className,
}: {
  forceOffline?: boolean;
  className?: string;
}) {
  const [online, setOnline] = useState(true);

  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);

  if (online && !forceOffline) return null;
  return (
    <div
      role="status"
      className={cn(
        "border-accent/35 bg-accent-soft text-ink flex items-start gap-3 rounded-xl border px-4 py-3",
        className,
      )}
    >
      <WifiOff aria-hidden="true" className="text-accent mt-0.5 size-5 shrink-0" />
      <div>
        <p className="font-semibold">You’re offline</p>
        <p className="text-ink-soft mt-0.5 text-sm leading-5">
          Private care information stays online-only. Reconnect before opening or saving records.
        </p>
      </div>
    </div>
  );
}

type InstallChoice = Readonly<{ outcome: "accepted" | "dismissed"; platform: string }>;

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<InstallChoice>;
};

const INSTALL_DISMISSED_KEY = "carecadence-install-dismissed";

export function InstallPrompt() {
  const [promptEvent, setPromptEvent] = useState<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    function handlePrompt(event: Event) {
      event.preventDefault();
      if (window.localStorage.getItem(INSTALL_DISMISSED_KEY) !== "1") {
        setPromptEvent(event as BeforeInstallPromptEvent);
      }
    }

    function handleInstalled() {
      setPromptEvent(null);
      window.localStorage.removeItem(INSTALL_DISMISSED_KEY);
    }

    window.addEventListener("beforeinstallprompt", handlePrompt);
    window.addEventListener("appinstalled", handleInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", handlePrompt);
      window.removeEventListener("appinstalled", handleInstalled);
    };
  }, []);

  if (promptEvent === null) return null;

  function dismiss() {
    window.localStorage.setItem(INSTALL_DISMISSED_KEY, "1");
    setPromptEvent(null);
  }

  async function install() {
    if (promptEvent === null) return;
    await promptEvent.prompt();
    await promptEvent.userChoice;
    setPromptEvent(null);
  }

  return (
    <aside
      aria-label="Install CareCadence"
      className="border-brand/25 bg-surface fixed right-4 bottom-20 left-4 z-40 rounded-[1.25rem] border p-4 shadow-2xl sm:right-5 sm:left-auto sm:w-[24rem] lg:bottom-5"
    >
      <div className="flex items-start gap-3 pr-10">
        <span className="bg-brand-soft text-brand-strong grid size-10 shrink-0 place-items-center rounded-xl">
          <Download aria-hidden="true" className="size-5" />
        </span>
        <div>
          <p className="font-semibold">Keep CareCadence close</p>
          <p className="text-ink-soft mt-1 text-sm leading-5">
            Install the private organizer on this device. You can keep using the site without it.
          </p>
        </div>
      </div>
      <IconButton
        variant="ghost"
        aria-label="Dismiss install suggestion"
        onClick={dismiss}
        className="absolute top-2 right-2"
      >
        <X aria-hidden="true" />
      </IconButton>
      <div className="mt-4 flex gap-2">
        <Button type="button" size="sm" onClick={() => void install()}>
          Install
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={dismiss}>
          Not now
        </Button>
      </div>
    </aside>
  );
}

import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";
import type { ReactNode } from "react";
import { ServiceWorkerRegister } from "@/components/shared/service-worker-register";
import { ThemeProvider } from "@/components/shared/theme-provider";
import { InstallPrompt, ToastProvider } from "@/components/ui/feedback";
import "@/styles/globals.css";

// Nonce-based CSP requires request-time rendering so Next.js can attach the
// per-request nonce to every framework script.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: {
    default: "CareCadence — Preventive care, made understandable",
    template: "%s · CareCadence",
  },
  description:
    "A private, self-hostable organizer for preventive care, routine health history, and personal clinician plans.",
  applicationName: "CareCadence",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [
      { url: "/icon.svg", type: "image/svg+xml" },
      { url: "/icon-192.png", type: "image/png", sizes: "192x192" },
      { url: "/icon-512.png", type: "image/png", sizes: "512x512" },
    ],
    apple: [{ url: "/apple-touch-icon.png", type: "image/png", sizes: "180x180" }],
  },
  appleWebApp: { capable: true, title: "CareCadence", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f5f2e9" },
    { media: "(prefers-color-scheme: dark)", color: "#111d1a" },
  ],
  colorScheme: "light dark",
};

export default async function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  const nonce = (await headers()).get("x-nonce") ?? undefined;
  return (
    <html lang="en" suppressHydrationWarning data-scroll-behavior="smooth">
      <head>
        <script
          nonce={nonce}
          suppressHydrationWarning
          dangerouslySetInnerHTML={{
            __html:
              "globalThis.__zod_globalConfig={...(globalThis.__zod_globalConfig||{}),jitless:true};",
          }}
        />
      </head>
      <body className="paper-grain antialiased">
        <ThemeProvider nonce={nonce}>
          <a
            href="#main-content"
            className="bg-ink text-background fixed top-3 left-3 z-[100] -translate-y-20 rounded-full px-4 py-2 text-sm font-semibold transition focus:translate-y-0"
          >
            Skip to content
          </a>
          {children}
          <ToastProvider />
          <InstallPrompt />
          <ServiceWorkerRegister />
        </ThemeProvider>
      </body>
    </html>
  );
}

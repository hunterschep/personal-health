# Part 01 — Visual system, application shell, and interaction primitives

## Scope completed

- Completed the reusable primitive inventory from Part 01 while preserving the existing warm editorial visual system, light/dark themes, status language, and feature-screen UI.
- Completed the responsive shell with collapsible desktop navigation, the required mobile navigation labels, a mobile profile-switcher sheet, a user menu, and an optional right detail panel.
- Added a development-only component gallery at `/dev/components`. The page includes every required difficult fixture and returns a hard 404 from the request proxy outside development.
- Completed the PWA package with raster, maskable, and Apple icons; standalone manifest metadata; a static-only service worker; the privacy-safe offline page; and a dismissible, non-blocking install suggestion.

## Reusable contracts

- Actions and forms: `Button`, label-required `IconButton`, typed text/email/password/date inputs, `Select`, `Textarea`, `FormField`, `ErrorSummary`, `Checkbox`, `RadioGroup`, `Switch`, `Combobox`, `MultiSelect`, and `ApproximateDateInput`.
- Status and display: `Alert`, `Badge`, `StatusBadge`, `EvidenceClassBadge`, `SourceBadge`, `Card`, `StatCard`, `EmptyState`, `Skeleton`, `ProgressRing`, `ProfileAvatar`, and the existing source/privacy components.
- Overlays and feedback: modal dialog, confirmation dialog, sheet, drawer, popover, command menu, tooltip, toast, offline banner, and install suggestion. Radix supplies focus containment and restoration where an overlay is modal.
- Navigation and structured views: tabs, accordion, breadcrumbs, pagination, bulk-entry-only data table, responsive timeline, calendar month, print-only section, guideline-difference panel, and optional right detail panel.
- `FormField` associates hint and error text with its first control while preserving supporting siblings such as a `datalist`.
- `components.json` keeps the local primitives compatible with the shadcn/ui CLI conventions while the checked-in components retain CareCadence's visual language.

## Gallery fixtures

The development gallery includes:

- all 13 frozen recommendation statuses;
- a narrow card with an intentionally long service name;
- missing publication and effective dates;
- competing guideline variants;
- an isolated dark-mode surface;
- error, offline, loading, empty, and print-only states;
- the approximate-date control;
- examples of every Part 01 primitive.

## PWA and privacy contract

- `public/sw.js` precaches only the offline document, manifest, and static icons.
- `/app`, `/api`, sign-in, and registration traffic remain network-only; authenticated health data is never written to Cache Storage.
- The install suggestion appears only after the browser emits `beforeinstallprompt`, remains dismissible, and never gates site use.
- The production request proxy returns 404 for `/dev/components` before the gallery renders.

## Files added or changed

- `src/components/ui/**`
- `src/components/gallery/**`
- `src/components/shell/**`
- `src/styles/globals.css`
- `src/app/layout.tsx`, `src/app/(app)/app/layout.tsx`, and `src/app/(public)/dev/components/page.tsx`
- `src/proxy.ts` and `src/proxy.test.ts`
- `public/manifest.webmanifest`, `public/sw.js`, and the PNG icon set
- focused component and browser tests under `src/**` and `tests/e2e/**`

## Verification

- Part 01 unit, proxy, shell, and structural accessibility tests: 7 files, 35 tests passed.
- Focused ESLint for Part 01 source and browser tests passed with zero warnings.
- Part 01 TypeScript checks passed before unrelated concurrent feature edits introduced transient errors in other owned paths.
- The production build passed with required build-time environment values.
- Direct Chromium verification of the gallery found zero console errors, zero axe violations, and no horizontal overflow. All overlay examples were opened and closed without browser errors.
- Raster asset dimensions were verified at 192×192, 512×512, maskable 512×512, and Apple 180×180.

## Integration considerations

- Keep `DataTable` limited to bulk-entry workflows; ordinary content should continue using cards and lists.
- Use `IconButton` instead of a base `Button` for icon-only actions so an accessible label is required by its TypeScript contract.
- Use `SheetContent side="full"` for mobile details that need the full viewport and `DrawerContent` for shorter bottom-edge workflows.
- New recommendation statuses must update the frozen status contract and gallery fixture together.

## Remaining acceptance gaps

None within Part 01.

## No-core-TODO confirmation

No TODO, placeholder action, fake navigation target, production-accessible gallery, or authenticated service-worker cache remains in the Part 01 scope.

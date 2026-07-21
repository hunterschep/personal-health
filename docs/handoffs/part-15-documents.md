# Part 15 — Private documents, visit preparation, print, data export, and calendar files

## Scope completed

- Implemented opaque local private storage with atomic writes, SHA-256, byte/content limits, MIME sniffing, authenticated forced downloads, soft deletion, and retryable physical cleanup.
- Added care-event, medication, and clinician-instruction attachments plus profile documents with safe metadata and no public file path.
- Added profile-authorized visit prep with conditions, medications, due-now/year, uncertainty, shared decisions, clinician plans, exact appointments, recent flagged-result labels, personal notes, saved section/question/mode preferences, reviewed source URLs, concise/extended print, and privacy-minimized plain-text copy fallback.
- Added profile and privacy-aware household ZIP exports, browser calendar files, profile/account deletion flows, and document cleanup.

## Files added or changed

- `src/server/storage/**`
- Document and attachment route handlers plus record document UI
- `src/components/documents/**`
- Visit-prep page and read model
- `src/server/exports/**`
- Profile/household export and deletion routes
- Print rules in `src/styles/globals.css`

## Public contracts introduced

- `PrivateStorage`, `LocalPrivateStorage`, upload validation, and document lifecycle contracts
- `VisitPrepData`, `VisitPrepDraft`, persisted visit-prep preferences, modes/section selection, source links, plain-text summary, and clipboard fallback
- Explicit medication and clinician-override document-link upload targets
- `addProfileExportFiles`, `createProfileExport`, `resolveHouseholdExportProfiles`, and `createHouseholdExport`

## Database changes

- `20260721030000_document_blob_lifecycle` adds `Document.blobDeletedAt` and cleanup indexing.
- Base document/link models and soft-delete fields come from the initial migration.
- `20260721060000_normative_surface_gaps` adds per-user/profile `VisitPrepPreference` storage.

## Tests added

- Private storage, sniffed MIME equality, size/path safety, download authorization, and deletion cleanup
- Profile/household ZIP contents, CSV escaping, and private-profile omission
- Visit-prep profile scoping, appointment/date precision, modes, saved sections/questions/notes, source URLs, print data, clipboard fallback, and error handling
- Explicit linked-document upload targeting for medication and clinician-instruction UI
- Account/profile deletion and session invalidation browser flows

## Commands run

- 17-file focused Vitest run: 41 tests passed
- `pnpm typecheck`
- `pnpm lint`
- `pnpm exec prisma validate`

## Known integration considerations

- Documents are sensitive private blobs and must be backed up with PostgreSQL metadata.
- Browser printing is the supported PDF path; concise mode bounds content and discloses omissions, while extended mode may span pages.
- Export permission is evaluated per profile even for household owners.

## Remaining limitations

- Virus scanning and OCR remain explicitly outside version one.

## No-core-TODO confirmation

No literal TODO/FIXME, public document URL, cross-profile visit data, missing visit draft/source link, missing medication/override attachment target, or silent clipboard failure remains.

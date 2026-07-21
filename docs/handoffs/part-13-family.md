# Part 13 — Family dashboard, sharing controls, profile claiming, and household activity

## Scope completed

- Implemented a family dashboard that queries only accessible profiles and shows privacy state, age, due/unknown counts, next action, last update, claim status, household timezone, household invitations, pending profile claims, and privacy-aware activity.
- Added per-profile care-plan and timeline quick links for authorized viewers, plus an add-record shortcut only when the existing profile capability grants edit access.
- Added immediate owner-controlled owner-only, selected-member, and household sharing with view/edit/manage grants.
- Added household invitations and revocable, expiring profile-claim invitations with minimal previews and atomic ownership transfer.
- Claim acceptance changes the profile to owner-only and removes implicit creator access unless the new owner explicitly shares it.

## Files added or changed

- Family dashboard, management, invitation, sharing, and invite-acceptance pages
- `src/components/family/**`, including capability-gated profile quick actions
- Household, sharing, claim-invite, and invitation acceptance routes
- `src/server/invitations/**`
- Profile authorization/query policy used by family reads

## Public contracts introduced

- Minimal household/profile invitation previews and claim acceptance services
- `accessibleProfileWhere`, `profileCapabilities`, and view/edit/manage sharing contracts
- Household membership and active-profile mutation contracts
- `familyActivityLabel`, which keeps fixed redacted copy by default and applies the profile owner's detail opt-in only to shared profiles

## Database changes

Part 13 uses the initial migration's household/member/invite, profile grant, profile claim invite, profile ownership, and audit tables. No separate Part 13 migration was added.

## Tests added

- Profile query/policy matrices, owner-only denial, and active-profile selection
- Household/profile invite preview, expiry, revocation, and acceptance
- Claim transfer and post-claim creator denial
- Sharing controls, private family payloads, owner-controlled detailed activity, and household export authorization
- Profile quick-action route targets and edit-capability gating

## Commands run

- `pnpm test:coverage`
- `pnpm typecheck`
- `pnpm build`

The integrated results are recorded in `docs/release-report.md`.

## Known integration considerations

- Household owner/admin status never bypasses a claimed adult profile's privacy.
- Activity queries include only household-wide records or profiles already visible to the viewer. Copy remains fixed and redacted unless the owner of a shared profile enabled detail; even detailed copy contains no service, result, medication, risk, note, or document data.
- Invitation tokens are stored hashed and the one-time raw link is displayed only at creation.

## Remaining limitations

- Activity detail intentionally stops at the shared profile display name. It never names a service or health fact, even when the owner enables detail.

## No-core-TODO confirmation

No core Part 13 TODO, missing profile/claim summary, ignored activity preference, literal TODO/FIXME, or known household-role privacy bypass remains.

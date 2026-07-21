# Part 03 — Authentication, households, invitations, profile ownership, and privacy

## Scope completed

- Added Auth.js Credentials sign-in backed by Argon2id and opaque, revocable database sessions with secure cookie settings, session rotation, sign-out, password change, device revocation, and account deletion.
- Added neutral registration/sign-in errors, dummy-hash credential verification, scoped rate limiting, same-origin mutation checks, optional SMTP email verification and password reset, and local administrator recovery when SMTP is absent.
- Added household creation/management, invitations, role and final-owner safeguards, ownership transfer, member departure, profile sharing, hashed claim invites, and atomic adult-profile claiming.
- Added centralized profile capability/resource matrices and neutral page/route denial for claimed, unclaimed, shared, household-visible, owner-only, removed-member, and stranger cases.

## Files added or changed

- `src/auth.ts`
- `src/server/auth/**`
- `src/server/authorization/**`
- `src/server/households/**` and `src/server/invitations/**`
- `src/app/(auth)/**`, `src/app/invite/**`, and related auth API routes
- Household, invitation, profile-sharing, account-security, and profile-claim routes/components
- `docs/privacy-model.md`

## Public contracts introduced

- Auth.js `auth`, handlers, and credentials sign-in/sign-out integration
- Session creation, lookup, revocation, and version invalidation helpers
- Same-origin, rate-limit, identity-token, email-verification, password-reset, and recovery helpers
- `canViewProfile`, `canEditProfile`, `canManageProfileSharing`, `canExportProfile`, `canDeleteProfile`, `canAccessDocument`, `canViewHouseholdActivity`, `profileCapabilities`, and `canAccessProfileResource`
- Authorized profile/page/query helpers that return neutral not-found behavior

## Database changes

Part 03 consumes the Part 02 identity and privacy tables: `User`, Auth.js account/session/token tables, `Household`, `HouseholdMember`, `HouseholdInvite`, `Profile`, `ProfileAccessGrant`, `ProfileClaimInvite`, and `AuditLog`. No separate Part 03 migration was added.

## Tests added

- Credential timing path, CSRF, cookies, return paths, rate limits, identity tokens, SMTP copy, verification, and password reset
- Complete actor/resource authorization matrix including claimed owner-only adults and removed members
- Active-profile, profile-query, neutral page-access, invite acceptance, final-owner, and member-departure behavior
- Browser privacy, session, public-auth, and family-claim journeys

## Commands run

```text
pnpm exec vitest run src/server/auth src/server/authorization src/app/api/auth src/app/api/households src/app/api/invitations
```

Result: 18 files and 54 tests passed.

## Known integration considerations

- Every nested health-resource query must still bind the entity ID to the already authorized profile; the capability matrix does not make an unscoped database lookup safe.
- SMTP identity mail requires complete SMTP settings and `APP_BASE_URL`. Without SMTP, local registration is verified and password recovery uses `pnpm account:recover`.
- Trusted reverse-proxy configuration must sanitize forwarding headers before process-local network throttling relies on them.

## Remaining limitations

- Authentication throttling is process-local and is suitable only for the documented single-instance deployment.
- The targeted command did not run the production Playwright privacy and claim journeys or a live SMTP delivery.
- The application does not claim that unit authorization matrices replace an external security review.

## No-core-TODO confirmation

No core Part 03 TODO, plaintext token, permissive claimed-profile fallback, or placeholder identity action remains in the owned paths.

# Privacy and threat model

CareCadence stores sensitive health context for an individual or household. This document describes the version-one trust boundaries and operator responsibilities. It is a security model, not a claim of HIPAA compliance or a substitute for a deployment security review.

## Protected assets

- Credentials, password hashes, sessions, and household membership.
- Profile demographics, anatomy answers, risk factors, conditions, family history, surgeries, and medications.
- Care events, clinician instructions, recommendation snapshots, reminder state, and source selections.
- Uploaded documents, generated exports, import files, audit records, and backups.

## Threat actors

- An unauthenticated internet user or automated credential-stuffing client.
- An authenticated user outside the target household.
- A household member without access to a private profile.
- A household administrator attempting to bypass an adult profile's privacy boundary.
- An attacker holding a stolen session cookie.
- A malicious upload or CSV file.
- An external content provider returning unsafe markup or unexpected data.
- An operator who accidentally exposes logs, uploads, environment files, exports, or backups.

## Trust boundaries and controls

The browser is untrusted. Server handlers authenticate the session, resolve household membership, resolve profile permission, and verify that the requested entity belongs to that profile. Client-supplied household IDs, profile IDs, ownership fields, document names, and storage paths are never authorization evidence.

Adult profiles are private by default after they are claimed. A household owner or administrator does not automatically gain access. Sharing is represented by explicit profile grants. Household activity must stay generic enough that it does not reveal a private person's service, diagnosis, medication, or result.

Passwords use Argon2id. Sign-in failures are generic and rate-limited by a normalized email hash and IP prefix. The included limiter is bounded and process-local; multi-replica deployments need a shared proxy or centralized limiter. Client-network keys use `X-Forwarded-For`, so the application must receive that header only from a trusted reverse proxy. Session tokens are random, stored as HMAC digests in PostgreSQL, and sent only in HTTP-only, same-site cookies that are secure in production and expire. Session records can be invalidated server-side.

State-changing requests enforce same-origin checks. A per-request nonce protects application scripts with Content Security Policy; inline script attributes are denied. Responses also set clickjacking, MIME-sniffing, referrer, browser-permission, and cross-origin-opener protections. Production responses set HSTS, which only takes effect when the app is served over HTTPS.

Uploads have size and MIME limits, file-signature checks, opaque random storage keys, authenticated downloads, forced safe content disposition, and partial-file cleanup. The application never constructs a path from a user filename. Uploaded files are not virus-scanned in version one; operators should add malware scanning before accepting files from untrusted people.

CSV data is parsed as data, not code. Imports are bounded, and formula-like fields are escaped when exported. External consumer content is fetched without profile identifiers, validated, and sanitized before display. Cached consumer content may be stale and never controls the deterministic recommendation engine.

The service worker caches only the public offline shell and static public assets. It does not cache `/app`, `/api`, authentication pages, profile data, documents, or exports.

## Logging and audit

Application logs must not contain request bodies, credentials, document filenames, diagnoses, medication names, service results, or raw source payloads. Infrastructure access logs should avoid query strings. Do not add third-party session replay or health-data analytics.

Audit records are intentionally minimal. Security-sensitive actions include exports, document downloads, sharing changes, profile claims, deletion, high-risk administration, and rule/source review operations. Database-backed source review writes a value-free audit action containing only the seeded source identifier and decision class; the reviewer, timestamp, and optional note remain in the protected cache review envelope. Routine dashboard views are not logged merely to create a detailed trail of a person's health interests.

## Operator responsibilities

- Terminate TLS at a trusted reverse proxy and restrict administrative access.
- Strip client-supplied forwarding headers and set the canonical client address at that trusted proxy.
- Generate a unique `AUTH_SECRET` and database password; never deploy example credentials.
- Keep PostgreSQL and the upload volume off the public network.
- Limit filesystem and Docker access to trusted operators.
- Encrypt backups before off-site storage, control retention, and test restores.
- Keep host, container images, dependencies, sources, and rules updated.
- Review reverse-proxy and platform logs for accidental sensitive data exposure.
- Treat exports and backups as copies of the complete health record.

## Data lifecycle and recovery

Ordinary reads exclude soft-deleted profiles and documents. Deletion flows must enforce current authorization and audit the request. Database retention, volume snapshots, and external backups can preserve deleted data until their retention window expires; operators must define and disclose that window.

The supported backup captures PostgreSQL, private uploads, and a checksummed manifest. It briefly stops the web service to prevent database/file drift. Backups contain sensitive health data and no application secret is deliberately added, but database content and uploaded documents remain sensitive even without `.env`.

## Residual risks

A stolen, still-valid session can act with that user's permissions until invalidated or expired. A compromised host or Docker administrator can read the database and files. Uploaded PDFs may contain active or malicious content and are forced to download, but are not scanned. Email delivery exposes recipient addresses and neutral verification, reset, or reminder links/text to the configured SMTP provider; health values are excluded. Rare medical situations and all security threats cannot be modeled exhaustively.

Report a suspected privacy issue by taking the deployment offline, preserving minimal security evidence without copying health payloads, invalidating sessions and credentials as appropriate, and reviewing household/profile access before restoring service.

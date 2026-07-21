# Release performance measurements

CareCadence is sized for one self-hosted application instance and a small household. These measurements are a reproducible local release check, not an internet latency guarantee or a substitute for observing the target host.

## Reproduce the benchmark

Build the production application, migrate and seed a disposable PostgreSQL database, then run:

```bash
pnpm build
DATABASE_URL=postgresql://carecadence:carecadence@127.0.0.1:5432/carecadence_benchmark \
  DEMO_USER_EMAIL=demo@carecadence.local \
  BENCHMARK_AS_OF=2026-07-21 \
  BENCHMARK_ITERATIONS=7 \
  pnpm exec tsx scripts/benchmark-release.ts
```

The benchmark is read-only. Recommendation rebuilding uses `dryRun: true`, and the 1,000-row import check stops after preview resolution. It fails if the production standalone artifacts, a seeded user, or an accessible synthetic profile are absent. Use only synthetic data because timings and row counts can still reveal deployment characteristics.

Each timed operation receives one warm-up followed by seven measured iterations. Times below are process-wall times. SQL counts are the maximum PostgreSQL statements observed at the `pg` driver boundary across measured iterations. Setup queries and session-cookie resolution are excluded; relation-loading statements used by the server read models are included.

## July 21, 2026 release-candidate result

Environment: Node.js 22.22.2, macOS arm64, Apple M3 Max with 14 logical CPUs and 36 GiB RAM. PostgreSQL ran on loopback. The disposable database was created from all eight migrations then seeded with 38 sources, 60 services, 77 methods, 63 rules, two synthetic users, and four synthetic profiles.

| Workload                                   |      Median |         p95 |       Observed range | SQL statements |
| ------------------------------------------ | ----------: | ----------: | -------------------: | -------------: |
| Authenticated overview server read model   |    20.88 ms |    24.30 ms |       17.38–24.30 ms |             20 |
| Family dashboard server read model         |     9.46 ms |    10.33 ms |        8.61–10.33 ms |             12 |
| One-profile recommendation rebuild preview |    16.48 ms |    21.57 ms |       15.16–21.57 ms |             18 |
| Maximum 1,000-row CSV parse and preview    | 2,015.71 ms | 2,028.84 ms | 1,917.51–2,028.84 ms |              3 |

The overview and family workloads mirror the production Prisma selections used by their server-rendered pages, including authorization-bound profile data, nested recommendation summaries, planning data, household invitations, claim state, preferences, and redacted activity. They measure the server data-loading phase rather than browser transfer, React streaming, TLS, or reverse-proxy time. Playwright release journeys separately verify complete production route rendering.

## Production artifact size

The same script inspects the existing `.next` production output without following dependency symlinks.

| Artifact                                |      Bytes | Approximate MiB |
| --------------------------------------- | ---------: | --------------: |
| Standalone server runtime               | 53,653,043 |           51.17 |
| Static assets                           |  1,883,532 |            1.80 |
| Browser JavaScript within static chunks |  1,666,906 |            1.59 |
| Server App Router output                |  3,910,666 |            3.73 |

The standalone number is an on-disk deployment artifact, not bytes sent to a browser. Browser delivery varies by route, compression, cache state, and framework chunk reuse. Re-run this report after dependency, route, catalog, or framework upgrades and compare like-for-like hardware and database topology.

## Interpretation

The measured synthetic household stays within the plan's local responsiveness target: profile rebuilds are fast enough for synchronous feedback, import preview is bounded at the enforced row limit, and overview/family reads are bounded rather than proportional to every household record. The SQL statement counts are explicit regression baselines. A material increase should trigger inspection for duplicated authorization reads, serial fetch waterfalls, or new nested relation loads before release.

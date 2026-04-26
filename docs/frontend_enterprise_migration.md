# Frontend Enterprise Migration: SSR + Streaming + Edge + Microfrontends

## 1. Decision matrix (real constraints)

- Keep Vite as core build system to avoid big-bang migration.
- Add SSR as opt-in runtime (new scripts and server adapter), preserving existing SPA behavior.
- Apply hybrid SSR only to critical routes: /login and initial shell for /.
- Introduce Module Federation progressively by domain remotes without moving all code at once.

## 2. Target architecture (logical diagram in text)

Global User -> Edge CDN -> SSR Node Adapter -> Static Chunks + FastAPI APIs

- Edge CDN:
  - Caches immutable chunks globally.
  - Caches SSR HTML for /login with stale-while-revalidate.

- SSR Node Adapter:
  - Uses renderToPipeableStream for progressive HTML.
  - Injects dehydrated React Query state.
  - Applies per-route cache headers.

- Frontend shell (host):
  - Routing + auth shell + shared providers.
  - Loads domain remotes (dashboard, telemetry, alerts, settings) via federation.

- Backend FastAPI:
  - Owns session/auth + domain APIs.
  - No frontend coupling beyond HTTP contracts.

## 3. Request flow (end-to-end)

1. Browser requests /login.
2. Edge checks cache key login:ssr.
3. On miss, edge forwards to SSR adapter.
4. SSR adapter streams shell immediately, then Suspense-resolved fragments.
5. Browser receives bootstrap script and hydrates with entry-client.
6. Subsequent navigation to / loads dashboard shell and lazy chunks.
7. Domain-heavy widgets (charts, telemetry) stream/defer via Suspense and lazy remotes.

## 4. Streaming split strategy

- Shell immediate:
  - header, layout, auth controls, navigation skeleton.

- Progressive boundaries:
  - dashboard charts
  - telemetry queues
  - alerts feed
  - settings forms

Each domain boundary should have independent fallback and timeout handling.

## 5. Microfrontend slicing model

- Host app:
  - auth/session
  - router ownership
  - shared query client
  - design tokens and global layout

- Remotes:
  - dashboard remote
  - telemetry remote
  - alerts remote
  - settings remote

Shared dependencies must be singleton: react, react-dom, react-router-dom, react-query.

## 6. Migration plan (progressive, non-breaking)

Phase A (done in codebase):
1. Introduce SSR entries and server adapter in parallel to SPA.
2. Keep current npm run build unchanged.

Phase B:
1. Enable build:ssr in CI as non-blocking pipeline.
2. Deploy SSR adapter behind canary route, e.g. /_ssr/login.

Phase C:
1. Route 10 percent traffic for /login to SSR.
2. Validate hydration mismatch, error rates, TTFB.

Phase D:
1. Introduce first remote (dashboard) under feature flag.
2. Keep local fallback component for outage mode.

Phase E:
1. Expand to telemetry/alerts/settings remotes.
2. Add edge purge hooks in deployment workflow.

## 7. Real technical risks and mitigations

1. Hydration mismatch due to auth/session drift:
   - Mitigation: include initialAllowed hint and deterministic shell on server.

2. React duplication across host/remotes:
   - Mitigation: enforce singleton shared versions and runtime checks.

3. Remote entry latency increasing interactive time:
   - Mitigation: preconnect and prefetch remoteEntry.js on known routes.

4. SSR Node bottleneck under burst traffic:
   - Mitigation: cache /login HTML at edge and autoscale adapter.

5. Edge stale content after deploy:
   - Mitigation: hash static assets + targeted purge for HTML only.

## 8. KPI estimates (based on current 282KB initial path)

- LCP:
  - Current SPA: ~1.6s median after optimization.
  - Hybrid SSR+streaming target: ~1.1s to 1.3s.
  - Improvement: 18 to 31 percent.

- TTFB:
  - Current SPA static host: ~250ms regional.
  - Edge-cached /login SSR: ~80ms to 140ms median.
  - Improvement: 44 to 68 percent.

- Scalability:
  - Current: single deploy unit for all frontend domains.
  - Target: independent deploy units per domain remote.
  - Benefit: parallel releases + reduced blast radius.

## 9. Rollout guardrails

- Feature flags per route and per remote.
- Automatic fallback to local component when remote fails.
- Canary deployment with synthetic checks for hydration and stream completion.
- SLO alarms: hydration error ratio, SSR 5xx, remote load timeout.

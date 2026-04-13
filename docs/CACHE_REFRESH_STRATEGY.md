# Cache Refresh Strategy

## Objective

The application uses an application cache that must maximize cache hits on read-heavy views while staying coherent after every create, update, and delete.

The current doctrine is:

- versioned application cache for shared business views
- targeted invalidation when an entity-level cache exists
- refresh of impacted views after successful mutations
- explicit `refresh=1` bypass for admin and CRUD screens that must force a read from the source of truth

## Application cache operating model

The application cache is not a browser cache and not a Redis-only feature. It is a backend application cache with a layered design:

- L1 in-process cache inside the Node.js application
- optional Redis backend when `CACHE_BACKEND=redis`
- versioned cache scopes stored in PostgreSQL
- invalidation fan-out through PostgreSQL notifications

In practice, each shared business view is cached under a logical scope such as `users`, `firms`, `clients`, `deals`, `missions`, `resumes`, or `templates`.

Each cached read follows this sequence:

1. the route calls a service-layer read, not the database directly
2. the service resolves the cache scope version from `cache_scope_versions`
3. the service builds a versioned cache key
4. the service serves the cached value if present
5. otherwise it reads from PostgreSQL, stores the result, and returns it

Each successful mutation follows this sequence:

1. the write is performed through the service layer
2. the affected entity cache is invalidated when an entity-level cache exists
3. the impacted shared view scopes are version-bumped
4. a PostgreSQL notification is emitted so other instances drop stale entries
5. the frontend marks the impacted scopes dirty and triggers a forced refresh on the relevant screens

This means the cache maximizes reuse on repeated reads, but stale entries become unreachable as soon as the scope version changes.

## Cache layers and source of truth

The source of truth remains PostgreSQL.

The cache improves latency and reduces repeated database work, but correctness is maintained by:

- service-owned invalidation after successful writes
- versioned scope keys
- cross-instance invalidation notifications
- forced `refresh=1` reads for screens that must bypass cached reads on demand

Operationally:

- `CACHE_BACKEND=memory` means the effective storage is process-local memory
- `CACHE_BACKEND=redis` means the shared storage backend is Redis when reachable
- even when Redis is configured, the application cache doctrine still applies because scope versioning and invalidation remain service-driven

## Manual refresh semantics

Manual refresh buttons must perform a real server reload.

The contract is:

- the frontend sends `refresh=1`
- the backend bypasses the cached read for that request
- the response comes from the current source of truth
- the cache may then be repopulated with the fresh result

This is the recovery path when a user wants to force reconciliation after create, update, or delete.

## Current contract

### Backend

- Shared cached reads go through service-layer caches, never directly through routes.
- Mutations must invalidate after the successful write, not before.
- Background or batch processes must write through services so cache invalidation stays centralized.
- Read routes that back cached screens should accept `refresh=1` and bypass cache.
- Cache invalidation is version-based first; TTL is only a secondary safety net.

### Frontend

- CRUD screens mark impacted scopes dirty after successful mutations.
- Cached views subscribe to those scopes and force a server refresh.
- A manual refresh button must trigger a real server reload, not a local state-only rerender.
- Optimistic inserts or updates may keep an entity visible temporarily, but a forced refresh remains the source of truth.

## Managed scopes

The main application cache and refresh scopes currently cover:

- `users`
- `firms`
- `clients`
- `deals`
- `missions`
- `resumes`
- `adaptations`
- `templates`
- `jobs`
- `gdprAudit`
- `marketFacts`
- `marketTrends`
- `rome`
- `tags`

These scopes back both the backend application cache and the transverse frontend refresh mechanism.

## Intentional exclusions

Some data paths remain intentionally outside the shared application cache:

- authentication and password reset flows
- security-sensitive user/session state
- binary CV download payloads
- highly parameterized or high-cardinality list queries where cache reuse is too weak
- short-lived operational flows where correctness matters more than reuse

These exclusions are deliberate. They should not be cached without a dedicated review of:

- key cardinality
- invalidation cost
- security impact
- payload size
- expected reuse

## Rules for future changes

When adding a new business view:

1. add a cache namespace only if the view has meaningful read reuse
2. route the read through the service layer
3. define which entity mutations invalidate that view
4. add `refresh=1` support if the screen has a manual refresh action
5. add frontend dirty-scope propagation if the screen participates in transverse refresh
6. cover the contract with targeted route/service tests

When adding a new mutation:

1. perform the write through the service layer
2. invalidate only the affected entity cache when possible
3. invalidate the impacted shared views
4. mark the corresponding frontend refresh scopes dirty
5. verify create, update, and delete behaviour on both backend and frontend

## Operational debugging

When `VITE_DEBUG_VIEW_REFRESH=1` is enabled, the metrics page exposes a debug card for the transverse refresh mechanism.

You can also enable it at runtime without rebuilding the frontend:

- query string: `?viewRefreshDebug=1`
- browser storage: `localStorage.setItem('appViewRefreshDebug', '1')`

This debug view is intended to answer:

- which scopes are currently dirty
- how many refresh marks were produced
- how many runtime deliveries happened
- how many consumers acknowledged refreshes
- which recent refresh events were emitted

This is a debugging aid. It is not a source of truth for backend cache health.

## CI enforcement

The cache/refresh doctrine is validated in CI through:

- `npm run validate:core`
- `npm run validate:e2e`

See [C:\Users\mail\CascadeProjects\ResumeConverter\docs\CI_VALIDATION.md](C:\Users\mail\CascadeProjects\ResumeConverter\docs\CI_VALIDATION.md).

## Performance review guidance

The transverse refresh debug card now exposes refresh-cycle timing:

- total refresh cycles
- failures
- average duration
- last duration
- max duration
- per-scope duration breakdown

Use it to answer:

- which cached screens refresh most often
- which scopes are expensive when forced with `refresh=1`
- whether a scope is failing or simply slow

Operational rule:

- a slow scope with low failure count is a performance issue
- a fast scope with stale UI is usually a dirty-scope propagation issue
- a slow scope plus stale UI often means the front is preserving optimistic state while the backend refresh is late

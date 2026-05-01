# Security Best Practices Report

Date: 2026-05-01

Scope: static review of the ResumeConverter application codebase, with targeted checks on authentication, session handling, CSP/CORS/CSRF, file preview and sharing, OAuth, backup/network boundaries, and dependency advisories.

## Executive Summary

The application already has several solid controls: `HttpOnly` auth cookies, CSRF protection on API mutations, a strict CSP without `unsafe-inline` scripts, CORS allowlisting, admin guards on sensitive routes, SSRF checks for backup/internal PDF services, parameterized SQL patterns, and bounded public share tokens.

The main issues to fix are configuration and trust-boundary problems:

1. **High**: default admin bootstrap can still create an active admin with `admin123`.
2. **Medium**: refresh tokens fall back to the access-token JWT secret.
3. **Medium**: OAuth state is process-local and capped at 100 entries.
4. **Medium**: DOCX preview serves uploaded-derived HTML on the application origin.
5. **Medium**: `nodemailer` has a production dependency advisory.
6. **Low**: authentication rate limits are permissive for password attacks.
7. **Low**: rich HTML sanitizer permits data SVG images and broad URL schemes.

## Findings

### SEC-01 - Default admin bootstrap uses predictable fallback credentials

Severity: High

Evidence:
- `server/scripts/ensure-default-admin.js:23-24` sets fallback credentials to `admin@resumeconverter.local` / `admin123`.
- `server/scripts/ensure-default-admin.js:94-99` hashes that password and inserts an active admin user.
- `server/config/envValidation.js:8-14` does not require `DEFAULT_ADMIN_PASSWORD`.
- `server/config/envValidation.js:79-83` only warns when `DEFAULT_ADMIN_EMAIL` is missing in production.

Impact:
If the bootstrap script runs in production without an explicit `DEFAULT_ADMIN_PASSWORD`, the app can expose a known admin login. This is especially risky because the auth limiter allows many attempts and the fallback email is also predictable.

Recommended fix:
- In production, fail startup or fail the bootstrap script unless `DEFAULT_ADMIN_PASSWORD` is explicitly set and strong.
- Prefer a gated bootstrap flag such as `DEFAULT_ADMIN_BOOTSTRAP_ENABLED=true`.
- Reject known defaults (`admin123`, placeholders, short values) in environment validation.
- Mark any seeded admin as `must_change_password` when created.

### SEC-02 - Refresh tokens reuse `JWT_SECRET` when `REFRESH_TOKEN_SECRET` is missing

Severity: Medium

Evidence:
- `server/config/constants.js:25-28` sets `REFRESH_TOKEN_SECRET = process.env.REFRESH_TOKEN_SECRET || JWT_SECRET`.
- `server/config/envValidation.js:17-28` lists `REFRESH_TOKEN_SECRET` as recommended, not required.

Impact:
If the access-token signing key is exposed or overused, refresh-token verification is also compromised. Key separation is especially important because refresh tokens have a longer lifetime.

Recommended fix:
- Require `REFRESH_TOKEN_SECRET` in production with a minimum length of 32 bytes/characters.
- Keep backward compatibility only in development/test.
- Log a hard startup error in production when the fallback is active.

### SEC-03 - OAuth state is stored only in process memory

Severity: Medium

Evidence:
- `server/services/authOauthState.service.js:4-7` uses an ephemeral in-memory state store with `maxEntries: 100`.
- `server/routes/auth/google.routes.js:61-74` generates state and stores action/user/return URL in that store.
- `server/routes/auth/google.routes.js:103-112` validates and consumes state from that same process-local store.

Impact:
This is not a direct OAuth bypass because the state value is random and one-time-use. The weakness is operational and abuse-related: callbacks can fail across multiple server instances, rolling restarts invalidate pending logins, and a noisy actor can evict legitimate states by starting many OAuth flows.

Recommended fix:
- Store OAuth states in Redis or PostgreSQL with TTL and single-use deletion.
- Bind the state to expected action and, for link flows, the authenticated user.
- Increase observability for state eviction/expiry rates.

### SEC-04 - DOCX preview serves uploaded-derived HTML on the app origin

Severity: Medium

Evidence:
- `server/routes/resumes/crud/handlers.js:159-166` converts uploaded DOCX content with Mammoth and injects `result.value` into an HTML response.
- `server/routes/resumes/crud/handlers.js:345-350` serves that HTML from the application origin with a restrictive CSP, but allows `img-src data: blob: https:`.

Impact:
The current CSP prevents script execution, so this is mitigated. Still, serving uploaded-derived HTML from the same origin is a fragile boundary: if CSP is weakened by a proxy/header regression, this becomes a stored XSS risk. The `https:` image allowance can also leak viewer metadata to remote image URLs embedded in documents.

Recommended fix:
- Sanitize Mammoth output server-side before returning it.
- Prefer rendering previews in a sandboxed iframe or from an isolated preview origin.
- Tighten preview CSP to avoid remote images unless explicitly required, for example `img-src data: blob:`.
- Add regression tests that malicious DOCX-derived HTML cannot execute scripts or load external beacons.

### SEC-05 - Production dependency advisory: `nodemailer`

Severity: Medium

Evidence:
- `npm audit --omit=dev --audit-level=moderate --json` reports one production vulnerability for `nodemailer <= 8.0.4`.
- Advisories include SMTP command injection vectors via `envelope.size` and CRLF in transport `name`.
- Audit suggests upgrade to `nodemailer@8.0.7`, marked as a semver-major update.

Impact:
Exploitability depends on whether attacker-controlled values can reach the affected Nodemailer transport/envelope fields. Even if current usage is safe, keeping a known vulnerable mail library in production creates unnecessary exposure.

Recommended fix:
- Upgrade Nodemailer to a patched version after checking API compatibility.
- Review all mail transport configuration fields that can originate from admin settings or environment variables.
- Add validation rejecting CR/LF in transport names and mail envelope fields.

### SEC-06 - Authentication rate limit is permissive

Severity: Low

Evidence:
- `server/config/constants.js` defines `RATE_LIMIT.AUTH.max` as `200` per 15 minutes.
- `server/middleware/rateLimit.middleware.js:49-64` applies that limit to authentication routes and skips successful requests.

Impact:
The limiter exists, but 200 failed attempts per 15 minutes per IP is generous for password guessing. Combined with predictable bootstrap credentials, this increases brute-force risk.

Recommended fix:
- Lower the IP-based auth limit.
- Add account/email-based throttling for failed login attempts.
- Add progressive delays or short lockouts after repeated failures.
- Keep security logging for failed attempts and lockout events.

### SEC-07 - Frontend HTML sanitizer allows data SVG images and broad URI schemes

Severity: Low

Evidence:
- `client/src/utils/sanitizer.frontend.ts:60-72` allows `img` tags and `data:image/svg+xml;base64` URLs.
- The same regex allows broad schemes including `ftp`, `cid`, `xmpp`, `callto`, and `sms`.

Impact:
DOMPurify is a strong mitigation, and images loaded through `<img>` generally do not execute script in modern browsers. Still, SVG data URLs and broad URI schemes are rarely needed for CV content and increase attack surface for rendering inconsistencies, tracking, or future browser/library regressions.

Recommended fix:
- Remove `svg+xml` from allowed data image types unless a product requirement depends on it.
- Restrict schemes to the minimal set needed, typically `https`, `mailto`, `tel`, and relative URLs.
- Add sanitizer tests for blocked SVG data images and blocked unexpected schemes.

## Positive Controls Observed

- Auth tokens are read from cookies and cookies are configured `HttpOnly`, `SameSite=Lax`, and `Secure` in production paths (`server/routes/auth/config.js:38-45`, `server/middleware/auth.middleware.js:95-98`).
- Auth middleware re-reads current user state and rejects inactive accounts (`server/middleware/auth.middleware.js:162-186`).
- CSRF protection applies to API mutations except explicit first-step auth/public callback paths (`server/config/security.js:223-333`).
- Helmet CSP avoids `unsafe-inline` scripts and uses nonces (`server/config/security.js:52-59`, `server/config/security.js:108-167`).
- CORS is scoped to `/api` and uses an allowlist (`server/config/security.js:174-216`).
- Backup routes require admin auth (`server/routes/backup.routes.js:33-35`).
- Backup/internal URL handling has private/loopback host checks (`server/utils/networkHostSecurity.js:119-161`, `server/utils/networkHostSecurity.js:181-208`).
- File responses set `nosniff` and controlled disposition via a helper (`server/utils/fileResponseSecurity.js:52-55`).
- Public health response is intentionally minimal (`server/routes/healthRouteHelpers.js:328-333`).

## Validation Performed

- Static code inspection of server routes, middleware, auth services, security configuration, file preview, OAuth, backup/network helpers, sharing helpers, and frontend sanitization.
- Searched for common XSS sinks (`dangerouslySetInnerHTML`, `innerHTML`), client-side storage, postMessage, SQL interpolation, command execution, and rate limiting.
- Ran `npm audit --omit=dev --audit-level=moderate --json`.

Not performed:
- No dynamic penetration test.
- No authenticated manual abuse testing.
- No full SAST/DAST tool run.
- No source review of every query builder call beyond targeted inspection.

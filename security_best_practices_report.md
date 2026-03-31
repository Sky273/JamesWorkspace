# Security Best Practices Report

## Executive Summary

The application has a solid baseline on several important controls: cookie-based auth instead of browser token storage, CSRF protection for most API mutations, CSP via Helmet, route-level firm access checks, and restricted MIME types on user-facing resume uploads.  

The most important issues found are:

1. A high-impact shell/path injection risk in the backup restore flow.
2. Sensitive request bodies being written to logs on validation failures.
3. An OAuth popup callback that uses `postMessage(..., '*')`, which unnecessarily exposes cross-window messages to any opener origin.

## High Severity

### Finding SBP-001

- Rule ID: EXPRESS-INPUT-001 / EXPRESS-INJECTION-001
- Severity: High
- Location: `server/utils/validation.js:601-603`, `server/services/backup/core.service.js:279-326`
- Evidence:

```js
// server/utils/validation.js
export const restoreBackupSchema = z.object({
  filename: z.string().min(1).max(500)
}).strip();
```

```js
// server/services/backup/core.service.js
const remotePath = path.posix.join(settings.remote_path || '/backups', filename);
const localCompressedPath = path.join(TEMP_DIR, filename);
const localPath = path.join(TEMP_DIR, filename.replace('.gz', ''));

const command = `"${psqlBin}" -h ${POSTGRES_HOST} -p ${POSTGRES_PORT} -U ${POSTGRES_USER} -d ${POSTGRES_DB} -f "${localPath}"`;
await execAsync(command, { env });
```

- Impact: An authenticated admin can supply a crafted `filename` that reaches filesystem paths and a shell command without an allowlist or escaping. This creates a realistic path traversal and command injection primitive in the restore workflow, which can lead to arbitrary file overwrite and potentially remote code execution in the server context.
- Fix: Restrict restore input to a strict backup filename allowlist such as `^backup-(daily|weekly|monthly|manual)-[a-zA-Z0-9_-]+-\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}\.sql\.gz$`, reject path separators and quotes, resolve and verify the local target stays under `TEMP_DIR`, and replace `exec` string commands with `execFile`/spawn argument arrays.
- Mitigation: Disable backup restore from the web UI/API until input validation and process execution are hardened. Treat backup administration as highly privileged.
- False positive notes: This requires admin access, but that is still a meaningful security boundary. Admin-to-RCE paths should be eliminated.

## Medium Severity

### Finding SBP-002

- Rule ID: EXPRESS-INPUT-001 / EXPRESS-LOGGING-001
- Severity: Medium
- Location: `server/utils/validation.js:1172-1177`, with affected routes including `server/routes/auth/signin.routes.js:57`, `server/routes/auth/passwordReset.routes.js:21`, `server/routes/auth/passwordReset.routes.js:54`, `server/routes/auth/google.routes.js:243`
- Evidence:

```js
safeLog('error', 'Request validation failed', {
  path: req.path,
  errors: JSON.stringify(errors),
  receivedFields: Object.keys(req.body || {}),
  bodyPreview: JSON.stringify(req.body).substring(0, 500)
});
```

- Impact: Any malformed auth or reset request can cause passwords, reset tokens, TOTP codes, or Google ID tokens to be written to application logs. That expands the blast radius of log access and can turn low-signal operational logs into a credential source.
- Fix: Stop logging request bodies in validation failures, or centrally redact sensitive keys such as `password`, `token`, `refreshToken`, `accessToken`, `totpCode`, `idToken`, `authorization`, and similar variants before logging.
- Mitigation: Rotate and protect log access immediately if these logs are currently centralized or retained for long periods.
- False positive notes: This issue only appears on validation failures, not every successful request, but that is still enough to leak real secrets during routine misuse or probing.

### Finding SBP-003

- Rule ID: JS-POSTMESSAGE-001
- Severity: Medium
- Location: `server/public/oauth-callback.js:18-19`
- Evidence:

```js
if (window.opener) {
    window.opener.postMessage(message, '*');
}
```

- Impact: The OAuth callback popup sends its result to any opener origin. If the popup is opened from an unexpected or attacker-controlled origin, that origin can receive callback status/error messages. The current payload is small, but wildcard target origins are an unsafe default for auth-related cross-window messaging and make future regressions easier.
- Fix: Send messages only to an explicit trusted frontend origin and require the receiving window to validate `event.origin` and message shape.
- Mitigation: If the callback page is only ever opened by the first-party frontend today, keep that invariant documented and monitored until the code is tightened.
- False positive notes: I did not find token material being posted here today, which keeps impact below critical; the issue is the unsafe messaging pattern on an auth flow.

## Positive Notes

- `server/config/security.js` applies Helmet, CSP, CORS restrictions, and CSRF protections.
- `client/src/services/authService.ts` explicitly avoids `localStorage` for auth state.
- Resume extraction upload helpers restrict document MIME types and file counts for the public extraction endpoints.

## Recommended Remediation Order

1. Fix backup restore input handling and replace shell-string execution.
2. Remove or redact request body logging in validation errors.
3. Lock down OAuth popup messaging to a trusted origin.

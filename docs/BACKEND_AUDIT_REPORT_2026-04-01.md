# Backend Audit Report

Date: 2026-04-01
Repository: `ResumeConverter`
Scope: backend routes, access control, multi-firm isolation, validation, admin surfaces, worker robustness

## Executive Summary

This audit focused on backend security and consistency invariants across the application, with an emphasis on:

- firm-level isolation
- admin-only transverse access
- route validation and pagination hardening
- worker/job lifecycle correctness
- OAuth and callback integrity
- prompt, template, and comment governance surfaces

The main high-severity issues identified during the audit were:

- cross-firm access and mutation paths on multiple business entities
- missing ownership checks on resume-linked resources
- admin/transverse views not consistently enforced
- routes shadowed by generic `/:id` patterns
- invalid pagination and numeric parameters causing avoidable `500`
- background workers able to duplicate or overwrite job state

These issues were corrected during the audit.

## Areas Reviewed And Corrected

The following backend areas were reviewed and, where needed, corrected:

- settings and prompt versioning
- resume submissions
- adaptations
- mail draft flow
- email templates administration
- users and admin user management
- clients and contacts
- deals
- missions
- pipeline and interviews
- calendar OAuth and event routes
- shared resume exports
- backup routes
- tags
- consent workflows
- resume versions
- batch jobs and batch worker lifecycle
- firms
- LLM proxy routes
- Ollama admin discovery
- GDPR audit routes
- admin routes
- Rome routes and related encoding cleanup
- resume comments
- chatbot
- market radar
- GDPR mail test route
- batch export
- generic templates CRUD and extraction
- auth register and Google register flows
- docs and Swagger fallback routes
- resumes list, stats, upload, and version history
- health checks
- 2FA and password reset encoding cleanup

## Key Fixes Implemented

### Multi-firm isolation

- Added ownership checks on resume, mission, deal, client, contact, pipeline, consent, comment, submission, template, and batch job flows.
- Closed cross-firm reference injection paths where an existing UUID was previously enough to bind foreign data to the current tenant.
- Standardized the rule that non-admin users without a firm should not access protected business data.
- Closed remaining cross-firm export and template retrieval paths on batch export and template lookup by UUID.

### Admin policy alignment

- Restricted transverse or system-level surfaces to admins where required.
- Aligned email template administration with an admin-only model.
- Preserved admin transverse read capability where that policy was intended.
- Limited Ollama model discovery to the configured admin URL instead of allowing arbitrary target probing from the client.

### Route correctness and validation

- Reordered shadowed routes so fixed paths are reachable before generic `/:id`.
- Added validation for UUID params where malformed identifiers previously produced `500`.
- Hardened pagination and numeric query parameters across reviewed routes.
- Normalized several routes to return `400` for invalid input instead of leaking internal failures.
- Tightened version-history pagination, firm listing pagination, batch job listing pagination, and remaining admin list/query limits.

### Worker and async robustness

- Changed batch job pickup to atomic claiming using SQL row locking.
- Prevented cancelled jobs from being overwritten to `completed` or `failed` at the end of worker execution.
- Improved state consistency for collection-style background jobs.

### OAuth and callback integrity

- Signed and validated calendar OAuth state instead of trusting forgeable client state.
- Preserved server-side GDPR mail OAuth state handling and tightened exposed error behavior where needed.
- Blocked orphan account creation through public register and Google registration paths when no firm assignment exists.

### Error sanitization and runtime hardening

- Removed multiple remaining raw provider and infrastructure error leaks from LLM proxying, consent flows, batch jobs, template/mail routes, backup flows, extraction handlers, and related admin endpoints.
- Reworked the public health surface so provider deep checks are admin-only and the default public endpoint does not probe internal services.
- Replaced runtime CDN loading of `pdf.js` during template extraction with the locally installed `pdfjs-dist` bundle.

### Encoding and source hygiene

- Cleaned the `rome` backend surface to proper UTF-8 content.
- Removed lingering mojibake from route and service sources touched in the audit.
- Cleaned additional mojibake on 2FA, password reset, batch job handlers, and related admin/user-facing responses.

## Validation Performed

The work was validated incrementally with targeted route and service tests after each correction set, plus repeated type-checking:

- `npm test -- --run ...` on the affected route and service suites
- `npm run typecheck`

Targeted suites updated during the audit included, among others:

- `resumeSubmissions`
- `adaptations`
- `mail`
- `emailTemplates`
- `users`
- `clients`
- `deals`
- `missions`
- `pipeline`
- `calendar`
- `share`
- `backup`
- `tags`
- `consent`
- `versions`
- `batchJobs`
- `gdprAudit`
- `admin`
- `rome`
- `resumeComments`
- `chatbot`
- `marketRadar`
- `gdprMail`
- `llm`
- `settings`
- `templates`
- `batchExport`
- `auth.signin`
- `auth.google`
- `auth.passwordReset`
- `docs`
- `health`
- `firms`
- `resumes.crud`
- `resumes.stats`
- `resumes.upload`

## Residual Risks

No remaining `P1` or clear `P2` issue was left identified in the reviewed backend surfaces at the end of this pass.

Residual lower-risk items remain possible in three categories:

### Contract consistency

- Some historical admin endpoints still differ in payload shape from newer paginated endpoints.
- A final frontend pass should confirm all updated response shapes and new `403`/`400` behaviors are handled cleanly.

### Integration coverage

- The application would benefit from broader end-to-end multi-firm tests to guard against future regressions.
- The highest-value additions would cover resume-linked subresources, admin transverse views, and batch processing paths.

### Unreviewed or lightly reviewed code

- Some secondary or helper services were only reviewed indirectly through their route surfaces.
- A future pass could focus on deeper worker internals, provider adapters, and non-critical admin utilities.
- Operational configuration review remains separate from code review: secrets rotation, CSP headers in deployment, reverse proxy limits, and infrastructure-level egress controls should still be validated in the target environments.

## Recommended Next Steps

1. Add integration tests for tenant isolation across core business flows.
2. Add a lightweight checklist or lint rule for route ordering, UUID validation, and pagination guards.
3. Review remaining front-end consumers for updated backend contracts.
4. Treat future admin or global routes as `admin-only` by default unless explicitly justified otherwise.
5. Add a small shared helper layer for sanitized route errors and pagination parsing to reduce future drift.

## Outcome

The backend is materially stronger than at the start of the audit:

- access control is more coherent
- multi-firm isolation is significantly tighter
- invalid input fails earlier and more predictably
- async job handling is more robust
- admin surfaces better match the intended security model
- provider-facing and extraction-related runtime behavior is less permissive and less leaky

This report reflects the state after the corrections made during the audit session.

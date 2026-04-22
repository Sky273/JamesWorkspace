# Document Processing Limits

This note summarizes the effective limits currently enforced by the application for expensive document-processing paths, and highlights the main remaining gaps.

## Scope

- Resume text extraction: `POST /api/resumes/extract-doc`, `POST /api/resumes/extract-pdf`
- Batch import: `POST /api/batch-jobs`
- Batch export: `POST /api/batch-export`
- Document generation proxy: `POST /generate-pdf`, `POST /generate-docx`
- Firm logo upload: `POST /api/firms/:id/logo`
- Stored document/blob retention: resume binaries, batch item blobs, shared PDFs, firm logos

## Current Limits

### Global HTTP Request Limits

- JSON and URL-encoded request bodies are limited to `50mb`.
  - Source: `server/proxy-server.js`
- Server request timeout defaults to `70 minutes`, but idle keep-alive timeout now defaults to `75 seconds` and headers timeout to `80 seconds`.
  - Overrides: `SERVER_REQUEST_TIMEOUT_MS`, `SERVER_KEEPALIVE_TIMEOUT_MS`, `SERVER_HEADERS_TIMEOUT_MS`
  - Source: `server/config/lifecycle.js`
- Global API rate limit is `1000` requests per `15 minutes` per IP.
  - Source: `server/config/constants.js`
  - Source: `server/middleware/rateLimit.middleware.js`
- Auth rate limit is `20` attempts per `15 minutes`.
  - Source: `server/config/constants.js`
  - Source: `server/middleware/rateLimit.middleware.js`
- Generic authenticated per-user rate limit is `50` requests per `15 minutes`, with admin multiplier `x3`.
  - Source: `server/config/constants.js`
  - Source: `server/middleware/rateLimit.middleware.js`

### Resume Extraction Uploads

- File upload size limit is `50 MB` per file.
  - Source: `server/config/constants.js`
  - Source: `server/routes/resumes/upload/helpers.js`
- Only one file is accepted per extraction request.
  - Source: `server/routes/resumes/upload/helpers.js`
- Upload rate limit is `50` uploads per `15 minutes` per IP.
  - Source: `server/middleware/rateLimit.middleware.js`
  - Applied in `server/routes/resumes/upload.routes.js`
- PDF extraction concurrency is limited to `2` simultaneous extractions per authenticated user by default.
  - Override: `PDF_EXTRACTION_MAX_CONCURRENCY`
  - Source: `server/routes/resumes/upload/helpers.js`

### PDF OCR and Extraction Limits

- Maximum PDF page count: `50`.
  - Source: `server/routes/resumes/upload/helpers.js`
  - Enforced in `server/services/pdfTextExtraction.service.js`
- Maximum scanned pages sent to OCR: `10`.
  - Source: `server/routes/resumes/upload/helpers.js`
  - Enforced in `server/services/pdfTextExtraction.service.js`
- Maximum render pixel budget per page: `20,000,000`.
  - Source: `server/routes/resumes/upload/helpers.js`
  - Used in `server/services/pdfTextExtraction.service.js`
- Maximum OCR variants explored per page: `18`.
  - Source: `server/services/pdfTextExtraction.service.js`
- Maximum OCR time budget per page: `20,000 ms`.
  - Source: `server/services/pdfTextExtraction.service.js`
- Maximum embedded images explored per page: `4`.
  - Source: `server/services/pdfTextExtraction.service.js`

### Word Extraction Limits

- Native extraction is attempted first for `docx` and `doc`.
- OCR fallback converts Word to PDF through `soffice` and then applies the PDF extraction limits above.
  - Source: `server/services/wordTextExtraction.service.js`

### Batch Import Limits

- Maximum files per request: `200`.
  - Source: `server/routes/batchJobs/helpers.js`
- Maximum file size per uploaded file: `50 MB`.
  - Source: `server/routes/batchJobs/helpers.js`
- Maximum total upload size per batch import request: `250 MB`.
  - Source: `server/routes/batchJobs/createHandlers.js`
- Uploads are staged on disk under the configured upload directory instead of `memoryStorage()`.
  - Source: `server/routes/batchJobs/helpers.js`
- Accepted file types are PDF, DOC, and DOCX, with extension/MIME consistency checks.
  - Source: `server/routes/batchJobs/helpers.js`
  - Source: `server/utils/uploadFileTypes.js`
- File signature validation is enforced before the job is created.
  - Source: `server/routes/batchJobs/createHandlers.js`
  - Source: `server/utils/fileSignature.js`
- Database staging reads uploaded files in bounded batches with a target cap of `64 MB` resident payload per insert batch.
  - Source: `server/services/batchJobs/itemCrud.js`

### Batch Export Limits

- Maximum resumes per synchronous export request: `100`.
  - Source: `server/utils/validation.js`
  - Source: `server/routes/batchExport.routes.js`
- Each generated document call uses a `60 second` timeout.
  - Source: `server/routes/batchExport.routes.js`
- PDF server health check timeout is `5 seconds`.
  - Source: `server/routes/batchExport.routes.js`
- Processing is sequential per resume to avoid flooding the PDF server.
  - Source: `server/routes/batchExport.routes.js`
- Export format is limited to `pdf` or `docx`.
  - Source: `server/utils/validation.js`

### PDF/DOCX Proxy Limits

- Proxy endpoints are protected by authenticated per-user rate limit of `20` requests per `15 minutes`.
  - Source: `server/config/routeRegistry/proxyRoutes.js`
- Input HTML, filename, header/footer and stylesheet are validated and sanitized.
  - Source: `server/utils/validation.js`
- Upstream PDF/DOCX generation calls are bounded by an explicit timeout of `60 seconds` by default.
  - Override: `PDF_PROXY_TIMEOUT_MS`
  - Source: `server/config/routeRegistry/proxyRoutes.js`

### Firm Logo Limits

- Logo upload size limit is `2 MB`.
  - Source: `server/routes/firms.routes.js`
- Accepted logo formats are JPEG, PNG, GIF and WebP.
  - Source: `server/routes/firms.routes.js`
- File signature validation is enforced before persistence.
  - Source: `server/routes/firms.routes.js`
  - Source: `server/utils/fileSignature.js`

### Blob Retention and Purge

- `resumes.resume_file_data` is retained with the resume record until the resume is deleted.
  - GDPR flows set `retention_until` and the scheduler purges resumes with refused or expired consent at startup and every `24 hours`.
  - Accepted consent currently maps to a `730 day` retention window.
  - Sources: `server/services/consent/operations.js`, `server/services/consent/scheduler.js`, `server/services/scheduler.service.js`
- `batch_job_items.file_data` is cleared once an item reaches `success`, `error`, or `skipped`, and old finished jobs are deleted after `7 days`.
  - Source: `server/services/batchJobs/maintenance.js`
  - Source: `server/utils/fileCleanup.js`
- Shared PDF and original-file links expire after `7 days`.
  - Expired share tokens are now cleared from the database during periodic cleanup, and expired shared PDF files are deleted at the same time.
  - The shared PDF directory TTL is aligned to `7 days` as a fallback orphan-file cleanup.
  - Source: `server/services/shareResume.service.js`
  - Source: `server/utils/fileCleanup.js`
- `firms.logo_data` is retained indefinitely until the logo is replaced or deleted.
  - Source: `server/services/firms.service.js`

## Main Gaps and Risks

### 1. Batch Import Request Size Is Still High

`POST /api/batch-jobs` no longer buffers the full request in memory and now rejects requests above `250 MB` total staged upload size, but it still accepts up to `200` files at `50 MB` each within that envelope.

That means the route is now much safer for Node heap usage, but a single request can still create very large disk staging volume and prolonged database ingestion time.

Impact:

- Large temporary disk usage
- Long ingestion windows before worker processing
- Higher I/O pressure under parallel imports

Recommended next step:

- Reduce per-request file count and/or per-file size
- Consider inserting directly from streaming or chunked file reads into object storage instead of large DB blobs

### 2. Long-Lived Resume and Logo Blobs

Resume binaries and firm logos remain in PostgreSQL until an explicit delete or GDPR purge occurs. That is intentional for product behavior, but it means storage growth is largely policy-driven rather than automatically bounded for non-expired active records.

Impact:

- Database growth tracks retained uploads directly
- Backups and restores include full binary payloads
- Storage pressure can accumulate even when hot access is low

Recommended next step:

- Decide whether non-GDPR resume binaries should be offloaded to object storage
- Define whether firms need a logo retention/size review beyond simple replace/delete

### 3. Very Long Server-Level HTTP Timeouts

The server still allows a long request timeout by default for known long-running jobs, but idle connection timeouts are now much shorter.

Impact:

- Long-running requests can still monopolize workers if an endpoint lacks a route-level timeout
- The remaining exposure is now mostly request execution time, not idle keep-alive socket retention

Recommended next step:

- Revisit whether the global request timeout still needs to stay at `70 minutes`
- Prefer route-level execution timeouts for all document-heavy endpoints

## Operational Notes

- OCR limits are relatively well constrained compared to the rest of the document stack.
- Signature validation now blocks simple file disguise attacks before deeper processing.
- The strongest remaining problem is not content validation but resource consumption under large or repeated inputs.

## Recommended Priority Order

1. Re-evaluate whether `70 minute` server timeouts are necessary for all workloads.
2. Decide whether long-lived resume binaries should remain in PostgreSQL or move to object storage with explicit retention policy.

# OCR Pipeline

## Current structure

The PDF OCR pipeline is split into focused modules:

- `services/pdfTextExtraction.service.js`
  - document-level orchestration
  - native PDF text extraction
  - fallback to page OCR when needed
- `services/pdfOcrHeuristics.service.js`
  - scanned page detection
  - OCR candidate scoring
  - block sequence text assembly
- `services/pdfOcrRuntime.service.js`
  - runtime diagnostics for `tesseract`, `pdftoppm`, `pdfimages`, Python, and advanced OCR backends
- `services/pdfOcrIo.service.js`
  - Python script execution
  - temporary file operations
  - `pdfimages`, `pdftoppm`, Tesseract CLI, and advanced OCR calls
- `services/pdfOcrPageOrchestrator.service.js`
  - page-level candidate exploration
  - best-variant selection
  - block-sequence recognition flow

## Execution order

1. Read native PDF text with `pdfjs`.
2. Detect scanned pages with OCR heuristics.
3. For scanned pages, prefer CLI OCR when `tesseract` and `pdftoppm` are available.
4. Render page variants and score OCR candidates.
5. Explore embedded images when the page result remains weak.
6. Use advanced OCR only when candidate quality stays below the configured threshold.
7. Aggregate page results into a document-level extraction result.

## Default backend policy

- `OCR_ADVANCED_BACKEND` defaults to `paddleocr`.
- If the Python runtime or the advanced backend is unavailable, the pipeline degrades to CLI OCR when available.
- If CLI OCR is unavailable too, the service can still fall back to `tesseract.js`.

## Testing strategy

The OCR stack is covered at multiple levels:

- `server/tests/services/pdfOcrHeuristics.service.test.js`
- `server/tests/services/pdfOcrRuntime.service.test.js`
- `server/tests/services/pdfOcrIo.service.test.js`
- `server/tests/services/pdfOcrPageOrchestrator.service.test.js`
- `server/tests/services/batchJobsWorker.textExtraction.test.js`

## Remaining rule

Keep new OCR behavior inside the extracted modules first. `pdfTextExtraction.service.js` should stay a document-level wrapper, not become a new monolith.

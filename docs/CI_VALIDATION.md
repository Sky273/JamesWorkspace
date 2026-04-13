# CI Validation

## Goal

The CI pipeline validates the cache/refresh contract in a fixed order so failures stay easy to localize:

1. typecheck
2. backend Vitest
3. client Vitest
4. PDF Vitest
5. Playwright end-to-end

## Commands

- Core validation: `npm run validate:core`
- E2E validation: `npm run validate:e2e`
- Full CI-equivalent validation: `npm run validate:ci`

These commands are orchestrated by [C:\Users\mail\CascadeProjects\ResumeConverter\scripts\run-validation-suite.mjs](C:\Users\mail\CascadeProjects\ResumeConverter\scripts\run-validation-suite.mjs).

Each run writes a JSON summary under `test-results/`:

- `validation-summary-core.json`
- `validation-summary-e2e.json`
- `validation-summary-all.json`

## GitHub Actions

The workflow is defined in [C:\Users\mail\CascadeProjects\ResumeConverter\.github\workflows\ci.yml](C:\Users\mail\CascadeProjects\ResumeConverter\.github\workflows\ci.yml).

It runs in two jobs:

- `validate-core`
- `validate-e2e`

Both jobs provision PostgreSQL. The e2e job also installs Playwright browsers and uploads:

- `playwright-report/`
- `test-results/`
- `tmp-playwright-webserver*.log`

## Cache/refresh relevance

The validation order is intentional:

- unit/integration tests catch invalidation and `refresh=1` regressions cheaply
- e2e catches stale-view regressions after create/update/delete

If Playwright fails while core validation is green, treat it as a view-refresh/UI-contract issue first, not a backend cache issue by default.

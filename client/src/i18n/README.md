# i18n structure

The frontend translations are now split by language and logical domain.

## Layout

- `client/src/i18n/index.ts`
  - bootstraps `i18next`
  - loads one language bundle at a time
- `client/src/i18n/locales/fr/`
- `client/src/i18n/locales/en/`

Each JSON file groups one top-level namespace, for example:

- `common.json`
- `settings.json`
- `metrics.json`
- `profileMatching.json`
- `crm.json`

Each language folder also contains an `index.ts` file that merges these domain files into the bundle expected by `i18next`.

## Rules

1. Keep existing translation keys stable.
2. Add new strings in the domain that matches the feature, not in a catch-all file.
3. Put shared UI text in `common.json`, cross-cutting errors in `errors.json`, and feature text in the matching domain file.
4. Keep French and English structures aligned.
5. Save all locale files as UTF-8.

## Workflow

1. Identify the existing namespace used by `t('...')`.
2. Edit the matching file in `locales/fr/` and `locales/en/`.
3. Avoid component-level fallback text when the string belongs in translations.
4. Run:

```bash
npx tsc --noEmit -p client/tsconfig.json
npm run test:client
```

## Migration note

The previous monolithic `fr.json` and `en.json` files were intentionally removed. New translation work should only target the split domain files.

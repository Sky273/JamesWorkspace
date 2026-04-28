import { describe, expect, it } from 'vitest';

import { normalizeFirmLogoUrl } from './logoUrl';

describe('normalizeFirmLogoUrl', () => {
  it('maps legacy bare UUID logo values to the firm logo API endpoint', () => {
    expect(normalizeFirmLogoUrl('2bb9e8df-b051-4cfd-8770-29425c602ced')).toBe(
      '/api/firms/2bb9e8df-b051-4cfd-8770-29425c602ced/logo/image',
    );
  });

  it('maps legacy root UUID logo values to the firm logo API endpoint', () => {
    expect(normalizeFirmLogoUrl('/2bb9e8df-b051-4cfd-8770-29425c602ced')).toBe(
      '/api/firms/2bb9e8df-b051-4cfd-8770-29425c602ced/logo/image',
    );
  });

  it('keeps already valid logo URLs unchanged', () => {
    expect(normalizeFirmLogoUrl('/api/firms/f1/logo/image')).toBe('/api/firms/f1/logo/image');
    expect(normalizeFirmLogoUrl('https://cdn.example.test/logo.png')).toBe('https://cdn.example.test/logo.png');
    expect(normalizeFirmLogoUrl('data:image/png;base64,AAA')).toBe('data:image/png;base64,AAA');
  });

  it('drops non URL bare values so the browser does not hit the SPA fallback', () => {
    expect(normalizeFirmLogoUrl('logo.png')).toBe('');
    expect(normalizeFirmLogoUrl('aptea-logo')).toBe('');
  });
});

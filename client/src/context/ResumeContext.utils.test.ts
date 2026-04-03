import { describe, expect, it } from 'vitest';
import { deriveUploadProcessingStep } from './ResumeContext.utils';

describe('deriveUploadProcessingStep', () => {
  it('returns preanalyze while the item is at progress 50', () => {
    expect(
      deriveUploadProcessingStep({
        status: 'processing',
        items: [{ progress: 50, status: 'processing' }],
      })
    ).toBe('preanalyze');
  });

  it('returns analyze when the item enters progress 60', () => {
    expect(
      deriveUploadProcessingStep({
        status: 'processing',
        items: [{ progress: 60, status: 'processing' }],
      })
    ).toBe('analyze');
  });
});

import { describe, expect, it } from 'vitest';

import { parsePreviewImprovements } from './resumePreview.helpers';

describe('ResumePreviewPanel helpers', () => {
  it('flattens structured key improvements instead of rendering raw JSON', () => {
    const improvements = parsePreviewImprovements(JSON.stringify({
      executiveSummary: ['Synthese plus claire'],
      skills: ['Competences regroupees'],
      atsOptimization: ['Mots-cles ATS renforces'],
    }));

    expect(improvements).toEqual([
      'Synthese plus claire',
      'Competences regroupees',
      'Mots-cles ATS renforces',
    ]);
    expect(improvements.join(' ')).not.toContain('executiveSummary');
  });
});

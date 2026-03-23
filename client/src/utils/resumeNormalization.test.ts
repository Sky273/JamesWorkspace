import { describe, it, expect } from 'vitest';
import { normalizeResume } from './resumeNormalization';

describe('resumeNormalization', () => {
  it('maps legacy and camelCase resume fields to a unified shape', () => {
    const normalized = normalizeResume({
      id: 'r1',
      'Name': 'Jane Doe',
      'Title': 'QA Lead',
      'File Name': 'jane.pdf',
      'Original Text': 'original',
      'Improved Text': 'improved',
      'Current Version': 3,
    });

    expect(normalized.name).toBe('Jane Doe');
    expect(normalized.Name).toBe('Jane Doe');
    expect(normalized.title).toBe('QA Lead');
    expect(normalized.fileName).toBe('jane.pdf');
    expect(normalized.originalText).toBe('original');
    expect(normalized.improvedText).toBe('improved');
    expect(normalized.currentVersion).toBe(3);
  });

  it('fills legacy keys from camelCase fields returned by the API', () => {
    const normalized = normalizeResume({
      id: 'r2',
      name: 'John Doe',
      title: 'Developer',
      fileName: 'john.docx',
      originalText: 'raw',
      improvedText: 'better',
      candidate_name: 'John Doe',
    });

    expect(normalized['Name']).toBe('John Doe');
    expect(normalized['Title']).toBe('Developer');
    expect(normalized['File Name']).toBe('john.docx');
    expect(normalized['Original Text']).toBe('raw');
    expect(normalized['Improved Text']).toBe('better');
  });
});

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

  it('infers improved status and normalizes numeric scores from API aliases', () => {
    const normalized = normalizeResume({
      id: 'r3',
      name: 'Dorra Sehli',
      status: 'analyzed',
      global_rating: '72',
      improved_global_rating: '81',
      improved_text: '<h2>Sommaire</h2>',
    });

    expect(normalized.Status).toBe('improved');
    expect(normalized.status).toBe('improved');
    expect(normalized['Global Rating']).toBe(72);
    expect(normalized['Improved Global Rating']).toBe(81);
  });
});

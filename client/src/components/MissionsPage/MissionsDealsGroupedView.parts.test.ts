import { describe, expect, it } from 'vitest';

import {
  normalizeMissionKeywords,
  normalizeMissionKeywordsText,
} from './MissionsDealsGroupedView.parts';

describe('normalizeMissionKeywords', () => {
  it('supports plain CSV keyword strings', () => {
    expect(normalizeMissionKeywords('react, node ; typescript')).toEqual([
      'react',
      'node',
      'typescript',
    ]);
  });

  it('supports array keyword payloads', () => {
    expect(normalizeMissionKeywords(['react', 'node', null, ''])).toEqual([
      'react',
      'node',
    ]);
  });

  it('supports object keyword payloads', () => {
    expect(normalizeMissionKeywords({
      skills: ['react', 'typescript'],
      tools: ['figma'],
    })).toEqual([
      'react',
      'typescript',
      'figma',
    ]);
  });

  it('supports serialized JSON keyword payloads', () => {
    expect(normalizeMissionKeywords('{"skills":["react"],"tools":["node"]}')).toEqual([
      'react',
      'node',
    ]);
  });

  it('builds a searchable lowercase text snapshot', () => {
    expect(normalizeMissionKeywordsText({ skills: ['React'], tools: ['Node'] })).toBe('react node');
  });
});

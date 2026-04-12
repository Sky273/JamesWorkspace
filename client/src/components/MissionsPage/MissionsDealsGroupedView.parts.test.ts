import { describe, expect, it } from 'vitest';

import {
  canDeleteGroupedMission,
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

  it('blocks delete when grouped missions still have linked elements', () => {
    expect(canDeleteGroupedMission({
      id: 'm1',
      title: 'Mission',
      status: 'active',
      created_at: '2026-01-01',
      adaptations_count: 0,
      submissions_count: 0,
      pipeline_count: 0,
      has_attached_elements: false,
    })).toBe(true);

    expect(canDeleteGroupedMission({
      id: 'm2',
      title: 'Mission',
      status: 'active',
      created_at: '2026-01-01',
      adaptations_count: 0,
      submissions_count: 1,
      pipeline_count: 0,
      has_attached_elements: true,
    })).toBe(false);
  });
});

import { describe, expect, it } from 'vitest';

import {
  buildMissionFormData,
  buildMissionsSearchParams,
  buildMissionSubmitPayload,
  canDeleteMission,
  computeMissionStats,
  EMPTY_MISSION_FORM,
  getInitialMissionViewMode,
  mergePreservedMissionIntoResults,
} from './MissionsPage.data';

describe('MissionsPage.data', () => {
  it('provides a stable empty form and initial view mode', () => {
    expect(EMPTY_MISSION_FORM).toEqual({
      Title: '',
      Content: '',
      Status: 'Active',
      'Client ID': '',
      'Contact ID': '',
      'Firm ID': '',
      'Deal ID': '',
    });
    expect(getInitialMissionViewMode('list')).toBe('list');
    expect(getInitialMissionViewMode('byDeal')).toBe('byDeal');
    expect(getInitialMissionViewMode('anything')).toBe('list');
    expect(getInitialMissionViewMode()).toBe('list');
  });

  it('builds mission form data and submit payload', () => {
    const form = buildMissionFormData({
      id: 'm1',
      Title: 'Product Manager',
      Content: '<p>test</p>',
      Status: 'Draft',
      'Client ID': 'client-1',
      'Contact ID': 'contact-1',
      'Firm ID': 'firm-1',
      'Deal ID': 'deal-1',
    });
    expect(form.Title).toBe('Product Manager');

    expect(buildMissionSubmitPayload(form)).toEqual({
      Title: 'Product Manager',
      Content: '<p>test</p>',
      Status: 'Draft',
      'Client ID': 'client-1',
      'Contact ID': 'contact-1',
      'Deal ID': 'deal-1',
      firm_id: 'firm-1',
    });
  });

  it('builds search params and computes mission stats', () => {
    expect(buildMissionsSearchParams(3, 12, 'infra').toString()).toBe('page=3&limit=12&search=infra');
    expect(
      computeMissionStats(
        [
          { Firm: 'Acme', Status: 'Active', 'Deal ID': 'd1' },
          { Firm: 'Acme', Status: 'Draft' },
          { Firm: 'Globex', Status: 'Closed' },
        ] as never[],
        24
      )
    ).toEqual({
      total: 24,
      firms: 2,
      linkedDeals: 1,
      active: 1,
      draft: 1,
      closed: 1,
    });
  });

  it('computes deletability and preserves created or updated missions in the current page', () => {
    expect(canDeleteMission({
      id: 'm1',
      'Adaptations Count': 0,
      'Submissions Count': 0,
      'Pipeline Count': 0,
      'Has Attachments': false,
    })).toBe(true);

    expect(canDeleteMission({
      id: 'm2',
      'Adaptations Count': 1,
    })).toBe(false);

    expect(mergePreservedMissionIntoResults(
      [{ id: 'm1', Title: 'Existing' }],
      { id: 'm2', Title: 'Created' },
      12,
    )).toEqual([
      { id: 'm2', Title: 'Created' },
      { id: 'm1', Title: 'Existing' },
    ]);
  });
});

import { describe, expect, it } from 'vitest';

import {
  buildCrmTabSearchParams,
  computeClientsStats,
  getClientTypeFilter,
  getInitialCrmTab,
} from './ClientsPage.data';

describe('ClientsPage.data', () => {
  it('normalizes crm tab selection and client filters', () => {
    expect(getInitialCrmTab('deals')).toBe('deals');
    expect(getInitialCrmTab('unknown')).toBe('clients');
    expect(getClientTypeFilter('all')).toBe('');
    expect(getClientTypeFilter('prospect')).toBe('prospect');
  });

  it('computes CRM stats from the visible clients list', () => {
    expect(
      computeClientsStats([
        { id: '1', type: 'client', contacts_count: 2, submissions_count: 3 },
        { id: '2', type: 'prospect', contacts_count: 1, submissions_count: 0 },
      ] as never[])
    ).toEqual({
      totalClients: 1,
      totalProspects: 1,
      totalContacts: 3,
      totalSubmissions: 3,
    });
  });

  it('updates crm tab params while optionally clearing clientId', () => {
    const params = new URLSearchParams('tab=clients&clientId=123');
    expect(buildCrmTabSearchParams(params, 'deals').toString()).toBe('tab=deals&clientId=123');
    expect(buildCrmTabSearchParams(params, 'interviews', { removeClientId: true }).toString()).toBe('tab=interviews');
  });
});

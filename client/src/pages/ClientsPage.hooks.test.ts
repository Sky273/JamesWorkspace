import { describe, expect, it } from 'vitest';

import { mergePreservedClientIntoResults } from './ClientsPage.hooks';

describe('mergePreservedClientIntoResults', () => {
  it('keeps a newly created client visible when the refreshed page is stale', () => {
    const result = mergePreservedClientIntoResults({
      clients: [
        { id: 'client-2', name: 'Globex', type: 'client' },
      ],
      preservedClient: { id: 'client-1', name: 'New Client', type: 'client' },
      typeFilter: 'client',
      normalizedSearch: '',
    });

    expect(result).toEqual([
      { id: 'client-1', name: 'New Client', type: 'client' },
      { id: 'client-2', name: 'Globex', type: 'client' },
    ]);
  });

  it('keeps an updated client visible when the refreshed page is stale', () => {
    const result = mergePreservedClientIntoResults({
      clients: [
        { id: 'client-2', name: 'Globex', type: 'client' },
      ],
      preservedClient: { id: 'client-1', name: 'Renamed Client', type: 'client' },
      typeFilter: 'client',
      normalizedSearch: '',
    });

    expect(result).toEqual([
      { id: 'client-1', name: 'Renamed Client', type: 'client' },
      { id: 'client-2', name: 'Globex', type: 'client' },
    ]);
  });

  it('replaces a stale same-id client when the preserved client has fresher data', () => {
    const result = mergePreservedClientIntoResults({
      clients: [
        { id: 'client-1', name: 'Old Client Name', type: 'client' },
        { id: 'client-2', name: 'Globex', type: 'client' },
      ],
      preservedClient: { id: 'client-1', name: 'Renamed Client', type: 'client' },
      typeFilter: 'client',
      normalizedSearch: '',
    });

    expect(result).toEqual([
      { id: 'client-1', name: 'Renamed Client', type: 'client' },
      { id: 'client-2', name: 'Globex', type: 'client' },
    ]);
  });

  it('replaces a stale same-id client when the old name no longer matches the active search', () => {
    const result = mergePreservedClientIntoResults({
      clients: [
        { id: 'client-1', name: 'Old Client Name', type: 'client' },
      ],
      preservedClient: { id: 'client-1', name: 'Renamed Client', type: 'client' },
      typeFilter: 'client',
      normalizedSearch: 'renamed',
    });

    expect(result).toEqual([
      { id: 'client-1', name: 'Renamed Client', type: 'client' },
    ]);
  });

  it('does not preserve a client excluded by the active filter', () => {
    const result = mergePreservedClientIntoResults({
      clients: [
        { id: 'client-2', name: 'Globex', type: 'client' },
      ],
      preservedClient: { id: 'prospect-1', name: 'Prospect X', type: 'prospect' },
      typeFilter: 'client',
      normalizedSearch: '',
    });

    expect(result).toEqual([
      { id: 'client-2', name: 'Globex', type: 'client' },
    ]);
  });
});

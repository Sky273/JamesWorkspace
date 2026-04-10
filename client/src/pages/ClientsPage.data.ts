import type { Client } from '../types/entities';

export interface ClientsStats {
  totalClients: number;
  totalProspects: number;
  totalContacts: number;
  totalSubmissions: number;
}

export type CRMTab = 'clients' | 'deals' | 'interviews';
export type ClientFilter = 'all' | 'client' | 'prospect';

export function getInitialCrmTab(tabParam: string | null): CRMTab {
  return tabParam === 'deals' || tabParam === 'interviews' || tabParam === 'clients'
    ? tabParam
    : 'clients';
}

export function getClientTypeFilter(activeTab: ClientFilter) {
  return activeTab === 'all' ? '' : activeTab;
}

export function computeClientsStats(clients: Client[]): ClientsStats {
  return {
    totalClients: clients.filter((client) => client.type === 'client').length,
    totalProspects: clients.filter((client) => client.type === 'prospect').length,
    totalContacts: clients.reduce((sum, client) => sum + Number(client.contacts_count || 0), 0),
    totalSubmissions: clients.reduce((sum, client) => sum + Number(client.submissions_count || 0), 0),
  };
}

export function buildCrmTabSearchParams(
  searchParams: URLSearchParams,
  tab: CRMTab,
  options?: { removeClientId?: boolean }
) {
  const nextParams = new URLSearchParams(searchParams);
  nextParams.set('tab', tab);

  if (options?.removeClientId) {
    nextParams.delete('clientId');
  }

  return nextParams;
}

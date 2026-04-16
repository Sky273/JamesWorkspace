export function mergePreservedDealIntoResults<T extends { id: string; title?: string; client_id?: string; status?: string }>(
  deals: T[],
  preservedDeal: T | null,
  {
    normalizedSearch,
    clientFilter,
    statusFilter,
    pageSize,
  }: {
    normalizedSearch: string;
    clientFilter: string;
    statusFilter: string;
    pageSize: number;
  }
) {
  const shouldPreserve = preservedDeal != null
    && (statusFilter === 'all' || !statusFilter || preservedDeal.status === statusFilter)
    && (!clientFilter || preservedDeal.client_id === clientFilter)
    && (normalizedSearch.length === 0 || (preservedDeal.title || '').toLowerCase().includes(normalizedSearch))
    && !deals.some((deal) => deal.id === preservedDeal.id);

  return shouldPreserve
    ? [preservedDeal, ...deals].slice(0, pageSize)
    : deals;
}

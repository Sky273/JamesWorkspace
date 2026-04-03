import type { TFunction } from 'i18next';
import type { DataSourceType } from './franceMap.types';

export function formatFranceMapValue(
  dataSource: DataSourceType,
  value: number | string | undefined | null
): string {
  const numericValue = typeof value === 'string' ? parseFloat(value) : value || 0;
  if (Number.isNaN(numericValue)) {
    return '0';
  }

  if (dataSource === 'all' || dataSource === 'offres') {
    return numericValue > 999 ? `${Math.round(numericValue / 1000)}k` : Math.round(numericValue).toString();
  }

  if (dataSource === 'salaire') {
    return `${Math.round(numericValue / 1000)}kEUR`;
  }

  if (dataSource === 'tension') {
    return numericValue.toFixed(1);
  }

  return numericValue > 999 ? `${Math.round(numericValue / 1000)}k` : Math.round(numericValue).toString();
}

export function getFranceMapValueLabel(dataSource: DataSourceType): string {
  const labels: Record<DataSourceType, string> = {
    all: 'donnees',
    offres: 'offres',
    tension: 'indice',
    salaire: 'EUR',
    dynamique_emploi: 'indice',
    embauche: 'embauches',
    demandeur: 'demandeurs',
    demandeur_entrant: 'nouveaux',
  };

  return labels[dataSource];
}

export function buildFranceMapStatsCards(params: {
  currentRegionCount: number;
  dataSource: DataSourceType;
  t: TFunction;
  topRegionName?: string;
  totalValue: number;
  uniqueMetiersCount: number;
}): Array<{ color: string; label: string; value: string }> {
  const { currentRegionCount, dataSource, t, topRegionName, totalValue, uniqueMetiersCount } = params;

  const totalValueLabel =
    dataSource === 'offres'
      ? Number.isNaN(totalValue)
        ? '0'
        : totalValue.toLocaleString()
      : dataSource === 'salaire'
        ? `${Number.isNaN(totalValue) ? '0' : Math.round(totalValue).toLocaleString()} EUR`
        : ['embauche', 'demandeur', 'demandeur_entrant'].includes(dataSource)
          ? Number.isNaN(totalValue)
            ? '0'
            : Math.round(totalValue).toLocaleString()
          : Number.isNaN(totalValue)
            ? '0'
            : totalValue.toFixed(2);

  const totalLabel =
    dataSource === 'offres'
      ? t('marketRadar.map.totalOffers')
      : ['embauche', 'demandeur', 'demandeur_entrant'].includes(dataSource)
        ? `${t('marketRadar.map.total')} ${t(`marketRadar.dataTypes.${dataSource}`)}`
        : `${t('marketRadar.map.average')} ${t(`marketRadar.dataTypes.${dataSource}`)}`;

  return [
    { value: totalValueLabel, label: totalLabel, color: 'text-indigo-600 dark:text-indigo-400' },
    { value: String(currentRegionCount), label: t('marketRadar.map.regionsCovered'), color: 'text-blue-600 dark:text-blue-400' },
    { value: topRegionName || '-', label: t('marketRadar.map.topRegion'), color: 'text-green-600 dark:text-green-400' },
    { value: String(uniqueMetiersCount), label: t('marketRadar.map.itJobs'), color: 'text-purple-600 dark:text-purple-400' },
  ];
}

export function getFranceFreshnessLabels(status: 'fresh' | 'recent' | 'stale', t: TFunction): string {
  if (status === 'fresh') {
    return t('marketRadar.freshness.fresh', 'Donnees a jour');
  }

  if (status === 'recent') {
    return t('marketRadar.freshness.recent', 'Donnees recentes');
  }

  return t('marketRadar.freshness.stale', 'Donnees anciennes');
}

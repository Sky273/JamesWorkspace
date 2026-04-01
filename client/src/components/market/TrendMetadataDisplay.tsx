/**
 * TrendMetadataDisplay - Reusable component for displaying trend metadata
 * Used in both MarketTrendsTab (cards) and FranceMapTab (hover tooltips)
 */

import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { TrendMetadataCompactView } from './TrendMetadataCompactView';
import { TrendMetadataFullView } from './TrendMetadataFullView';
import { parseMetadata } from './trendMetadata.parser';
import type { TrendMetadataDisplayProps } from './trendMetadata.types';

export default function TrendMetadataDisplay({ metadata, type, value, compact = false, className = '' }: TrendMetadataDisplayProps) {
  const { t } = useTranslation();
  const parsed = useMemo(() => parseMetadata(metadata, type, value), [metadata, type, value]);

  if (!parsed) {
    return null;
  }

  const formatNumber = (val: number | undefined, valType?: 'nombre' | 'montant' | 'taux') => {
    if (val === undefined || val === null) return '—';
    if (valType === 'montant' || type === 'salaire') return `${val.toLocaleString('fr-FR')} €`;
    if (valType === 'taux' || type === 'tension') return val.toFixed(2);
    return val.toLocaleString('fr-FR');
  };

  if (compact) {
    return <TrendMetadataCompactView parsed={parsed} type={type} className={className} t={t} formatNumber={formatNumber} />;
  }

  return <TrendMetadataFullView parsed={parsed} type={type} className={className} t={t} formatNumber={formatNumber} />;
}

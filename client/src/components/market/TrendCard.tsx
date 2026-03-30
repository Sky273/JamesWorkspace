/**
 * TrendCard - Individual trend card with rich metadata display
 * Extracted from MarketTrendsTab.tsx
 */

import { MapPinIcon } from '@heroicons/react/24/outline';
import { useTranslation } from 'react-i18next';
import type { ParsedMetadata } from './marketTrends.types';
import type { MarketTrend } from '../../services/marketRadarService';
import { EmbaucheContent, DynamiqueContent, SalaireContent, TensionContent } from './TrendCardSections';
import { formatTrendNumber, getCharacteristicDisplayValue, getTrendValueColor } from './trendCard.helpers';

interface TrendCardProps {
  trend: MarketTrend;
  type: string;
  parsed: ParsedMetadata | null;
  romeLabel?: string;
}

export default function TrendCard({ trend, type, parsed, romeLabel }: TrendCardProps) {
  const { t } = useTranslation();

  const renderTypeSpecificContent = () => {
    if (!parsed) return null;
    switch (type) {
      case 'tension':
        return <TensionContent parsed={parsed} />;
      case 'salaire':
        return <SalaireContent parsed={parsed} />;
      case 'dynamique_emploi':
        return <DynamiqueContent parsed={parsed} />;
      case 'embauche':
      case 'offre':
      case 'demandeur':
      case 'demandeur_entrant':
        return <EmbaucheContent parsed={parsed} />;
      default:
        return null;
    }
  };

  return (
    <div className="p-4 bg-gray-50 dark:bg-gray-900/30 rounded-lg border border-gray-100 dark:border-gray-700 hover:border-indigo-200 dark:hover:border-indigo-800 transition-colors">
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1 min-w-0">
          {(romeLabel || trend.CodeRome) && (
            <div className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate" title={romeLabel || trend.CodeRome}>
              {romeLabel || trend.CodeRome}
            </div>
          )}
          {(trend.Region || parsed?.territoire) && (
            <div className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1 mt-0.5">
              <MapPinIcon className="h-3 w-3 flex-shrink-0" />
              <span className="truncate">{parsed?.territoire || trend.Region}</span>
            </div>
          )}
        </div>
        <span className="text-xs px-1.5 py-0.5 rounded bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400 ml-2 flex-shrink-0">
          {parsed?.codeIndicateur || type}
        </span>
      </div>

      <div className="mb-3">
        <div className={`text-2xl font-bold ${getTrendValueColor(type, parsed, trend.Value)}`}>
          {formatTrendNumber(parsed?.valeurPrincipale ?? trend.Value, type, parsed?.valeurPrincipaleType)}
        </div>
        {(trend.ValueLabel || parsed?.indicateur) && (
          <div className="text-xs text-indigo-600 dark:text-indigo-400 font-medium mt-0.5 line-clamp-2">
            {trend.ValueLabel || parsed?.indicateur}
          </div>
        )}
        {parsed?.valeurSecondaire !== undefined && (
          <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            {parsed.valeurSecondarieType === 'pourcentage'
              ? `${Number(parsed.valeurSecondaire).toFixed(1)}%`
              : formatTrendNumber(parsed.valeurSecondaire, type, parsed.valeurSecondarieType as 'nombre' | 'montant' | undefined)}
            {parsed.valeurSecondarieType === 'pourcentage' && ` ${t('marketRadar.details.totalShare')}`}
          </div>
        )}
      </div>

      {renderTypeSpecificContent()}

      {parsed?.activite && (
        <div className="text-xs text-gray-600 dark:text-gray-400 mt-2 line-clamp-2" title={parsed.activite}>
          {parsed.activite}
        </div>
      )}

      {parsed?.caracteristiques && parsed.caracteristiques.length > 0 && !['demandeur', 'demandeur_entrant', 'offre', 'embauche'].includes(trend.Type) && (
        <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
          <div className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-2">
            {parsed.nomenclature || t('marketRadar.details.breakdown')}
          </div>
          <div className="space-y-1.5 max-h-64 overflow-y-auto">
            {parsed.caracteristiques.map((c, i) => (
              <div key={i} className="flex items-center justify-between text-xs">
                <span className="text-gray-600 dark:text-gray-400 truncate flex-1 mr-2" title={c.label}>
                  {c.label}
                </span>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className="font-medium text-gray-900 dark:text-gray-100">
                    {getCharacteristicDisplayValue(c, type)}
                  </span>
                  {c.pourcentage !== undefined && (
                    <span className="text-gray-400 dark:text-gray-500 w-10 text-right">
                      {Number(c.pourcentage).toFixed(0)}%
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="mt-3 pt-2 border-t border-gray-100 dark:border-gray-700/50 flex items-center justify-between">
        <span className="text-xs text-gray-400 dark:text-gray-500">
          {parsed?.periode || trend.Date}
        </span>
      </div>
    </div>
  );
}

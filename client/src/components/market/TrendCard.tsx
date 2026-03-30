/**
 * TrendCard - Individual trend card with rich metadata display
 * Extracted from MarketTrendsTab.tsx
 */

import {
  ArrowTrendingUpIcon,
  ArrowTrendingDownIcon,
  ChartBarIcon,
  BriefcaseIcon,
  MapPinIcon
} from '@heroicons/react/24/outline';
import { useTranslation } from 'react-i18next';
import { formatDate } from '../../utils/dateFormatter';
import type { ParsedMetadata } from './marketTrends.types';
import type { MarketTrend } from '../../services/marketRadarService';

interface TrendCardProps {
  trend: MarketTrend;
  type: string;
  parsed: ParsedMetadata | null;
  romeLabel?: string;
}

export default function TrendCard({ trend, type, parsed, romeLabel }: TrendCardProps) {
  const { t } = useTranslation();
  // Format number based on type
  const formatNumber = (value: number | string | undefined, valueType?: 'nombre' | 'montant' | 'taux') => {
    if (value === undefined || value === null) return '—';
    // Convert to number if string
    const numValue = typeof value === 'string' ? parseFloat(value) : value;
    if (isNaN(numValue)) return '—';
    if (valueType === 'montant' || type === 'salaire') return `${numValue.toLocaleString('fr-FR')} €`;
    if (valueType === 'taux' || type === 'tension') return numValue.toFixed(2);
    return numValue.toLocaleString('fr-FR');
  };

  // Get color based on type and value
  const getValueColor = () => {
    const value = parsed?.valeurPrincipale ?? trend.Value;
    if (value === undefined || value === null) return 'text-gray-500';
    
    switch (type) {
      case 'tension':
        if (value >= 2) return 'text-red-600 dark:text-red-400';
        if (value >= 1.5) return 'text-orange-500 dark:text-orange-400';
        if (value >= 1) return 'text-yellow-600 dark:text-yellow-400';
        return 'text-green-600 dark:text-green-400';
      case 'dynamique_emploi':
        if (value > 0) return 'text-green-600 dark:text-green-400';
        if (value < 0) return 'text-red-600 dark:text-red-400';
        return 'text-gray-600 dark:text-gray-400';
      case 'salaire':
        return 'text-emerald-600 dark:text-emerald-400';
      case 'offre':
        return 'text-blue-600 dark:text-blue-400';
      case 'demandeur':
      case 'demandeur_entrant':
        return 'text-purple-600 dark:text-purple-400';
      case 'embauche':
        return 'text-teal-600 dark:text-teal-400';
      default:
        return 'text-indigo-600 dark:text-indigo-400';
    }
  };

  // Get characteristic value for display
  const getCharValue = (c: { nombre?: number; montant?: number; taux?: number; pourcentage?: number }) => {
    if (c.montant !== undefined) return formatNumber(c.montant, 'montant');
    if (c.nombre !== undefined) return formatNumber(c.nombre, 'nombre');
    if (c.taux !== undefined) return formatNumber(c.taux, 'taux');
    return '—';
  };

  // Render type-specific content
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
      {/* Header: Métier + Région */}
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
        {/* Type badge */}
        <span className="text-xs px-1.5 py-0.5 rounded bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400 ml-2 flex-shrink-0">
          {parsed?.codeIndicateur || type}
        </span>
      </div>

      {/* Main Value */}
      <div className="mb-3">
        <div className={`text-2xl font-bold ${getValueColor()}`}>
          {formatNumber(parsed?.valeurPrincipale ?? trend.Value, parsed?.valeurPrincipaleType)}
        </div>
        {/* ValueLabel from API or DB */}
        {(trend.ValueLabel || parsed?.indicateur) && (
          <div className="text-xs text-indigo-600 dark:text-indigo-400 font-medium mt-0.5 line-clamp-2">
            {trend.ValueLabel || parsed?.indicateur}
          </div>
        )}
        {/* Secondary value */}
        {parsed?.valeurSecondaire !== undefined && (
          <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            {parsed.valeurSecondarieType === 'pourcentage' 
              ? `${Number(parsed.valeurSecondaire).toFixed(1)}%`
              : formatNumber(parsed.valeurSecondaire, parsed.valeurSecondarieType as 'nombre' | 'montant' | undefined)
            }
            {parsed.valeurSecondarieType === 'pourcentage' && ` ${t('marketRadar.details.totalShare')}`}
          </div>
        )}
      </div>

      {/* Type-specific content */}
      {renderTypeSpecificContent()}

      {/* Activité */}
      {parsed?.activite && (
        <div className="text-xs text-gray-600 dark:text-gray-400 mt-2 line-clamp-2" title={parsed.activite}>
          {parsed.activite}
        </div>
      )}

      {/* Caractéristiques (breakdown) - hidden for types that have detailed display */}
      {parsed?.caracteristiques && parsed.caracteristiques.length > 0 && 
       !['demandeur', 'demandeur_entrant', 'offre', 'embauche'].includes(trend.Type) && (
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
                    {getCharValue(c)}
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

      {/* Footer: Période */}
      <div className="mt-3 pt-2 border-t border-gray-100 dark:border-gray-700/50 flex items-center justify-between">
        <span className="text-xs text-gray-400 dark:text-gray-500">
          {parsed?.periode || trend.Date}
        </span>
      </div>
    </div>
  );
}

// ============================================
// Type-specific sub-components
// ============================================

function TensionContent({ parsed }: { parsed: ParsedMetadata }) {
  const { t } = useTranslation();
  return (
    <div className="space-y-3">
      {/* Main tension level badge */}
      {parsed.typeSpecific?.tensionLevel && (
        <div className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
          parsed.typeSpecific.tensionColor === 'red' ? 'bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300' :
          parsed.typeSpecific.tensionColor === 'orange' ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/50 dark:text-orange-300' :
          parsed.typeSpecific.tensionColor === 'yellow' ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/50 dark:text-yellow-300' :
          parsed.typeSpecific.tensionColor === 'green' ? 'bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300' :
          'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300'
        }`}>
          {parsed.typeSpecific.tensionLevel}
        </div>
      )}
      
      {/* Detailed tension indicators */}
      {parsed.typeSpecific?.tensionIndicators && parsed.typeSpecific.tensionIndicators.length > 0 && (
        <div className="space-y-1.5">
          {parsed.typeSpecific.tensionIndicators
            .filter(ind => ind.code !== 'PERSPECTIVE') // Skip main indicator (already shown above)
            .map((indicator) => (
              <div key={indicator.code} className="flex items-center justify-between text-xs">
                <span className="text-gray-600 dark:text-gray-400 truncate mr-2" title={indicator.label}>
                  {indicator.label}
                </span>
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  {/* Value bar visualization */}
                  <div className="w-12 h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                    <div 
                      className={`h-full rounded-full ${
                        indicator.color === 'red' ? 'bg-red-500' :
                        indicator.color === 'orange' ? 'bg-orange-500' :
                        indicator.color === 'yellow' ? 'bg-yellow-500' :
                        indicator.color === 'green' ? 'bg-green-500' :
                        'bg-gray-400'
                      }`}
                      style={{ width: `${(indicator.value / 5) * 100}%` }}
                    />
                  </div>
                  <span className={`font-medium w-4 text-right ${
                    indicator.color === 'red' ? 'text-red-600 dark:text-red-400' :
                    indicator.color === 'orange' ? 'text-orange-600 dark:text-orange-400' :
                    indicator.color === 'yellow' ? 'text-yellow-600 dark:text-yellow-400' :
                    indicator.color === 'green' ? 'text-green-600 dark:text-green-400' :
                    'text-gray-600 dark:text-gray-400'
                  }`}>
                    {indicator.value}
                  </span>
                </div>
              </div>
            ))}
        </div>
      )}
      
      {parsed.indicateur && !parsed.typeSpecific?.tensionIndicators?.length && (
        <div className="text-xs text-gray-500 dark:text-gray-400">{parsed.indicateur}</div>
      )}
    </div>
  );
}

function SalaireContent({ parsed }: { parsed: ParsedMetadata }) {
  const { t } = useTranslation();
  return (
    <div className="space-y-3">
      {/* Summary stats */}
      {parsed.typeSpecific?.salaireMin !== undefined && parsed.typeSpecific?.salaireMax !== undefined && (
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
          <div>
            <span className="text-gray-500 dark:text-gray-400">{t('marketRadar.details.minimum')}: </span>
            <span className="font-medium text-gray-900 dark:text-gray-100">
              {parsed.typeSpecific.salaireMin.toLocaleString('fr-FR')} €
            </span>
          </div>
          <div>
            <span className="text-gray-500 dark:text-gray-400">{t('marketRadar.details.maximum')}: </span>
            <span className="font-medium text-gray-900 dark:text-gray-100">
              {parsed.typeSpecific.salaireMax.toLocaleString('fr-FR')} €
            </span>
          </div>
          {parsed.typeSpecific?.salaireMedian !== undefined && (
            <div>
              <span className="text-gray-500 dark:text-gray-400">{t('marketRadar.details.median')}: </span>
              <span className="font-medium text-emerald-600 dark:text-emerald-400">
                {parsed.typeSpecific.salaireMedian.toLocaleString('fr-FR')} €
              </span>
            </div>
          )}
        </div>
      )}
      
      {/* Detailed breakdown by activity */}
      {parsed.typeSpecific?.salairesParActivite && parsed.typeSpecific.salairesParActivite.length > 0 && (
        <div className="mt-2 space-y-2">
          <div className="text-xs font-medium text-gray-700 dark:text-gray-300">{t('marketRadar.details.byCategory')} :</div>
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {parsed.typeSpecific.salairesParActivite.map((activite, idx) => (
              <div key={idx} className="p-2 bg-white dark:bg-gray-800 rounded border border-gray-200 dark:border-gray-600">
                <div className="text-xs font-medium text-gray-800 dark:text-gray-200 mb-1 line-clamp-2" title={activite.libActivite}>
                  {activite.libActivite}
                </div>
                <div className="grid grid-cols-3 gap-1 text-xs">
                  {activite.salaireDebutant !== undefined && (
                    <div className="text-center">
                      <div className="text-gray-500 dark:text-gray-400">{t('marketRadar.details.beginner')}</div>
                      <div className="font-semibold text-blue-600 dark:text-blue-400">
                        {activite.salaireDebutant.toLocaleString('fr-FR')} €
                      </div>
                    </div>
                  )}
                  {activite.salaireMoyen !== undefined && (
                    <div className="text-center">
                      <div className="text-gray-500 dark:text-gray-400">{t('marketRadar.details.averageLevel')}</div>
                      <div className="font-semibold text-emerald-600 dark:text-emerald-400">
                        {activite.salaireMoyen.toLocaleString('fr-FR')} €
                      </div>
                    </div>
                  )}
                  {activite.salaireExperimente !== undefined && (
                    <div className="text-center">
                      <div className="text-gray-500 dark:text-gray-400">{t('marketRadar.details.experienced')}</div>
                      <div className="font-semibold text-purple-600 dark:text-purple-400">
                        {activite.salaireExperimente.toLocaleString('fr-FR')} €
                      </div>
                    </div>
                  )}
                </div>
                {activite.periode && (
                  <div className="text-xs text-gray-400 dark:text-gray-500 mt-1">{activite.periode}</div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function DynamiqueContent({ parsed }: { parsed: ParsedMetadata }) {
  const { t } = useTranslation();
  const dynDetails = parsed.typeSpecific?.dynamiqueDetails;
  return (
    <div className="space-y-3">
      {/* Tendance badge with icon */}
      {parsed.typeSpecific?.tendance && (
        <div className="flex items-center gap-2">
          <div className={`inline-flex items-center px-3 py-1.5 rounded-full text-sm font-medium ${
            parsed.typeSpecific.tendance === 'hausse' ? 'bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300' :
            parsed.typeSpecific.tendance === 'baisse' ? 'bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300' :
            'bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300'
          }`}>
            {parsed.typeSpecific.tendance === 'hausse' && <ArrowTrendingUpIcon className="h-4 w-4 mr-1" />}
            {parsed.typeSpecific.tendance === 'baisse' && <ArrowTrendingDownIcon className="h-4 w-4 mr-1" />}
            {parsed.typeSpecific.tendanceLabel || (
              parsed.typeSpecific.tendance === 'hausse' ? t('marketRadar.details.positiveDynamic') :
              parsed.typeSpecific.tendance === 'baisse' ? t('marketRadar.details.negativeDynamic') : t('marketRadar.details.stableDynamic')
            )}
          </div>
        </div>
      )}
      
      {/* Description */}
      {parsed.typeSpecific?.tendanceDescription && (
        <p className="text-xs text-gray-600 dark:text-gray-400">
          {parsed.typeSpecific.tendanceDescription}
        </p>
      )}
      
      {/* Detailed info from metadata */}
      {dynDetails && (
        <div className="space-y-2 pt-2 border-t border-gray-100 dark:border-gray-700">
          {/* Territoire */}
          {dynDetails.territoire && (
            <div className="flex items-center gap-2 text-xs">
              <MapPinIcon className="h-3.5 w-3.5 text-gray-400" />
              <span className="text-gray-600 dark:text-gray-400">{dynDetails.territoire}</span>
            </div>
          )}
          
          {/* Période */}
          {dynDetails.periode && (
            <div className="flex items-center gap-2 text-xs">
              <ChartBarIcon className="h-3.5 w-3.5 text-gray-400" />
              <span className="text-gray-600 dark:text-gray-400">{dynDetails.periode}</span>
              {dynDetails.codePeriode && (
                <span className="text-gray-400 dark:text-gray-500">({dynDetails.codePeriode})</span>
              )}
            </div>
          )}
          
          {/* Activité */}
          {dynDetails.activite && (
            <div className="flex items-center gap-2 text-xs">
              <BriefcaseIcon className="h-3.5 w-3.5 text-gray-400" />
              <span className="text-gray-600 dark:text-gray-400 truncate" title={dynDetails.activite}>
                {dynDetails.activite}
              </span>
            </div>
          )}
          
          {/* Date de mise à jour */}
          {(dynDetails.dateMaj || dynDetails.dateMajGlobale) && (
            <div className="text-xs text-gray-400 dark:text-gray-500 pt-1">
              {t('marketRadar.details.updatedAt')} : {formatDate(dynDetails.dateMaj || dynDetails.dateMajGlobale, 'long')}
            </div>
          )}
        </div>
      )}
      
      {/* Fallback: show indicator name if no details */}
      {!dynDetails && parsed.indicateur && (
        <div className="text-xs text-gray-500 dark:text-gray-400">{parsed.indicateur}</div>
      )}
    </div>
  );
}

function EmbaucheContent({ parsed }: { parsed: ParsedMetadata }) {
  const { t } = useTranslation();
  const details = parsed.typeSpecific?.embaucheDetails;
  return (
    <div className="space-y-3">
      {/* Evolution badge */}
      {parsed.typeSpecific?.evolutionPercent !== undefined && (
        <div className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
          parsed.typeSpecific.evolutionPercent > 0 ? 'bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300' :
          parsed.typeSpecific.evolutionPercent < 0 ? 'bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300' :
          'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300'
        }`}>
          {parsed.typeSpecific.evolutionPercent > 0 ? '+' : ''}{Number(parsed.typeSpecific.evolutionPercent).toFixed(1)}% {t('marketRadar.details.evolution')}
        </div>
      )}
      
      {/* Detailed breakdown */}
      {details && (
        <div className="space-y-2">
          {/* Genre breakdown */}
          {details.genre && (
            <div className="flex items-center gap-2 text-xs">
              <span className="text-gray-500 dark:text-gray-400 w-16">{t('marketRadar.details.genre')}:</span>
              <div className="flex-1 flex items-center gap-1">
                <div className="flex-1 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden flex">
                  <div className="h-full bg-blue-500" style={{ width: `${details.genre.hommes}%` }} />
                  <div className="h-full bg-pink-500" style={{ width: `${details.genre.femmes}%` }} />
                </div>
                <span className="text-blue-600 dark:text-blue-400 w-8 text-right">{details.genre.hommes}%</span>
                <span className="text-pink-600 dark:text-pink-400 w-8 text-right">{details.genre.femmes}%</span>
              </div>
            </div>
          )}
          
          {/* Contract type breakdown */}
          {details.contrats && (
            <div className="flex items-center gap-2 text-xs">
              <span className="text-gray-500 dark:text-gray-400 w-16">{t('marketRadar.details.contracts')}:</span>
              <div className="flex-1 flex items-center gap-1">
                <div className="flex-1 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden flex">
                  <div className="h-full bg-green-500" style={{ width: `${details.contrats.cdi}%` }} title={t('marketRadar.details.cdi')} />
                  <div className="h-full bg-yellow-500" style={{ width: `${details.contrats.cdd}%` }} title="CDD" />
                  <div className="h-full bg-gray-400" style={{ width: `${details.contrats.autres}%` }} title={t('marketRadar.details.other')} />
                </div>
                <span className="text-green-600 dark:text-green-400 text-[10px]">{t('marketRadar.details.cdi')} {details.contrats.cdi}%</span>
              </div>
            </div>
          )}
          
          {/* Qualification breakdown */}
          {details.qualification && (
            <div className="flex items-center gap-2 text-xs">
              <span className="text-gray-500 dark:text-gray-400 w-16">{t('marketRadar.details.qualification')}:</span>
              <div className="flex-1 flex items-center gap-1">
                <div className="flex-1 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden flex">
                  <div className="h-full bg-purple-500" style={{ width: `${details.qualification.cadres}%` }} title={t('marketRadar.details.executives')} />
                  <div className="h-full bg-indigo-400" style={{ width: `${details.qualification.techniciens}%` }} title={t('marketRadar.details.technicians')} />
                  <div className="h-full bg-gray-400" style={{ width: `${details.qualification.employes}%` }} title={t('marketRadar.details.employees')} />
                </div>
                <span className="text-purple-600 dark:text-purple-400 text-[10px]">{t('marketRadar.details.executives')} {details.qualification.cadres}%</span>
              </div>
            </div>
          )}
          
          {/* Experience breakdown */}
          {details.experience && (
            <div className="flex items-center gap-2 text-xs">
              <span className="text-gray-500 dark:text-gray-400 w-16">{t('marketRadar.details.experience')}:</span>
              <div className="flex-1 flex items-center gap-1">
                <div className="flex-1 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden flex">
                  <div className="h-full bg-teal-400" style={{ width: `${details.experience.debutant}%` }} title={t('marketRadar.details.beginner')} />
                  <div className="h-full bg-teal-600" style={{ width: `${details.experience.experimente}%` }} title={t('marketRadar.details.experienced')} />
                </div>
                <span className="text-teal-600 dark:text-teal-400 text-[10px]">{t('marketRadar.details.experience')} {details.experience.experimente}%</span>
              </div>
            </div>
          )}
          
          {/* Age breakdown (for demandeur_entrant) */}
          {details.age && (
            <div className="flex items-center gap-2 text-xs">
              <span className="text-gray-500 dark:text-gray-400 w-16">{t('marketRadar.details.age')}:</span>
              <div className="flex-1 flex items-center gap-1">
                <div className="flex-1 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden flex">
                  <div className="h-full bg-amber-400" style={{ width: `${details.age.jeunes}%` }} title="15-24 ans" />
                  <div className="h-full bg-amber-500" style={{ width: `${details.age.adultes}%` }} title="25-49 ans" />
                  <div className="h-full bg-amber-600" style={{ width: `${details.age.seniors}%` }} title="50+ ans" />
                </div>
                <span className="text-amber-600 dark:text-amber-400 text-[10px]">25-49: {details.age.adultes}%</span>
              </div>
            </div>
          )}
          
          {/* Formation breakdown (for demandeur_entrant) */}
          {details.formation && (
            <div className="flex items-center gap-2 text-xs">
              <span className="text-gray-500 dark:text-gray-400 w-16">{t('marketRadar.details.training')}:</span>
              <div className="flex-1 flex items-center gap-1">
                <div className="flex-1 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden flex">
                  <div className="h-full bg-rose-400" style={{ width: `${details.formation.sansQualif}%` }} title={t('marketRadar.details.underBac')} />
                  <div className="h-full bg-rose-500" style={{ width: `${details.formation.bac}%` }} title="Bac" />
                  <div className="h-full bg-rose-600" style={{ width: `${details.formation.bacPlus}%` }} title="Bac+" />
                </div>
                <span className="text-rose-600 dark:text-rose-400 text-[10px]">Bac+ {details.formation.bacPlus}%</span>
              </div>
            </div>
          )}
          
          {/* Detailed characteristics for demandeur - grouped by type */}
          {details.caracteristiquesDetaillees && details.caracteristiquesDetaillees.length > 0 && (() => {
            const genreData = details.caracteristiquesDetaillees.filter(c => c.type === 'GENRE');
            const ageData = details.caracteristiquesDetaillees.filter(c => c.type === 'AGE');
            const genreAgeData = details.caracteristiquesDetaillees.filter(c => c.type === 'GENRExAGE');
            
            return (
              <div className="mt-3 space-y-3">
                {/* Genre section */}
                {genreData.length > 0 && (
                  <div className="bg-gradient-to-r from-blue-50 to-pink-50 dark:from-blue-900/20 dark:to-pink-900/20 rounded-lg p-2">
                    <div className="text-[10px] font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wide mb-1.5">{t('marketRadar.details.genre')}</div>
                    <div className="flex gap-3">
                      {genreData.map((g, i) => (
                        <div key={i} className="flex-1">
                          <div className="flex items-center justify-between mb-1">
                            <span className={`text-xs font-medium ${g.label === 'Hommes' ? 'text-blue-600 dark:text-blue-400' : 'text-pink-600 dark:text-pink-400'}`}>
                              {g.label}
                            </span>
                            <span className="text-xs font-bold text-gray-700 dark:text-gray-300">{g.pourcentage}%</span>
                          </div>
                          <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                            <div 
                              className={`h-full rounded-full ${g.label === 'Hommes' ? 'bg-blue-500' : 'bg-pink-500'}`}
                              style={{ width: `${g.pourcentage}%` }}
                            />
                          </div>
                          <div className="text-[10px] text-gray-500 dark:text-gray-400 mt-0.5 text-center">{g.nombre} {t('marketRadar.details.people')}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                
                {/* Age section */}
                {ageData.length > 0 && (
                  <div className="bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-900/20 dark:to-orange-900/20 rounded-lg p-2">
                    <div className="text-[10px] font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wide mb-1.5">{t('marketRadar.details.ageRanges')}</div>
                    <div className="space-y-1.5">
                      {ageData.slice(0, 5).map((a, i) => (
                        <div key={i} className="flex items-center gap-2">
                          <span className="text-[10px] text-gray-600 dark:text-gray-400 w-20 truncate" title={a.label}>{a.label}</span>
                          <div className="flex-1 h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                            <div 
                              className="h-full bg-gradient-to-r from-amber-400 to-orange-500 rounded-full"
                              style={{ width: `${a.pourcentage}%` }}
                            />
                          </div>
                          <span className={`text-[10px] font-medium w-8 text-right ${a.pourcentage > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-gray-400'}`}>
                            {a.pourcentage}%
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                
                {/* Genre x Age section - collapsible style */}
                {genreAgeData.length > 0 && (
                  <details className="group">
                    <summary className="cursor-pointer text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide flex items-center gap-1 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors">
                      <span className="group-open:rotate-90 transition-transform">▶</span>
                      {t('marketRadar.details.genreAgeDetail')} ({genreAgeData.length})
                    </summary>
                    <div className="mt-2 grid grid-cols-2 gap-1.5 max-h-32 overflow-y-auto">
                      {genreAgeData.map((ga, i) => (
                        <div key={i} className="flex items-center gap-1 bg-gray-50 dark:bg-gray-800/50 rounded px-1.5 py-0.5">
                          <div 
                            className={`w-1.5 h-1.5 rounded-full ${ga.label.startsWith('Hommes') ? 'bg-blue-500' : 'bg-pink-500'}`}
                          />
                          <span className="text-[9px] text-gray-600 dark:text-gray-400 flex-1 truncate" title={ga.label}>
                            {ga.label.replace('Hommes - ', 'H ').replace('Femmes - ', 'F ')}
                          </span>
                          <span className={`text-[9px] font-medium ${ga.pourcentage > 0 ? 'text-indigo-600 dark:text-indigo-400' : 'text-gray-400'}`}>
                            {ga.pourcentage}%
                          </span>
                        </div>
                      ))}
                    </div>
                  </details>
                )}
              </div>
            );
          })()}
          
          {/* Period info */}
          {details.periode && (
            <div className="text-[10px] text-gray-400 dark:text-gray-500 mt-1">{details.periode}</div>
          )}
        </div>
      )}
      
      {!details && parsed.indicateur && (
        <div className="text-xs text-gray-500 dark:text-gray-400">{parsed.indicateur}</div>
      )}
    </div>
  );
}

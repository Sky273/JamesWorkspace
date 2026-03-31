import { ProgressBar } from './TrendProgressBar';
import type { ParsedMetadata } from './trendMetadata.types';

interface FullViewProps {
  parsed: ParsedMetadata;
  type: string;
  className?: string;
  t: (key: string) => string;
  formatNumber: (val: number | undefined, valType?: 'nombre' | 'montant' | 'taux') => string;
}

export function TrendMetadataFullView({ parsed, type, className = '', t, formatNumber }: FullViewProps) {
  return (
    <div className={`space-y-2 ${className}`}>
      {parsed.indicateur && (
        <div className="text-sm text-gray-600 dark:text-gray-400 truncate" title={parsed.indicateur}>
          {parsed.indicateur}
        </div>
      )}
      {parsed.valeurPrincipale !== undefined && (
        <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">
          {formatNumber(parsed.valeurPrincipale, parsed.valeurPrincipaleType)}
        </div>
      )}
      {parsed.valeurSecondaire !== undefined && parsed.valeurSecondarieType === 'pourcentage' && (
        <div className={`text-sm font-medium ${parsed.valeurSecondaire >= 0 ? 'text-green-600' : 'text-red-600'}`}>
          {parsed.valeurSecondaire >= 0 ? '↑' : '↓'} {Math.abs(parsed.valeurSecondaire).toFixed(1)}% {t('marketRadar.details.evolution')}
        </div>
      )}
      {parsed.periode && <div className="text-xs text-gray-500 dark:text-gray-400">{parsed.periode}</div>}
      {type === 'tension' && parsed.typeSpecific?.tensionLevel && (
        <div className={`text-sm font-medium px-2 py-1 rounded inline-block ${parsed.typeSpecific.tensionColor === 'red' ? 'bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300' : parsed.typeSpecific.tensionColor === 'orange' ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/50 dark:text-orange-300' : parsed.typeSpecific.tensionColor === 'yellow' ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/50 dark:text-yellow-300' : parsed.typeSpecific.tensionColor === 'green' ? 'bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300' : 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300'}`}>
          {parsed.typeSpecific.tensionLevel}
        </div>
      )}
      {type === 'dynamique_emploi' && parsed.typeSpecific?.tendanceLabel && (
        <div className={`text-sm font-medium px-2 py-1 rounded inline-block ${parsed.typeSpecific.tendance === 'hausse' ? 'bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300' : parsed.typeSpecific.tendance === 'baisse' ? 'bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300' : 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300'}`}>
          {parsed.typeSpecific.tendanceLabel}
        </div>
      )}
      {parsed.typeSpecific?.embaucheDetails?.contrats && (
        <div className="space-y-1 mt-2">
          <div className="text-xs font-medium text-gray-700 dark:text-gray-300">{t('marketRadar.details.contracts')}</div>
          <ProgressBar value={parsed.typeSpecific.embaucheDetails.contrats.cdi} color="green" label={t('marketRadar.details.cdi')} />
          <ProgressBar value={parsed.typeSpecific.embaucheDetails.contrats.cdd} color="orange" label={t('marketRadar.details.cdd')} />
        </div>
      )}
      {parsed.typeSpecific?.embaucheDetails?.qualification && (
        <div className="space-y-1 mt-2">
          <div className="text-xs font-medium text-gray-700 dark:text-gray-300">{t('marketRadar.details.qualification')}</div>
          <ProgressBar value={parsed.typeSpecific.embaucheDetails.qualification.cadres} color="purple" label={t('marketRadar.details.executives')} />
          <ProgressBar value={parsed.typeSpecific.embaucheDetails.qualification.techniciens} color="blue" label={t('marketRadar.details.technicians')} />
        </div>
      )}
      {parsed.typeSpecific?.embaucheDetails?.experience && (
        <div className="space-y-1 mt-2">
          <div className="text-xs font-medium text-gray-700 dark:text-gray-300">{t('marketRadar.details.experience')}</div>
          <ProgressBar value={parsed.typeSpecific.embaucheDetails.experience.debutant} color="teal" label={t('marketRadar.details.beginner')} />
          <ProgressBar value={parsed.typeSpecific.embaucheDetails.experience.experimente} color="indigo" label={t('marketRadar.details.experienced')} />
        </div>
      )}
    </div>
  );
}

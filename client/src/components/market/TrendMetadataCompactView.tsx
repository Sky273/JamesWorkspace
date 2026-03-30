import { ProgressBar } from './TrendProgressBar';
import type { ParsedMetadata } from './trendMetadata.types';

interface CompactViewProps {
  parsed: ParsedMetadata;
  type: string;
  className?: string;
  t: (key: string) => string;
  formatNumber: (val: number | undefined, valType?: 'nombre' | 'montant' | 'taux') => string;
}

export function TrendMetadataCompactView({ parsed, type, className = '', t, formatNumber }: CompactViewProps) {
  const embauche = parsed.typeSpecific?.embaucheDetails;

  return (
    <div className={`text-xs space-y-2 ${className}`}>
      {parsed.indicateur && <div className="font-medium text-gray-900 dark:text-gray-100 truncate">{parsed.indicateur}</div>}
      {parsed.valeurPrincipale !== undefined && (
        <div>
          <div className="text-2xl font-bold text-indigo-600 dark:text-indigo-400">
            {formatNumber(parsed.valeurPrincipale, parsed.valeurPrincipaleType)}
          </div>
          {embauche?.pourcentageTotal !== undefined && (
            <div className="text-gray-500 dark:text-gray-400">{embauche.pourcentageTotal.toFixed(1)}% {t('marketRadar.details.totalShare')}</div>
          )}
        </div>
      )}
      {parsed.valeurSecondaire !== undefined && parsed.valeurSecondarieType === 'pourcentage' && (
        <div className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${parsed.valeurSecondaire >= 0 ? 'bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300' : 'bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300'}`}>
          {parsed.valeurSecondaire >= 0 ? '+' : ''}{parsed.valeurSecondaire.toFixed(1)}% {t('marketRadar.details.evolution')}
        </div>
      )}
      {type === 'tension' && parsed.typeSpecific?.tensionLevel && (
        <div className={`font-medium ${parsed.typeSpecific.tensionColor === 'red' ? 'text-red-600' : parsed.typeSpecific.tensionColor === 'orange' ? 'text-orange-600' : parsed.typeSpecific.tensionColor === 'yellow' ? 'text-yellow-600' : parsed.typeSpecific.tensionColor === 'green' ? 'text-green-600' : 'text-gray-600'}`}>
          {parsed.typeSpecific.tensionLevel}
        </div>
      )}
      {type === 'dynamique_emploi' && parsed.typeSpecific?.tendanceLabel && (
        <div className={`font-medium ${parsed.typeSpecific.tendance === 'hausse' ? 'text-green-600' : parsed.typeSpecific.tendance === 'baisse' ? 'text-red-600' : 'text-gray-600'}`}>
          {parsed.typeSpecific.tendanceLabel}
        </div>
      )}
      {embauche?.qualification && (
        <div className="mt-2 p-2 bg-gray-50 dark:bg-gray-800/50 rounded">
          <div className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">{t('marketRadar.details.qualification').toUpperCase()}</div>
          <div className="space-y-1">
            {embauche.qualification.cadres > 0 && <ProgressBar value={embauche.qualification.cadres} color="purple" label={t('marketRadar.details.executives')} />}
            {embauche.qualification.techniciens > 0 && <ProgressBar value={embauche.qualification.techniciens} color="blue" label={t('marketRadar.details.technicians')} />}
            {embauche.qualification.employes > 0 && <ProgressBar value={embauche.qualification.employes} color="teal" label={t('marketRadar.details.employees')} />}
            {embauche.qualification.ouvriers && embauche.qualification.ouvriers > 0 && <ProgressBar value={embauche.qualification.ouvriers} color="orange" label={t('marketRadar.details.workers')} />}
          </div>
        </div>
      )}
      {embauche?.experience && (
        <div className="mt-2 p-2 bg-gray-50 dark:bg-gray-800/50 rounded">
          <div className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">{t('marketRadar.details.experience').toUpperCase()}</div>
          <div className="space-y-1">
            <ProgressBar value={embauche.experience.debutant} color="teal" label={t('marketRadar.details.beginner')} />
            <ProgressBar value={embauche.experience.experimente} color="indigo" label={t('marketRadar.details.experienced')} />
          </div>
        </div>
      )}
      {parsed.periode && <div className="text-gray-500 dark:text-gray-400 mt-2 pt-2 border-t border-gray-200 dark:border-gray-700">{parsed.periode}</div>}
    </div>
  );
}

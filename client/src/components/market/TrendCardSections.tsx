import {
  ArrowTrendingDownIcon,
  ArrowTrendingUpIcon,
  BriefcaseIcon,
  ChartBarIcon,
  MapPinIcon
} from '@heroicons/react/24/outline';
import { useTranslation } from 'react-i18next';
import { formatDate } from '../../utils/dateFormatter';
import type { ParsedMetadata } from './marketTrends.types';

export function TensionContent({ parsed }: { parsed: ParsedMetadata }) {
  const { t } = useTranslation();
  return (
    <div className="space-y-3">
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
      {parsed.typeSpecific?.tensionIndicators && parsed.typeSpecific.tensionIndicators.length > 0 && (
        <div className="space-y-1.5">
          {parsed.typeSpecific.tensionIndicators.filter((ind) => ind.code !== 'PERSPECTIVE').map((indicator) => (
            <div key={indicator.code} className="flex items-center justify-between text-xs">
              <span className="text-gray-600 dark:text-gray-400 truncate mr-2" title={indicator.label}>{indicator.label}</span>
              <div className="flex items-center gap-1.5 flex-shrink-0">
                <div className="w-12 h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full ${indicator.color === 'red' ? 'bg-red-500' : indicator.color === 'orange' ? 'bg-orange-500' : indicator.color === 'yellow' ? 'bg-yellow-500' : indicator.color === 'green' ? 'bg-green-500' : 'bg-gray-400'}`}
                    style={{ width: `${(indicator.value / 5) * 100}%` }}
                  />
                </div>
                <span className={`font-medium w-4 text-right ${indicator.color === 'red' ? 'text-red-600 dark:text-red-400' : indicator.color === 'orange' ? 'text-orange-600 dark:text-orange-400' : indicator.color === 'yellow' ? 'text-yellow-600 dark:text-yellow-400' : indicator.color === 'green' ? 'text-green-600 dark:text-green-400' : 'text-gray-600 dark:text-gray-400'}`}>
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

export function SalaireContent({ parsed }: { parsed: ParsedMetadata }) {
  const { t } = useTranslation();
  return (
    <div className="space-y-3">
      {parsed.typeSpecific?.salaireMin !== undefined && parsed.typeSpecific?.salaireMax !== undefined && (
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
          <div><span className="text-gray-500 dark:text-gray-400">{t('marketRadar.details.minimum')}: </span><span className="font-medium text-gray-900 dark:text-gray-100">{parsed.typeSpecific.salaireMin.toLocaleString('fr-FR')} €</span></div>
          <div><span className="text-gray-500 dark:text-gray-400">{t('marketRadar.details.maximum')}: </span><span className="font-medium text-gray-900 dark:text-gray-100">{parsed.typeSpecific.salaireMax.toLocaleString('fr-FR')} €</span></div>
          {parsed.typeSpecific?.salaireMedian !== undefined && (
            <div><span className="text-gray-500 dark:text-gray-400">{t('marketRadar.details.median')}: </span><span className="font-medium text-emerald-600 dark:text-emerald-400">{parsed.typeSpecific.salaireMedian.toLocaleString('fr-FR')} €</span></div>
          )}
        </div>
      )}
      {parsed.typeSpecific?.salairesParActivite && parsed.typeSpecific.salairesParActivite.length > 0 && (
        <div className="mt-2 space-y-2">
          <div className="text-xs font-medium text-gray-700 dark:text-gray-300">{t('marketRadar.details.byCategory')} :</div>
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {parsed.typeSpecific.salairesParActivite.map((activite, idx) => (
              <div key={idx} className="p-2 bg-white dark:bg-gray-800 rounded border border-gray-200 dark:border-gray-600">
                <div className="text-xs font-medium text-gray-800 dark:text-gray-200 mb-1 line-clamp-2" title={activite.libActivite}>{activite.libActivite}</div>
                <div className="grid grid-cols-3 gap-1 text-xs">
                  {activite.salaireDebutant !== undefined && <div className="text-center"><div className="text-gray-500 dark:text-gray-400">{t('marketRadar.details.beginner')}</div><div className="font-semibold text-blue-600 dark:text-blue-400">{activite.salaireDebutant.toLocaleString('fr-FR')} €</div></div>}
                  {activite.salaireMoyen !== undefined && <div className="text-center"><div className="text-gray-500 dark:text-gray-400">{t('marketRadar.details.averageLevel')}</div><div className="font-semibold text-emerald-600 dark:text-emerald-400">{activite.salaireMoyen.toLocaleString('fr-FR')} €</div></div>}
                  {activite.salaireExperimente !== undefined && <div className="text-center"><div className="text-gray-500 dark:text-gray-400">{t('marketRadar.details.experienced')}</div><div className="font-semibold text-purple-600 dark:text-purple-400">{activite.salaireExperimente.toLocaleString('fr-FR')} €</div></div>}
                </div>
                {activite.periode && <div className="text-xs text-gray-400 dark:text-gray-500 mt-1">{activite.periode}</div>}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export function DynamiqueContent({ parsed }: { parsed: ParsedMetadata }) {
  const { t } = useTranslation();
  const dynDetails = parsed.typeSpecific?.dynamiqueDetails;
  return (
    <div className="space-y-3">
      {parsed.typeSpecific?.tendance && (
        <div className="flex items-center gap-2">
          <div className={`inline-flex items-center px-3 py-1.5 rounded-full text-sm font-medium ${parsed.typeSpecific.tendance === 'hausse' ? 'bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300' : parsed.typeSpecific.tendance === 'baisse' ? 'bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300' : 'bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300'}`}>
            {parsed.typeSpecific.tendance === 'hausse' && <ArrowTrendingUpIcon className="h-4 w-4 mr-1" />}
            {parsed.typeSpecific.tendance === 'baisse' && <ArrowTrendingDownIcon className="h-4 w-4 mr-1" />}
            {parsed.typeSpecific.tendanceLabel || (parsed.typeSpecific.tendance === 'hausse' ? t('marketRadar.details.positiveDynamic') : parsed.typeSpecific.tendance === 'baisse' ? t('marketRadar.details.negativeDynamic') : t('marketRadar.details.stableDynamic'))}
          </div>
        </div>
      )}
      {parsed.typeSpecific?.tendanceDescription && <p className="text-xs text-gray-600 dark:text-gray-400">{parsed.typeSpecific.tendanceDescription}</p>}
      {dynDetails && (
        <div className="space-y-2 pt-2 border-t border-gray-100 dark:border-gray-700">
          {dynDetails.territoire && <div className="flex items-center gap-2 text-xs"><MapPinIcon className="h-3.5 w-3.5 text-gray-400" /><span className="text-gray-600 dark:text-gray-400">{dynDetails.territoire}</span></div>}
          {dynDetails.periode && <div className="flex items-center gap-2 text-xs"><ChartBarIcon className="h-3.5 w-3.5 text-gray-400" /><span className="text-gray-600 dark:text-gray-400">{dynDetails.periode}</span>{dynDetails.codePeriode && <span className="text-gray-400 dark:text-gray-500">({dynDetails.codePeriode})</span>}</div>}
          {dynDetails.activite && <div className="flex items-center gap-2 text-xs"><BriefcaseIcon className="h-3.5 w-3.5 text-gray-400" /><span className="text-gray-600 dark:text-gray-400 truncate" title={dynDetails.activite}>{dynDetails.activite}</span></div>}
          {(dynDetails.dateMaj || dynDetails.dateMajGlobale) && <div className="text-xs text-gray-400 dark:text-gray-500 pt-1">{t('marketRadar.details.updatedAt')} : {formatDate(dynDetails.dateMaj || dynDetails.dateMajGlobale, 'long')}</div>}
        </div>
      )}
      {!dynDetails && parsed.indicateur && <div className="text-xs text-gray-500 dark:text-gray-400">{parsed.indicateur}</div>}
    </div>
  );
}

export function EmbaucheContent({ parsed }: { parsed: ParsedMetadata }) {
  const { t } = useTranslation();
  const details = parsed.typeSpecific?.embaucheDetails;
  return (
    <div className="space-y-3">
      {parsed.typeSpecific?.evolutionPercent !== undefined && (
        <div className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${parsed.typeSpecific.evolutionPercent > 0 ? 'bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300' : parsed.typeSpecific.evolutionPercent < 0 ? 'bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300' : 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300'}`}>
          {parsed.typeSpecific.evolutionPercent > 0 ? '+' : ''}{Number(parsed.typeSpecific.evolutionPercent).toFixed(1)}% {t('marketRadar.details.evolution')}
        </div>
      )}
      {details && (
        <div className="space-y-2">
          {details.genre && <div className="flex items-center gap-2 text-xs"><span className="text-gray-500 dark:text-gray-400 w-16">{t('marketRadar.details.genre')}:</span><div className="flex-1 flex items-center gap-1"><div className="flex-1 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden flex"><div className="h-full bg-blue-500" style={{ width: `${details.genre.hommes}%` }} /><div className="h-full bg-pink-500" style={{ width: `${details.genre.femmes}%` }} /></div><span className="text-blue-600 dark:text-blue-400 w-8 text-right">{details.genre.hommes}%</span><span className="text-pink-600 dark:text-pink-400 w-8 text-right">{details.genre.femmes}%</span></div></div>}
          {details.contrats && <div className="flex items-center gap-2 text-xs"><span className="text-gray-500 dark:text-gray-400 w-16">{t('marketRadar.details.contracts')}:</span><div className="flex-1 flex items-center gap-1"><div className="flex-1 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden flex"><div className="h-full bg-green-500" style={{ width: `${details.contrats.cdi}%` }} title={t('marketRadar.details.cdi')} /><div className="h-full bg-yellow-500" style={{ width: `${details.contrats.cdd}%` }} title="CDD" /><div className="h-full bg-gray-400" style={{ width: `${details.contrats.autres}%` }} title={t('marketRadar.details.other')} /></div><span className="text-green-600 dark:text-green-400 text-[10px]">{t('marketRadar.details.cdi')} {details.contrats.cdi}%</span></div></div>}
          {details.qualification && <div className="flex items-center gap-2 text-xs"><span className="text-gray-500 dark:text-gray-400 w-16">{t('marketRadar.details.qualification')}:</span><div className="flex-1 flex items-center gap-1"><div className="flex-1 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden flex"><div className="h-full bg-purple-500" style={{ width: `${details.qualification.cadres}%` }} title={t('marketRadar.details.executives')} /><div className="h-full bg-indigo-400" style={{ width: `${details.qualification.techniciens}%` }} title={t('marketRadar.details.technicians')} /><div className="h-full bg-gray-400" style={{ width: `${details.qualification.employes}%` }} title={t('marketRadar.details.employees')} /></div><span className="text-purple-600 dark:text-purple-400 text-[10px]">{t('marketRadar.details.executives')} {details.qualification.cadres}%</span></div></div>}
          {details.experience && <div className="flex items-center gap-2 text-xs"><span className="text-gray-500 dark:text-gray-400 w-16">{t('marketRadar.details.experience')}:</span><div className="flex-1 flex items-center gap-1"><div className="flex-1 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden flex"><div className="h-full bg-teal-400" style={{ width: `${details.experience.debutant}%` }} title={t('marketRadar.details.beginner')} /><div className="h-full bg-teal-600" style={{ width: `${details.experience.experimente}%` }} title={t('marketRadar.details.experienced')} /></div><span className="text-teal-600 dark:text-teal-400 text-[10px]">{t('marketRadar.details.experience')} {details.experience.experimente}%</span></div></div>}
          {details.age && <div className="flex items-center gap-2 text-xs"><span className="text-gray-500 dark:text-gray-400 w-16">{t('marketRadar.details.age')}:</span><div className="flex-1 flex items-center gap-1"><div className="flex-1 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden flex"><div className="h-full bg-amber-400" style={{ width: `${details.age.jeunes}%` }} title="15-24 ans" /><div className="h-full bg-amber-500" style={{ width: `${details.age.adultes}%` }} title="25-49 ans" /><div className="h-full bg-amber-600" style={{ width: `${details.age.seniors}%` }} title="50+ ans" /></div><span className="text-amber-600 dark:text-amber-400 text-[10px]">25-49: {details.age.adultes}%</span></div></div>}
          {details.formation && <div className="flex items-center gap-2 text-xs"><span className="text-gray-500 dark:text-gray-400 w-16">{t('marketRadar.details.training')}:</span><div className="flex-1 flex items-center gap-1"><div className="flex-1 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden flex"><div className="h-full bg-rose-400" style={{ width: `${details.formation.sansQualif}%` }} title={t('marketRadar.details.underBac')} /><div className="h-full bg-rose-500" style={{ width: `${details.formation.bac}%` }} title="Bac" /><div className="h-full bg-rose-600" style={{ width: `${details.formation.bacPlus}%` }} title="Bac+" /></div><span className="text-rose-600 dark:text-rose-400 text-[10px]">Bac+ {details.formation.bacPlus}%</span></div></div>}
          {details.periode && <div className="text-[10px] text-gray-400 dark:text-gray-500 mt-1">{details.periode}</div>}
        </div>
      )}
      {!details && parsed.indicateur && <div className="text-xs text-gray-500 dark:text-gray-400">{parsed.indicateur}</div>}
    </div>
  );
}

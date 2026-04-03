import {
  AcademicCapIcon,
  ArrowPathIcon,
  BriefcaseIcon,
  CheckCircleIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  ExclamationTriangleIcon,
  MagnifyingGlassIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';
import { useTranslation } from 'react-i18next';

import type { Metier, MetiersStats } from '../../services/romeService';
import { formatDateTime } from '../../utils/dateFormatter';
import Pagination from '../Pagination';
import { METIERS_PAGE_SIZE } from './useMetiersDashboard';

export function MetiersCollectionOverlay({ collecting, collectingSuccess }: { collecting: boolean; collectingSuccess: boolean }) {
  const { t } = useTranslation();

  if (!collecting) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl p-8 max-w-md mx-4 text-center">
        {collectingSuccess ? (
          <>
            <CheckCircleIcon className="h-16 w-16 text-green-500 mx-auto mb-4 animate-bounce" />
            <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2">
              {t('marketRadar.collection.launched', 'Collecte lancee !')}
            </h3>
            <p className="text-gray-600 dark:text-gray-400">{t('marketRadar.collection.redirecting', 'Redirection vers les jobs...')}</p>
          </>
        ) : (
          <>
            <ArrowPathIcon className="h-16 w-16 text-indigo-600 dark:text-indigo-400 animate-spin mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2">{t('marketRadar.collection.starting', 'Lancement de la collecte...')}</h3>
          </>
        )}
      </div>
    </div>
  );
}

export function MetiersHeader({
  error,
  isAdmin,
  loading,
  onClearError,
  onCollect,
  onRefresh,
}: {
  error: string | null;
  isAdmin: boolean;
  loading: boolean;
  onClearError: () => void;
  onCollect: () => void;
  onRefresh: () => void;
}) {
  const { t } = useTranslation();

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
            <BriefcaseIcon className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
            {t('marketRadar.metiers.title')}
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{t('marketRadar.metiers.subtitle')}</p>
        </div>

        <div className="flex items-center gap-2">
          <button onClick={onRefresh} disabled={loading} className="inline-flex items-center px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed" title={t('marketRadar.metiers.refresh')}>
            <ArrowPathIcon className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </button>

          {isAdmin && (
            <button onClick={onCollect} disabled={loading} className="btn btn-secondary inline-flex items-center px-4 py-2 text-sm">
              <ArrowPathIcon className="h-4 w-4 mr-2" />
              {t('marketRadar.metiers.collection.button')}
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="mt-4 p-4 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-md">
          <div className="flex items-start">
            <ExclamationTriangleIcon className="h-5 w-5 text-red-500 dark:text-red-400 mt-0.5" />
            <div className="ml-3 flex-1">
              <p className="text-sm text-red-700 dark:text-red-400">{error}</p>
            </div>
            <button onClick={onClearError} className="text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-200">
              <XMarkIcon className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export function MetiersSearchBar({ searchQuery, onSearchQueryChange, onSubmit, onClear }: { searchQuery: string; onSearchQueryChange: (value: string) => void; onSubmit: (event: React.FormEvent) => void; onClear: () => void }) {
  const { t } = useTranslation();

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4">
      <form onSubmit={onSubmit} className="flex gap-3">
        <div className="relative flex-1">
          <MagnifyingGlassIcon className="pointer-events-none absolute left-3 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(event) => onSearchQueryChange(event.target.value)}
            placeholder={t('marketRadar.metiers.searchPlaceholder')}
            className="w-full rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 py-2.5 pl-10 pr-10 text-sm text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
          />
          {searchQuery && (
            <button type="button" onClick={onClear} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
              <XMarkIcon className="h-4 w-4" />
            </button>
          )}
        </div>
        <button type="submit" className="btn btn-primary px-4 py-2 text-sm">Rechercher</button>
        {searchQuery && (
          <button type="button" onClick={onClear} className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors">
            {t('common.resetFilters')}
          </button>
        )}
      </form>
    </div>
  );
}

export function MetiersStatsCards({ globalStats, totalCount, latestUpdated }: { globalStats: MetiersStats | null; totalCount: number; latestUpdated?: string | null }) {
  const { t } = useTranslation();

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-indigo-100 dark:bg-indigo-900/30 rounded-lg">
            <BriefcaseIcon className="h-6 w-6 text-indigo-600 dark:text-indigo-400" />
          </div>
          <div>
            <p className="text-sm text-gray-500 dark:text-gray-400">{t('marketRadar.metiers.stats.totalMetiers')}</p>
            <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{globalStats?.totalMetiers ?? totalCount}</p>
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg">
            <AcademicCapIcon className="h-6 w-6 text-green-600 dark:text-green-400" />
          </div>
          <div>
            <p className="text-sm text-gray-500 dark:text-gray-400">{t('marketRadar.metiers.stats.totalCompetences')}</p>
            <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{globalStats?.totalCompetences ?? '-'}</p>
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
            <ArrowPathIcon className="h-6 w-6 text-purple-600 dark:text-purple-400" />
          </div>
          <div>
            <p className="text-sm text-gray-500 dark:text-gray-400">{t('marketRadar.metiers.stats.lastUpdate')}</p>
            <p className="text-lg font-semibold text-gray-900 dark:text-gray-100">{formatDateTime(globalStats?.lastUpdated || latestUpdated) || '-'}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function MetierCardDetails({ metier }: { metier: Metier }) {
  const { t } = useTranslation();

  return (
    <div className="px-6 pb-6 border-t border-gray-200 dark:border-gray-700">
      {metier.Enjeux && metier.Enjeux.length > 0 && (
        <div className="mt-4">
          <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">{t('marketRadar.metiers.card.enjeuxDomaines')} ({metier.Enjeux.length})</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
            {metier.Enjeux.map((enjeu, index) => (
              <div key={index} className="flex items-start gap-2 p-2 bg-indigo-50 dark:bg-indigo-900/20 rounded">
                <BriefcaseIcon className="h-4 w-4 text-indigo-600 dark:text-indigo-400 flex-shrink-0 mt-0.5" />
                <span className="text-sm text-gray-700 dark:text-gray-300">{enjeu.libelle}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {metier.CompetencesDetaillees && metier.CompetencesDetaillees.length > 0 && (
        <div className="mt-4">
          <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">{t('marketRadar.metiers.card.competencesDetaillees')} ({metier.CompetencesDetaillees.length})</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-64 overflow-y-auto">
            {metier.CompetencesDetaillees.map((competence, index) => (
              <div key={index} className="flex items-start gap-2 p-2 bg-green-50 dark:bg-green-900/20 rounded">
                <AcademicCapIcon className="h-4 w-4 text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" />
                <div>
                  <span className="text-sm text-gray-700 dark:text-gray-300">{competence.libelle}</span>
                  {competence.enjeu && <span className="block text-xs text-gray-500 dark:text-gray-400">{competence.enjeu}</span>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {metier.MacroSavoirFaire && metier.MacroSavoirFaire.length > 0 && (
        <div className="mt-4">
          <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">{t('marketRadar.metiers.card.macroSavoirFaire')} ({metier.MacroSavoirFaire.length})</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {metier.MacroSavoirFaire.map((competence, index) => (
              <div key={index} className="flex items-start gap-2 p-2 bg-blue-50 dark:bg-blue-900/20 rounded">
                <BriefcaseIcon className="h-4 w-4 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
                <div>
                  <span className="text-sm text-gray-700 dark:text-gray-300">{competence.libelle}</span>
                  {competence.enjeu && <span className="block text-xs text-gray-500 dark:text-gray-400">{competence.enjeu}</span>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {metier.Savoirs && metier.Savoirs.length > 0 && (
        <div className="mt-4">
          <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">{t('marketRadar.metiers.card.savoirs')} ({metier.Savoirs.length})</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-64 overflow-y-auto">
            {metier.Savoirs.map((savoir, index) => (
              <div key={index} className="flex items-start gap-2 p-2 bg-purple-50 dark:bg-purple-900/20 rounded">
                <AcademicCapIcon className="h-4 w-4 text-purple-600 dark:text-purple-400 flex-shrink-0 mt-0.5" />
                <div>
                  <span className="text-sm text-gray-700 dark:text-gray-300">{savoir.libelle}</span>
                  {savoir.categorie && <span className="block text-xs text-gray-500 dark:text-gray-400">{savoir.categorie}</span>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700 flex items-center gap-4 text-sm text-gray-500 dark:text-gray-400">
        {metier.Obsolete && <span className="px-2 py-1 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 rounded">Obsolete</span>}
        {metier.LastUpdated && <span>{t('marketRadar.metiers.card.updatedAt')}: {formatDateTime(metier.LastUpdated)}</span>}
      </div>
    </div>
  );
}

export function MetiersResults({
  currentPage,
  expandedMetiers,
  isAdmin,
  loading,
  metiers,
  searchQuery,
  totalCount,
  totalPages,
  onCollect,
  onPageChange,
  onToggleExpand,
}: {
  currentPage: number;
  expandedMetiers: Set<string>;
  isAdmin: boolean;
  loading: boolean;
  metiers: Metier[];
  searchQuery: string;
  totalCount: number;
  totalPages: number;
  onCollect: () => void;
  onPageChange: (page: number) => void;
  onToggleExpand: (codeRome: string) => void;
}) {
  const { t } = useTranslation();

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <ArrowPathIcon className="h-8 w-8 text-indigo-600 dark:text-indigo-400 animate-spin" />
        <span className="ml-3 text-gray-600 dark:text-gray-400">{t('marketRadar.metiers.loading')}</span>
      </div>
    );
  }

  if (metiers.length === 0) {
    return (
      <div className="text-center py-12 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
        <BriefcaseIcon className="h-12 w-12 text-gray-400 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">{t('marketRadar.metiers.noData')}</h3>
        <p className="text-gray-500 dark:text-gray-400 mb-4">{searchQuery ? t('marketRadar.metiers.noDataSearch') : t('marketRadar.metiers.noDataEmpty')}</p>
        {isAdmin && !searchQuery && (
          <button onClick={onCollect} className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors">
            <ArrowPathIcon className="h-4 w-4" />
            {t('marketRadar.metiers.collection.button')}
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Pagination currentPage={currentPage} totalPages={totalPages} totalCount={totalCount} pageSize={METIERS_PAGE_SIZE} onPageChange={onPageChange} loading={loading} itemName={t('marketRadar.metiers.results')} />

      {metiers.map((metier) => {
        const totalCompetences = (metier.CompetencesDetaillees?.length || 0) + (metier.MacroSavoirFaire?.length || 0);
        const isExpanded = expandedMetiers.has(metier.CodeRome);
        return (
          <div key={metier.CodeRome} className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
            <button onClick={() => onToggleExpand(metier.CodeRome)} className="w-full px-6 py-4 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
              <div className="flex items-center gap-4">
                <span className="px-3 py-1 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 rounded-lg font-mono font-semibold">{metier.CodeRome}</span>
                <div className="text-left">
                  <h3 className="font-semibold text-gray-900 dark:text-gray-100">{metier.Libelle}</h3>
                  {metier.Enjeux && metier.Enjeux.length > 0 && <p className="text-sm text-gray-500 dark:text-gray-400">{metier.Enjeux.slice(0, 3).map((enjeu) => enjeu.libelle).join(' • ')}</p>}
                </div>
              </div>
              <div className="flex items-center gap-4">
                <span className="text-sm text-gray-500 dark:text-gray-400">{totalCompetences} {t('marketRadar.metiers.card.competences')}</span>
                {isExpanded ? <ChevronUpIcon className="h-5 w-5 text-gray-400" /> : <ChevronDownIcon className="h-5 w-5 text-gray-400" />}
              </div>
            </button>

            {isExpanded && <MetierCardDetails metier={metier} />}
          </div>
        );
      })}

      <Pagination currentPage={currentPage} totalPages={totalPages} totalCount={totalCount} pageSize={METIERS_PAGE_SIZE} onPageChange={onPageChange} loading={loading} itemName={t('marketRadar.metiers.results')} />
    </div>
  );
}


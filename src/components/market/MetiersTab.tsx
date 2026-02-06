/**
 * MetiersTab - Métiers et Compétences Tab for Market Radar
 * Interface for querying Rome 4.0 API and managing IT métiers
 */

import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../context/AuthContext';
import { createLogger } from '../../utils/logger.frontend';

const log = createLogger('MetiersTab');

import {
  getStoredMetiersPaginated,
  collectITMetiers,
  getMetiersStats,
  Metier,
  CollectionSummary,
  MetiersResponse,
  MetiersStats
} from '../../services/romeService';
import {
  MagnifyingGlassIcon,
  ArrowPathIcon,
  BriefcaseIcon,
  AcademicCapIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  XMarkIcon
} from '@heroicons/react/24/outline';
import Pagination from '../Pagination';
import { formatDateTime } from '../../utils/dateFormatter';

interface MetiersTabProps {
  className?: string;
}

export default function MetiersTab({ className = '' }: MetiersTabProps) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';

  // State
  const [metiers, setMetiers] = useState<Metier[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedMetiers, setExpandedMetiers] = useState<Set<string>>(new Set());
  
  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const pageSize = 20;
  
  // Collection state
  const [collecting, setCollecting] = useState(false);
  const [collectionResult, setCollectionResult] = useState<CollectionSummary | null>(null);
  
  // Global stats
  const [globalStats, setGlobalStats] = useState<MetiersStats | null>(null);

  // Load global stats on mount
  useEffect(() => {
    loadGlobalStats();
  }, []);

  // Load stored métiers when page or search changes
  useEffect(() => {
    loadMetiers();
  }, [currentPage, searchQuery]);

  const loadGlobalStats = async () => {
    try {
      const stats = await getMetiersStats();
      setGlobalStats(stats);
    } catch (err) {
      log.warn('Failed to load global stats', { error: err instanceof Error ? err.message : String(err) });
    }
  };

  const loadMetiers = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await getStoredMetiersPaginated({
        search: searchQuery || undefined,
        page: currentPage,
        pageSize
      });
      setMetiers(response.metiers);
      setTotalCount(response.totalCount);
      if (response.pagination) {
        setTotalPages(response.pagination.totalPages);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : t('marketRadar.errors.loadFailed'));
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    setCurrentPage(1); // Reset to first page on new search
  };

  const handleCollect = async () => {
    if (!isAdmin) return;
    
    try {
      setCollecting(true);
      setError(null);
      setCollectionResult(null);
      
      const result = await collectITMetiers();
      setCollectionResult(result);
      
      // Reload métiers and global stats after collection
      await Promise.all([loadMetiers(), loadGlobalStats()]);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('marketRadar.facts.collection.error'));
    } finally {
      setCollecting(false);
    }
  };

  const toggleMetierExpand = (codeRome: string) => {
    const newExpanded = new Set(expandedMetiers);
    if (newExpanded.has(codeRome)) {
      newExpanded.delete(codeRome);
    } else {
      newExpanded.add(codeRome);
    }
    setExpandedMetiers(newExpanded);
  };

  const clearSearch = () => {
    setSearchQuery('');
    setCurrentPage(1);
  };

  return (
    <>
      {/* Full-screen overlay during collection */}
      {collecting && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl p-8 max-w-md mx-4 text-center">
            <ArrowPathIcon className="h-16 w-16 text-indigo-600 dark:text-indigo-400 animate-spin mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
              {t('marketRadar.metiers.collection.title')}
            </h3>
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              {t('marketRadar.metiers.collection.description')}
            </p>
            <p className="text-sm text-orange-600 dark:text-orange-400 font-medium">
              {t('marketRadar.metiers.collection.warning')}
            </p>
            <div className="mt-4 w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 overflow-hidden">
              <div 
                className="bg-indigo-600 h-2 rounded-full"
                style={{
                  width: '30%',
                  animation: 'indeterminate 1.5s ease-in-out infinite'
                }}
              />
            </div>
            <style>{`
              @keyframes indeterminate {
                0% { transform: translateX(-100%); }
                100% { transform: translateX(400%); }
              }
            `}</style>
          </div>
        </div>
      )}

      <div className={`space-y-6 ${className}`}>
        {/* Header with Collection Button */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                <BriefcaseIcon className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
                {t('marketRadar.metiers.title')}
              </h2>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                {t('marketRadar.metiers.subtitle')}
              </p>
            </div>
            
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  loadMetiers();
                  loadGlobalStats();
                }}
                disabled={loading}
                className="inline-flex items-center px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
                title={t('marketRadar.metiers.refresh')}
              >
                <ArrowPathIcon className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              </button>
              
              {isAdmin && (
                <button
                  onClick={handleCollect}
                  disabled={collecting}
                  className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {collecting ? (
                    <ArrowPathIcon className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <ArrowPathIcon className="h-4 w-4 mr-2" />
                  )}
                  {t('marketRadar.metiers.collection.button')}
                </button>
              )}
            </div>
          </div>

          {/* Collection Result */}
          {collectionResult && (
            <div className="mt-4 p-4 bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-800 rounded-md">
              <div className="flex items-start">
                <CheckCircleIcon className="h-5 w-5 text-green-500 dark:text-green-400 mt-0.5" />
                <div className="ml-3 flex-1">
                  <h3 className="text-sm font-medium text-green-800 dark:text-green-300">
                    {t('marketRadar.metiers.collection.success')}
                  </h3>
                  <p className="text-sm text-green-700 dark:text-green-400 mt-1">
                    {collectionResult.total} {t('marketRadar.metiers.collection.processed')} : {collectionResult.created} {t('marketRadar.metiers.collection.created')}, {collectionResult.updated} {t('marketRadar.metiers.collection.updated')}, {collectionResult.failed} {t('marketRadar.metiers.collection.errors')}
                  </p>
                </div>
                <button
                  onClick={() => setCollectionResult(null)}
                  className="text-green-600 dark:text-green-400 hover:text-green-800 dark:hover:text-green-200"
                >
                  <XMarkIcon className="h-5 w-5" />
                </button>
              </div>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="mt-4 p-4 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-md">
              <div className="flex items-start">
                <ExclamationTriangleIcon className="h-5 w-5 text-red-500 dark:text-red-400 mt-0.5" />
                <div className="ml-3 flex-1">
                  <p className="text-sm text-red-700 dark:text-red-400">{error}</p>
                </div>
                <button
                  onClick={() => setError(null)}
                  className="text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-200"
                >
                  <XMarkIcon className="h-5 w-5" />
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Search */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4">
          <form onSubmit={handleSearch} className="flex gap-3">
            <div className="relative flex-1">
              <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={t('marketRadar.metiers.searchPlaceholder')}
                className="w-full pl-10 pr-10 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={clearSearch}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                >
                  <XMarkIcon className="h-5 w-5" />
                </button>
              )}
            </div>
            <button
              type="submit"
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors text-sm"
            >
              Rechercher
            </button>
            {searchQuery && (
              <button
                type="button"
                onClick={clearSearch}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
              >
                {t('common.resetFilters')}
              </button>
            )}
          </form>
        </div>

        {/* Stats - Global totals */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-indigo-100 dark:bg-indigo-900/30 rounded-lg">
                <BriefcaseIcon className="h-6 w-6 text-indigo-600 dark:text-indigo-400" />
              </div>
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">{t('marketRadar.metiers.stats.totalMetiers')}</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                  {globalStats?.totalMetiers ?? totalCount}
                </p>
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
                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                  {globalStats?.totalCompetences ?? '-'}
                </p>
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
                <p className="text-lg font-semibold text-gray-900 dark:text-white">
                  {formatDateTime(globalStats?.lastUpdated || metiers[0]?.LastUpdated) || '-'}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Métiers List */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <ArrowPathIcon className="h-8 w-8 text-indigo-600 dark:text-indigo-400 animate-spin" />
            <span className="ml-3 text-gray-600 dark:text-gray-400">{t('marketRadar.metiers.loading')}</span>
          </div>
        ) : metiers.length === 0 ? (
          <div className="text-center py-12 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
            <BriefcaseIcon className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
              {t('marketRadar.metiers.noData')}
            </h3>
            <p className="text-gray-500 dark:text-gray-400 mb-4">
              {searchQuery 
                ? t('marketRadar.metiers.noDataSearch')
                : t('marketRadar.metiers.noDataEmpty')}
            </p>
            {isAdmin && !searchQuery && (
              <button
                onClick={handleCollect}
                className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors"
              >
                <ArrowPathIcon className="h-5 w-5" />
                {t('marketRadar.metiers.collection.button')}
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {/* Top Pagination */}
            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              totalCount={totalCount}
              pageSize={pageSize}
              onPageChange={setCurrentPage}
              loading={loading}
              itemName={t('marketRadar.metiers.results')}
            />

            {metiers.map((metier) => {
              const totalCompetences = (metier.CompetencesDetaillees?.length || 0) + (metier.MacroSavoirFaire?.length || 0);
              
              return (
                <div
                  key={metier.CodeRome}
                  className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden"
                >
                  {/* Métier Header */}
                  <button
                    onClick={() => toggleMetierExpand(metier.CodeRome)}
                    className="w-full px-6 py-4 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                  >
                    <div className="flex items-center gap-4">
                      <span className="px-3 py-1 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 rounded-lg font-mono font-semibold">
                        {metier.CodeRome}
                      </span>
                      <div className="text-left">
                        <h3 className="font-semibold text-gray-900 dark:text-white">
                          {metier.Libelle}
                        </h3>
                        {metier.Enjeux && metier.Enjeux.length > 0 && (
                          <p className="text-sm text-gray-500 dark:text-gray-400">
                            {metier.Enjeux.slice(0, 3).map(e => e.libelle).join(' • ')}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="text-sm text-gray-500 dark:text-gray-400">
                        {totalCompetences} {t('marketRadar.metiers.card.competences')}
                      </span>
                      {expandedMetiers.has(metier.CodeRome) ? (
                        <ChevronUpIcon className="h-5 w-5 text-gray-400" />
                      ) : (
                        <ChevronDownIcon className="h-5 w-5 text-gray-400" />
                      )}
                    </div>
                  </button>

                  {/* Métier Details */}
                  {expandedMetiers.has(metier.CodeRome) && (
                    <div className="px-6 pb-6 border-t border-gray-200 dark:border-gray-700">
                      {/* Enjeux */}
                      {metier.Enjeux && metier.Enjeux.length > 0 && (
                        <div className="mt-4">
                          <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                            {t('marketRadar.metiers.card.enjeuxDomaines')} ({metier.Enjeux.length})
                          </h4>
                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                            {metier.Enjeux.map((enjeu, idx) => (
                              <div
                                key={idx}
                                className="flex items-start gap-2 p-2 bg-indigo-50 dark:bg-indigo-900/20 rounded"
                              >
                                <BriefcaseIcon className="h-4 w-4 text-indigo-600 dark:text-indigo-400 flex-shrink-0 mt-0.5" />
                                <span className="text-sm text-gray-700 dark:text-gray-300">
                                  {enjeu.libelle}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Compétences Détaillées */}
                      {metier.CompetencesDetaillees && metier.CompetencesDetaillees.length > 0 && (
                        <div className="mt-4">
                          <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                            {t('marketRadar.metiers.card.competencesDetaillees')} ({metier.CompetencesDetaillees.length})
                          </h4>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-64 overflow-y-auto">
                            {metier.CompetencesDetaillees.map((comp, idx) => (
                              <div
                                key={idx}
                                className="flex items-start gap-2 p-2 bg-green-50 dark:bg-green-900/20 rounded"
                              >
                                <AcademicCapIcon className="h-4 w-4 text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" />
                                <div>
                                  <span className="text-sm text-gray-700 dark:text-gray-300">
                                    {comp.libelle}
                                  </span>
                                  {comp.enjeu && (
                                    <span className="block text-xs text-gray-500 dark:text-gray-400">
                                      {comp.enjeu}
                                    </span>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Macro Savoir-Faire */}
                      {metier.MacroSavoirFaire && metier.MacroSavoirFaire.length > 0 && (
                        <div className="mt-4">
                          <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                            {t('marketRadar.metiers.card.macroSavoirFaire')} ({metier.MacroSavoirFaire.length})
                          </h4>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                            {metier.MacroSavoirFaire.map((comp, idx) => (
                              <div
                                key={idx}
                                className="flex items-start gap-2 p-2 bg-blue-50 dark:bg-blue-900/20 rounded"
                              >
                                <BriefcaseIcon className="h-4 w-4 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
                                <div>
                                  <span className="text-sm text-gray-700 dark:text-gray-300">
                                    {comp.libelle}
                                  </span>
                                  {comp.enjeu && (
                                    <span className="block text-xs text-gray-500 dark:text-gray-400">
                                      {comp.enjeu}
                                    </span>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Savoirs */}
                      {metier.Savoirs && metier.Savoirs.length > 0 && (
                        <div className="mt-4">
                          <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                            {t('marketRadar.metiers.card.savoirs')} ({metier.Savoirs.length})
                          </h4>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-64 overflow-y-auto">
                            {metier.Savoirs.map((savoir, idx) => (
                              <div
                                key={idx}
                                className="flex items-start gap-2 p-2 bg-purple-50 dark:bg-purple-900/20 rounded"
                              >
                                <AcademicCapIcon className="h-4 w-4 text-purple-600 dark:text-purple-400 flex-shrink-0 mt-0.5" />
                                <div>
                                  <span className="text-sm text-gray-700 dark:text-gray-300">
                                    {savoir.libelle}
                                  </span>
                                  {savoir.categorie && (
                                    <span className="block text-xs text-gray-500 dark:text-gray-400">
                                      {savoir.categorie}
                                    </span>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Meta info */}
                      <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700 flex items-center gap-4 text-sm text-gray-500 dark:text-gray-400">
                        {metier.Obsolete && (
                          <span className="px-2 py-1 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 rounded">
                            Obsolète
                          </span>
                        )}
                        {metier.LastUpdated && (
                          <span>{t('marketRadar.metiers.card.updatedAt')}: {formatDateTime(metier.LastUpdated)}</span>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}

            {/* Bottom Pagination */}
            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              totalCount={totalCount}
              pageSize={pageSize}
              onPageChange={setCurrentPage}
              loading={loading}
              itemName={t('marketRadar.metiers.results')}
            />
          </div>
        )}
      </div>
    </>
  );
}

/**
 * Métiers et Compétences Page
 * Interface for querying Rome 4.0 API and managing IT métiers
 */

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  getStoredMetiers,
  collectITMetiers,
  Metier
} from '../services/romeService';
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
import { formatDateTime } from '../utils/dateFormatter';

export default function MetiersPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';

  // State
  const [metiers, setMetiers] = useState<Metier[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [, _setSelectedMetier] = useState<Metier | null>(null);
  const [expandedMetiers, setExpandedMetiers] = useState<Set<string>>(new Set());
  
  // Collection state
  const [collecting, setCollecting] = useState(false);
  const [collectingSuccess, setCollectingSuccess] = useState(false);

  // Load stored métiers on mount
  useEffect(() => {
    loadMetiers();
  }, []);

  const loadMetiers = async (search?: string) => {
    try {
      setLoading(true);
      setError(null);
      const data = await getStoredMetiers(search ? { search } : undefined);
      setMetiers(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur lors du chargement des métiers');
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    await loadMetiers(searchQuery);
  };

  const handleCollect = async () => {
    if (!isAdmin) return;
    
    try {
      setCollecting(true);
      setCollectingSuccess(false);
      setError(null);
      
      await collectITMetiers();
      setCollectingSuccess(true);
      setTimeout(() => navigate('/batch-jobs'), 1200);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur lors de la collecte');
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
    loadMetiers();
  };

  return (
    <>
      {/* Full-screen overlay during collection launch */}
      {collecting && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl p-8 max-w-md mx-4 text-center">
            {collectingSuccess ? (
              <>
                <CheckCircleIcon className="h-16 w-16 text-green-500 mx-auto mb-4 animate-bounce" />
                <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2">
                  Collecte lancée !
                </h3>
                <p className="text-gray-600 dark:text-gray-400">
                  Redirection vers les jobs...
                </p>
              </>
            ) : (
              <>
                <ArrowPathIcon className="h-16 w-16 text-indigo-600 dark:text-indigo-400 animate-spin mx-auto mb-4" />
                <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2">
                  Lancement de la collecte...
                </h3>
              </>
            )}
          </div>
        </div>
      )}

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-3 mb-1">
                <div className="w-1 h-8 rounded-full bg-primary-500" />
                <h1 className="text-3xl font-extrabold tracking-tight text-gray-900 dark:text-gray-100">
                  Métiers et Compétences
                </h1>
              </div>
              <p className="text-gray-500 dark:text-gray-400 ml-[1.75rem]">
                Référentiel ROME 4.0 - Informatique et Télécommunications
              </p>
            </div>
            
            {isAdmin && (
              <button
                onClick={handleCollect}
                disabled={collecting}
                className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white rounded-lg transition-colors"
              >
                <ArrowPathIcon className={`h-5 w-5 ${collecting ? 'animate-spin' : ''}`} />
                Collecter les métiers IT
              </button>
            )}
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
            <div className="flex items-start gap-3">
              <ExclamationTriangleIcon className="h-6 w-6 text-red-600 dark:text-red-400 flex-shrink-0" />
              <div>
                <h3 className="font-semibold text-red-800 dark:text-red-200">Erreur</h3>
                <p className="text-sm text-red-700 dark:text-red-300 mt-1">{error}</p>
              </div>
              <button
                onClick={() => setError(null)}
                className="ml-auto text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-200"
              >
                <XMarkIcon className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}

        {/* Search */}
        <div className="mb-6">
          <form onSubmit={handleSearch} className="flex gap-3">
            <div className="relative flex-1">
              <MagnifyingGlassIcon className="pointer-events-none absolute left-3 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Rechercher un métier (code ROME ou libellé)..."
                className="w-full rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 py-3 pl-10 pr-10 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={clearSearch}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                >
                  <XMarkIcon className="h-4 w-4" />
                </button>
              )}
            </div>
            <button
              type="submit"
              className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors"
            >
              Rechercher
            </button>
          </form>
        </div>

        {/* Stats */}
        <div className="mb-6 grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-indigo-100 dark:bg-indigo-900/30 rounded-lg">
                <BriefcaseIcon className="h-6 w-6 text-indigo-600 dark:text-indigo-400" />
              </div>
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">Métiers IT</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{metiers.length}</p>
              </div>
            </div>
          </div>
          
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg">
                <AcademicCapIcon className="h-6 w-6 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">Compétences totales</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                  {metiers.reduce((acc, m) => acc + (m.CompetencesDetaillees?.length || 0) + (m.MacroSavoirFaire?.length || 0), 0)}
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
                <p className="text-sm text-gray-500 dark:text-gray-400">Dernière MAJ</p>
                <p className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                  {formatDateTime(metiers[0]?.LastUpdated) || '-'}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Métiers List */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <ArrowPathIcon className="h-8 w-8 text-indigo-600 dark:text-indigo-400 animate-spin" />
            <span className="ml-3 text-gray-600 dark:text-gray-400">Chargement des métiers...</span>
          </div>
        ) : metiers.length === 0 ? (
          <div className="text-center py-12 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
            <BriefcaseIcon className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
              Aucun métier trouvé
            </h3>
            <p className="text-gray-500 dark:text-gray-400 mb-4">
              {searchQuery 
                ? "Aucun résultat pour cette recherche."
                : "Lancez une collecte pour récupérer les métiers IT."}
            </p>
            {isAdmin && !searchQuery && (
              <button
                onClick={handleCollect}
                className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors"
              >
                <ArrowPathIcon className="h-4 w-4" />
                Collecter les métiers IT
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-4">
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
                        <h3 className="font-semibold text-gray-900 dark:text-gray-100">
                          {metier.Libelle}
                        </h3>
                        {metier.Enjeux && metier.Enjeux.length > 0 && (
                          <p className="text-sm text-gray-500 dark:text-gray-400">
                            {metier.Enjeux.slice(0, 3).map(e => e.libelle).join(' â€¢ ')}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="text-sm text-gray-500 dark:text-gray-400">
                        {totalCompetences} compétences
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
                            Enjeux / Domaines ({metier.Enjeux.length})
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
                            Compétences Détaillées ({metier.CompetencesDetaillees.length})
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
                            Macro Savoir-Faire ({metier.MacroSavoirFaire.length})
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
                            Savoirs ({metier.Savoirs.length})
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
                          <span>Mis à jour: {formatDateTime(metier.LastUpdated)}</span>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}


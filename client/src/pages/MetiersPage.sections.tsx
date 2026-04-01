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
import type { Competence, Metier, Savoir } from '../services/romeService';
import { formatDateTime } from '../utils/dateFormatter';
import type {
  MetiersListProps,
  MetiersPageHeaderProps,
  MetiersSearchProps,
  MetiersStats,
} from './MetiersPage.types';

export const MetiersCollectionOverlay = ({
  collecting,
  collectingSuccess,
}: {
  collecting: boolean;
  collectingSuccess: boolean;
}) => {
  if (!collecting) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl p-8 max-w-md mx-4 text-center">
        {collectingSuccess ? (
          <>
            <CheckCircleIcon className="h-16 w-16 text-green-500 mx-auto mb-4 animate-bounce" />
            <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2">
              Collecte lancee !
            </h3>
            <p className="text-gray-600 dark:text-gray-400">Redirection vers les jobs...</p>
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
  );
};

export const MetiersPageHeader = ({
  isAdmin,
  collecting,
  onCollect,
}: MetiersPageHeaderProps) => (
  <div className="mb-8">
    <div className="flex items-center justify-between">
      <div>
        <div className="flex items-center gap-3 mb-1">
          <div className="w-1 h-8 rounded-full bg-primary-500" />
          <h1 className="text-3xl font-extrabold tracking-tight text-gray-900 dark:text-gray-100">
            Metiers et Competences
          </h1>
        </div>
        <p className="text-gray-500 dark:text-gray-400 ml-[1.75rem]">
          Referentiel ROME 4.0 - Informatique et Telecommunications
        </p>
      </div>

      {isAdmin && (
        <button
          onClick={onCollect}
          disabled={collecting}
          className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white rounded-lg transition-colors"
        >
          <ArrowPathIcon className={`h-5 w-5 ${collecting ? 'animate-spin' : ''}`} />
          Collecter les metiers IT
        </button>
      )}
    </div>
  </div>
);

export const MetiersErrorAlert = ({
  error,
  onClose,
}: {
  error: string | null;
  onClose: () => void;
}) => {
  if (!error) return null;

  return (
    <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
      <div className="flex items-start gap-3">
        <ExclamationTriangleIcon className="h-6 w-6 text-red-600 dark:text-red-400 flex-shrink-0" />
        <div>
          <h3 className="font-semibold text-red-800 dark:text-red-200">Erreur</h3>
          <p className="text-sm text-red-700 dark:text-red-300 mt-1">{error}</p>
        </div>
        <button
          onClick={onClose}
          className="ml-auto text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-200"
        >
          <XMarkIcon className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
};

export const MetiersSearchBar = ({
  searchQuery,
  onSearchQueryChange,
  onSearch,
  onClear,
}: MetiersSearchProps) => (
  <div className="mb-6">
    <form onSubmit={onSearch} className="flex gap-3">
      <div className="relative flex-1">
        <MagnifyingGlassIcon className="pointer-events-none absolute left-3 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => onSearchQueryChange(e.target.value)}
          placeholder="Rechercher un metier (code ROME ou libelle)..."
          className="w-full rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 py-3 pl-10 pr-10 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
        />
        {searchQuery && (
          <button
            type="button"
            onClick={onClear}
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
);

export const MetiersStatsCards = ({ stats }: { stats: MetiersStats }) => (
  <div className="mb-6 grid grid-cols-1 md:grid-cols-3 gap-4">
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
      <div className="flex items-center gap-3">
        <div className="p-2 bg-indigo-100 dark:bg-indigo-900/30 rounded-lg">
          <BriefcaseIcon className="h-6 w-6 text-indigo-600 dark:text-indigo-400" />
        </div>
        <div>
          <p className="text-sm text-gray-500 dark:text-gray-400">Metiers IT</p>
          <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{stats.metiersCount}</p>
        </div>
      </div>
    </div>

    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
      <div className="flex items-center gap-3">
        <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg">
          <AcademicCapIcon className="h-6 w-6 text-green-600 dark:text-green-400" />
        </div>
        <div>
          <p className="text-sm text-gray-500 dark:text-gray-400">Competences totales</p>
          <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{stats.competencesCount}</p>
        </div>
      </div>
    </div>

    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
      <div className="flex items-center gap-3">
        <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
          <ArrowPathIcon className="h-6 w-6 text-purple-600 dark:text-purple-400" />
        </div>
        <div>
          <p className="text-sm text-gray-500 dark:text-gray-400">Derniere MAJ</p>
          <p className="text-lg font-semibold text-gray-900 dark:text-gray-100">{stats.lastUpdated || '-'}</p>
        </div>
      </div>
    </div>
  </div>
);

const MetierSection = ({
  title,
  count,
  items,
  bgClassName,
  icon,
  secondaryField,
}: {
  title: string;
  count: number;
  items: Array<Competence | Savoir>;
  bgClassName: string;
  icon: React.ReactNode;
  secondaryField?: 'enjeu' | 'categorie';
}) => {
  if (count === 0) return null;

  const isCompetence = (item: Competence | Savoir): item is Competence => 'enjeu' in item;
  const isSavoir = (item: Competence | Savoir): item is Savoir => 'categorie' in item;

  const getSecondaryValue = (item: Competence | Savoir) => {
    if (secondaryField === 'enjeu' && isCompetence(item)) return item.enjeu;
    if (secondaryField === 'categorie' && isSavoir(item)) return item.categorie;
    return undefined;
  };

  return (
    <div className="mt-4">
      <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
        {title} ({count})
      </h4>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-64 overflow-y-auto">
        {items.map((item, index) => (
          <div key={index} className={`flex items-start gap-2 p-2 rounded ${bgClassName}`}>
            {icon}
            <div>
              <span className="text-sm text-gray-700 dark:text-gray-300">
                {item.libelle}
              </span>
              {getSecondaryValue(item) && (
                <span className="block text-xs text-gray-500 dark:text-gray-400">
                  {getSecondaryValue(item)}
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

const MetierCard = ({
  metier,
  expanded,
  onToggle,
}: {
  metier: Metier;
  expanded: boolean;
  onToggle: () => void;
}) => {
  const totalCompetences =
    (metier.CompetencesDetaillees?.length || 0) +
    (metier.MacroSavoirFaire?.length || 0);

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full px-6 py-4 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
      >
        <div className="flex items-center gap-4">
          <span className="px-3 py-1 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 rounded-lg font-mono font-semibold">
            {metier.CodeRome}
          </span>
          <div className="text-left">
            <h3 className="font-semibold text-gray-900 dark:text-gray-100">{metier.Libelle}</h3>
            {metier.Enjeux && metier.Enjeux.length > 0 && (
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {metier.Enjeux.slice(0, 3)
                  .map((enjeu) => enjeu.libelle)
                  .join(' • ')}
              </p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-sm text-gray-500 dark:text-gray-400">
            {totalCompetences} competences
          </span>
          {expanded ? (
            <ChevronUpIcon className="h-5 w-5 text-gray-400" />
          ) : (
            <ChevronDownIcon className="h-5 w-5 text-gray-400" />
          )}
        </div>
      </button>

      {expanded && (
        <div className="px-6 pb-6 border-t border-gray-200 dark:border-gray-700">
          {metier.Enjeux && metier.Enjeux.length > 0 && (
            <div className="mt-4">
              <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                Enjeux / Domaines ({metier.Enjeux.length})
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                {metier.Enjeux.map((enjeu, index) => (
                  <div
                    key={index}
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

          <MetierSection
            title="Competences Detaillees"
            count={metier.CompetencesDetaillees?.length || 0}
            items={metier.CompetencesDetaillees || []}
            bgClassName="bg-green-50 dark:bg-green-900/20"
            icon={<AcademicCapIcon className="h-4 w-4 text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" />}
            secondaryField="enjeu"
          />

          <MetierSection
            title="Macro Savoir-Faire"
            count={metier.MacroSavoirFaire?.length || 0}
            items={metier.MacroSavoirFaire || []}
            bgClassName="bg-blue-50 dark:bg-blue-900/20"
            icon={<BriefcaseIcon className="h-4 w-4 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />}
            secondaryField="enjeu"
          />

          <MetierSection
            title="Savoirs"
            count={metier.Savoirs?.length || 0}
            items={metier.Savoirs || []}
            bgClassName="bg-purple-50 dark:bg-purple-900/20"
            icon={<AcademicCapIcon className="h-4 w-4 text-purple-600 dark:text-purple-400 flex-shrink-0 mt-0.5" />}
            secondaryField="categorie"
          />

          <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700 flex items-center gap-4 text-sm text-gray-500 dark:text-gray-400">
            {metier.Obsolete && (
              <span className="px-2 py-1 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 rounded">
                Obsolete
              </span>
            )}
            {metier.LastUpdated && (
              <span>Mis a jour: {formatDateTime(metier.LastUpdated)}</span>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export const MetiersListSection = ({
  metiers,
  expandedMetiers,
  onToggle,
}: MetiersListProps) => (
  <div className="space-y-4">
    {metiers.map((metier) => (
      <MetierCard
        key={metier.CodeRome}
        metier={metier}
        expanded={expandedMetiers.has(metier.CodeRome)}
        onToggle={() => onToggle(metier.CodeRome)}
      />
    ))}
  </div>
);

export const MetiersEmptyState = ({
  isAdmin,
  searchQuery,
  onCollect,
}: {
  isAdmin: boolean;
  searchQuery: string;
  onCollect: () => void;
}) => (
  <div className="text-center py-12 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
    <BriefcaseIcon className="h-12 w-12 text-gray-400 mx-auto mb-4" />
    <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
      Aucun metier trouve
    </h3>
    <p className="text-gray-500 dark:text-gray-400 mb-4">
      {searchQuery
        ? 'Aucun resultat pour cette recherche.'
        : 'Lancez une collecte pour recuperer les metiers IT.'}
    </p>
    {isAdmin && !searchQuery && (
      <button
        onClick={onCollect}
        className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors"
      >
        <ArrowPathIcon className="h-4 w-4" />
        Collecter les metiers IT
      </button>
    )}
  </div>
);

export const MetiersLoadingState = () => (
  <div className="flex items-center justify-center py-12">
    <ArrowPathIcon className="h-8 w-8 text-indigo-600 dark:text-indigo-400 animate-spin" />
    <span className="ml-3 text-gray-600 dark:text-gray-400">Chargement des metiers...</span>
  </div>
);

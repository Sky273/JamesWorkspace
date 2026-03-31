import type { ParsedMetadata } from './marketTrends.types';

export function formatTrendNumber(value: number | string | undefined, type: string, valueType?: 'nombre' | 'montant' | 'taux') {
  if (value === undefined || value === null) return '—';
  const numValue = typeof value === 'string' ? parseFloat(value) : value;
  if (Number.isNaN(numValue)) return '—';
  if (valueType === 'montant' || type === 'salaire') return `${numValue.toLocaleString('fr-FR')} €`;
  if (valueType === 'taux' || type === 'tension') return numValue.toFixed(2);
  return numValue.toLocaleString('fr-FR');
}

export function getTrendValueColor(type: string, parsed: ParsedMetadata | null, rawValue: number | string | undefined) {
  const value = parsed?.valeurPrincipale ?? rawValue;
  if (value === undefined || value === null) return 'text-gray-500';

  switch (type) {
    case 'tension':
      if (Number(value) >= 2) return 'text-red-600 dark:text-red-400';
      if (Number(value) >= 1.5) return 'text-orange-500 dark:text-orange-400';
      if (Number(value) >= 1) return 'text-yellow-600 dark:text-yellow-400';
      return 'text-green-600 dark:text-green-400';
    case 'dynamique_emploi':
      if (Number(value) > 0) return 'text-green-600 dark:text-green-400';
      if (Number(value) < 0) return 'text-red-600 dark:text-red-400';
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
}

export function getCharacteristicDisplayValue(c: { nombre?: number; montant?: number; taux?: number; pourcentage?: number }, type: string) {
  if (c.montant !== undefined) return formatTrendNumber(c.montant, type, 'montant');
  if (c.nombre !== undefined) return formatTrendNumber(c.nombre, type, 'nombre');
  if (c.taux !== undefined) return formatTrendNumber(c.taux, type, 'taux');
  return '—';
}

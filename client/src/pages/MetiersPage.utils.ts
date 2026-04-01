import type { Metier } from '../services/romeService';
import { formatDateTime } from '../utils/dateFormatter';
import type { MetiersStats } from './MetiersPage.types';

export function buildMetiersStats(metiers: Metier[]): MetiersStats {
  return {
    metiersCount: metiers.length,
    competencesCount: metiers.reduce(
      (total, metier) =>
        total +
        (metier.CompetencesDetaillees?.length || 0) +
        (metier.MacroSavoirFaire?.length || 0),
      0,
    ),
    lastUpdated: formatDateTime(metiers[0]?.LastUpdated) || '-',
  };
}

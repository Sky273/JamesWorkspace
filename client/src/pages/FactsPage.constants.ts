import { BriefcaseIcon, ChartBarIcon, MapIcon, TableCellsIcon } from '@heroicons/react/24/outline';
import type { TabType } from './FactsPage.hooks';

export const FACTS_TAB_OPTIONS = [
  { value: 'map', labelKey: 'marketRadar.tabs.map', icon: MapIcon },
  { value: 'trends', labelKey: 'marketRadar.tabs.trends', icon: ChartBarIcon },
  { value: 'data', labelKey: 'marketRadar.tabs.facts', icon: TableCellsIcon },
  { value: 'metiers', labelKey: 'marketRadar.tabs.metiers', icon: BriefcaseIcon },
] as const satisfies ReadonlyArray<{ value: TabType; labelKey: string; icon: typeof MapIcon }>;

export const DEFAULT_FACTS_TAB: TabType = FACTS_TAB_OPTIONS[0].value;

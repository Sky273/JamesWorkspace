import type { Metier } from '../services/romeService';

export interface MetiersStats {
  metiersCount: number;
  competencesCount: number;
  lastUpdated: string;
}

export interface MetiersPageHeaderProps {
  isAdmin: boolean;
  collecting: boolean;
  onCollect: () => void;
}

export interface MetiersSearchProps {
  searchQuery: string;
  onSearchQueryChange: (value: string) => void;
  onSearch: (event: React.FormEvent) => void;
  onClear: () => void;
}

export interface MetiersListProps {
  metiers: Metier[];
  expandedMetiers: Set<string>;
  onToggle: (codeRome: string) => void;
}

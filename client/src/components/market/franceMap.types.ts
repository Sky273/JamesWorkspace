/**
 * Types, constants and helpers for FranceMapTab
 * Extracted from FranceMapTab.tsx
 */

import {
  BriefcaseIcon,
  ExclamationTriangleIcon,
  ArrowTrendingUpIcon,
  UserGroupIcon,
  ChartBarIcon
} from '@heroicons/react/24/outline';
import type { Map as MaplibreMap } from 'maplibre-gl';

// Data source types
export type DataSourceType = 'all' | 'offres' | 'tension' | 'salaire' | 'dynamique_emploi' | 'embauche' | 'demandeur' | 'demandeur_entrant';

export const DATA_SOURCE_OPTIONS: { value: DataSourceType; label: string; icon: typeof ChartBarIcon; color: string }[] = [
  { value: 'offres', label: 'Offres d\'emploi', icon: BriefcaseIcon, color: 'indigo' },
  { value: 'tension', label: 'Tensions recrutement', icon: ExclamationTriangleIcon, color: 'red' },
  // Salaire excluded - no geographic dimension (national level only)
  { value: 'dynamique_emploi', label: 'Dynamique emploi', icon: ArrowTrendingUpIcon, color: 'blue' },
  { value: 'embauche', label: 'Embauches', icon: BriefcaseIcon, color: 'teal' },
  { value: 'demandeur', label: 'Demandeurs d\'emploi', icon: UserGroupIcon, color: 'purple' },
  { value: 'demandeur_entrant', label: 'Nouveaux demandeurs', icon: UserGroupIcon, color: 'violet' }
];

// French regions with their coordinates for markers (longitude, latitude)
export const REGIONS_INFO: Record<string, { coords: [number, number]; name: string }> = {
  '84': { coords: [5.0, 45.5], name: 'Auvergne-Rhône-Alpes' },
  '27': { coords: [5.0, 47.2], name: 'Bourgogne-Franche-Comté' },
  '53': { coords: [-3.0, 48.2], name: 'Bretagne' },
  '24': { coords: [1.5, 47.2], name: 'Centre-Val de Loire' },
  '94': { coords: [9.0, 42.0], name: 'Corse' },
  '44': { coords: [6.0, 48.5], name: 'Grand Est' },
  '32': { coords: [3.0, 49.8], name: 'Hauts-de-France' },
  '11': { coords: [2.5, 48.8], name: 'Île-de-France' },
  '28': { coords: [0.0, 49.0], name: 'Normandie' },
  '75': { coords: [0.0, 45.5], name: 'Nouvelle-Aquitaine' },
  '76': { coords: [2.0, 43.5], name: 'Occitanie' },
  '52': { coords: [-1.0, 47.2], name: 'Pays de la Loire' },
  '93': { coords: [6.0, 43.8], name: "Provence-Alpes-Côte d'Azur" }
};

export interface RegionData {
  code: string;
  name: string;
  totalJobs: number;
  value: number;
  romeBreakdown: Record<string, number>;
  coords: [number, number];
}

export interface TrendRegionData {
  code: string;
  name: string;
  value: number;
  count: number;
  romeBreakdown: Record<string, { value: number; count: number; label?: string }>;
  coords: [number, number];
}

export interface MultiTypeRegionData {
  regionCode: string;
  regionName: string;
  coords: [number, number];
  typeData: Array<{
    type: DataSourceType;
    value: number;
    count: number;
    color: string;
    label: string;
  }>;
}

// Map styles for light and dark modes
export const MAP_STYLES = {
  light: 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json',
  dark: 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json'
};

// French region name mappings (English/default -> French)
export const FRENCH_REGION_NAMES: Record<string, string> = {
  // Régions métropolitaines
  'UPPER FRANCE': 'HAUTS-DE-FRANCE',
  'Upper France': 'Hauts-de-France',
  'HAUTS-DE-FRANCE': 'HAUTS-DE-FRANCE',
  'NORMANDY': 'NORMANDIE',
  'Normandy': 'Normandie',
  'BRITTANY': 'BRETAGNE',
  'Brittany': 'Bretagne',
  'PAYS OF THE LOIRE': 'PAYS DE LA LOIRE',
  'Pays of the Loire': 'Pays de la Loire',
  'PAYS DE LA LOIRE': 'PAYS DE LA LOIRE',
  'CENTRE-LOIRE VALLEY': 'CENTRE-VAL DE LOIRE',
  'Centre-Loire Valley': 'Centre-Val de Loire',
  'CENTRE-VAL DE LOIRE': 'CENTRE-VAL DE LOIRE',
  'BURGUNDY-FREE COUNTY': 'BOURGOGNE-FRANCHE-COMTÉ',
  'Burgundy-Free County': 'Bourgogne-Franche-Comté',
  'BOURGOGNE-FRANCHE-COMTÉ': 'BOURGOGNE-FRANCHE-COMTÉ',
  'GRAND EAST': 'GRAND EST',
  'Grand East': 'Grand Est',
  'GREATER EAST': 'GRAND EST',
  'Greater East': 'Grand Est',
  'GRAND EST': 'GRAND EST',
  'NEW AQUITANIA': 'NOUVELLE-AQUITAINE',
  'New Aquitania': 'Nouvelle-Aquitaine',
  'NEW AQUITAINE': 'NOUVELLE-AQUITAINE',
  'New Aquitaine': 'Nouvelle-Aquitaine',
  'NOUVELLE-AQUITAINE': 'NOUVELLE-AQUITAINE',
  'OCCITANIA': 'OCCITANIE',
  'Occitania': 'Occitanie',
  'OCCITANIE': 'OCCITANIE',
  'AUVERGNE-RHÔNE-ALPES': 'AUVERGNE-RHÔNE-ALPES',
  'Auvergne-Rhône-Alpes': 'Auvergne-Rhône-Alpes',
  'PROVENCE-ALPES-CÔTE D\'AZUR': 'PROVENCE-ALPES-CÔTE D\'AZUR',
  'Provence-Alpes-Côte d\'Azur': 'Provence-Alpes-Côte d\'Azur',
  'CORSICA': 'CORSE',
  'Corsica': 'Corse',
  'CORSE': 'CORSE',
  'Corse': 'Corse',
  'COLLECTIVITÉ DE CORSE': 'CORSE',
  'Collectivité de Corse': 'Corse',
  'TERRITORIAL COLLECTIVITY OF CORSICA': 'CORSE',
  'Territorial Collectivity of Corsica': 'Corse',
  'COLLECTIVITY OF CORSICA': 'CORSE',
  'Collectivity of Corsica': 'Corse',
  'ÎLE-DE-FRANCE': 'ÎLE-DE-FRANCE',
  'Île-de-France': 'Île-de-France',
  'ILE-DE-FRANCE': 'ÎLE-DE-FRANCE',
  'Ile-de-France': 'Île-de-France',
  // Régions d'outre-mer
  'FRENCH GUIANA': 'GUYANE',
  'French Guiana': 'Guyane',
  'GUADELOUPE': 'GUADELOUPE',
  'MARTINIQUE': 'MARTINIQUE',
  'RÉUNION': 'LA RÉUNION',
  'Réunion': 'La Réunion',
  'REUNION': 'LA RÉUNION',
  'Reunion': 'La Réunion',
  'MAYOTTE': 'MAYOTTE',
  // Villes principales (au cas où)
  'FRANCE': 'FRANCE',
  'France': 'France',
};

// Function to set French labels on map load
export const setFrenchLabels = (map: MaplibreMap) => {
  const style = map.getStyle();
  if (!style || !style.layers) return;

  type LabelLayer = {
    id: string;
    layout?: Record<string, unknown>;
  };

  (style.layers as LabelLayer[]).forEach((layer) => {
    // Find text layers that use 'name' property
    if (layer.layout && layer.layout['text-field']) {
      // Use a case expression to replace known English region names with French
      // First try name:fr, then check our mapping, then fallback to original name
      const frenchNameExpression = [
        'coalesce',
        ['get', 'name:fr'],
        // Use case expression to map English names to French
        ['case',
          ...Object.entries(FRENCH_REGION_NAMES).flatMap(([en, fr]) => [
            ['==', ['get', 'name'], en], fr
          ]),
          ['get', 'name'] // default fallback
        ]
      ];
      
      map.setLayoutProperty(layer.id, 'text-field', frenchNameExpression);
    }
  });
};

/**
 * MarketTrendsTab - Type definitions and constants
 */

import {
  ChartBarIcon,
  BriefcaseIcon,
  CurrencyEuroIcon,
  ExclamationTriangleIcon,
  ArrowTrendingUpIcon
} from '@heroicons/react/24/outline';

// ============================================
// Constants
// ============================================

export type TrendType = 'all' | 'tension' | 'salaire' | 'dynamique_emploi' | 'embauche';

export const TREND_TYPE_LABELS: Record<string, string> = {
  'tension': 'Tensions recrutement',
  'salaire': 'Salaires',
  'dynamique_emploi': 'Dynamique emploi',
  'embauche': 'Embauches',
  'offre': 'Offres d\'emploi',
  'demandeur': 'Demandeurs d\'emploi',
  'demandeur_entrant': 'Nouveaux demandeurs'
};

export const TREND_TYPE_ICONS: Record<string, typeof ChartBarIcon> = {
  'tension': ExclamationTriangleIcon,
  'salaire': CurrencyEuroIcon,
  'dynamique_emploi': ArrowTrendingUpIcon,
  'embauche': BriefcaseIcon,
  'offre': BriefcaseIcon,
  'demandeur': ChartBarIcon,
  'demandeur_entrant': ArrowTrendingUpIcon
};

// ============================================
// Interfaces
// ============================================

export interface MarketTrendsTabProps {
  className?: string;
}

// Parse metadata from France Travail API response
export interface CaracteristiqueData {
  libCaract?: string;
  codeCaract?: string;
  codeTypeCaract?: string;
  nombre?: number;
  pourcentage?: number;
  montant?: number;
  taux?: number;
}

export interface SalaireValeurMontant {
  codeNomenclature?: string; // SAL1 = débutant, SAL2 = expérimenté, SAL3 = moyen
  valeurPrincipaleMontant?: number;
}

export interface SalairePeriodeData {
  datMaj?: string;
  codeActivite?: string;
  libActivite?: string;
  codeTypePeriode?: string;
  codePeriode?: string;
  libPeriode?: string;
  salaireValeurMontant?: SalaireValeurMontant[];
}

export interface PeriodeData {
  codePeriode?: string;
  libPeriode?: string;
  libTerritoire?: string;
  codeTerritoire?: string;
  libActivite?: string;
  codeActivite?: string;
  codeNomenclature?: string;
  libNomenclature?: string;
  valeurPrincipaleNombre?: number;
  valeurPrincipaleMontant?: number;
  valeurPrincipaleTaux?: number;
  valeurPrincipaleDecimale?: number;
  valeurSecondairePourcentage?: number;
  valeurSecondarieNombre?: number;
  valeurSecondaireMontant?: number;
  listeValeurParCaract?: CaracteristiqueData[];
  datMaj?: string;
  codeTypePeriode?: string;
  codeTypeActivite?: string;
  codeTypeTerritoire?: string;
}

// Salary breakdown by activity type
export interface SalaireActivite {
  codeActivite: string;
  libActivite: string;
  periode?: string;
  salaireDebutant?: number;  // SAL1
  salaireExperimente?: number;  // SAL2
  salaireMoyen?: number;  // SAL3
}

export interface ParsedMetadata {
  // Common fields
  indicateur?: string;
  codeIndicateur?: string;
  territoire?: string;
  activite?: string;
  periode?: string;
  nomenclature?: string;
  
  // Values
  valeurPrincipale?: number;
  valeurPrincipaleType?: 'nombre' | 'montant' | 'taux';
  valeurSecondaire?: number;
  valeurSecondarieType?: 'pourcentage' | 'nombre' | 'montant';
  
  // Breakdown by characteristics
  caracteristiques?: Array<{
    label: string;
    nombre?: number;
    montant?: number;
    taux?: number;
    pourcentage?: number;
  }>;
  
  // Type-specific parsed data
  typeSpecific?: {
    // Tension - detailed indicators
    tensionLevel?: string;
    tensionColor?: string;
    tensionIndicators?: TensionIndicator[];
    
    // Salaire - detailed breakdown by activity
    salairesParActivite?: SalaireActivite[];
    salaireMin?: number;
    salaireMax?: number;
    salaireMedian?: number;
    
    // Embauche / Offre / Demandeur - detailed breakdown
    totalCount?: number;
    evolutionPercent?: number;
    embaucheDetails?: EmbaucheDetails;
    
    // Dynamique emploi
    tendance?: 'hausse' | 'baisse' | 'stable';
    tendanceLabel?: string;
    tendanceDescription?: string;
    dynamiqueDetails?: {
      territoire?: string;
      codeTerritoire?: string;
      activite?: string;
      periode?: string;
      codePeriode?: string;
      dateMaj?: string;
      dateMajGlobale?: string;
    };
  };
}

// Tension indicator structure
export interface TensionIndicator {
  code: string;
  label: string;
  value: number;
  decimal: number;
  color: string;
}

// Embauche details structure
export interface EmbaucheDetails {
  genre?: { hommes: number; femmes: number };
  contrats?: { cdi: number; cdd: number; autres: number };
  qualification?: { cadres: number; techniciens: number; employes: number };
  experience?: { debutant: number; experimente: number };
  age?: { jeunes: number; adultes: number; seniors: number };
  formation?: { sansQualif: number; bac: number; bacPlus: number };
  periode?: string;
  territoire?: string;
  // Detailed characteristics for demandeur display
  caracteristiquesDetaillees?: CaracteristiqueAffichage[];
}

// Structure for displaying detailed characteristics
export interface CaracteristiqueAffichage {
  label: string;
  nombre: number;
  pourcentage: number;
  type: string;
}

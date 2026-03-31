export interface PeriodeData {
  libPeriode?: string;
  libActivite?: string;
  libNomenclature?: string;
  codeNomenclature?: string;
  libTerritoire?: string;
  codeTerritoire?: string;
  codePeriode?: string;
  datMaj?: string;
  valeurPrincipaleNombre?: number;
  valeurPrincipaleMontant?: number;
  valeurPrincipaleTaux?: number;
  valeurPrincipaleDecimale?: number;
  valeurSecondairePourcentage?: number;
  valeurSecondarieNombre?: number;
  valeurSecondaireMontant?: number;
  listeValeurParCaract?: CaracteristiqueData[];
  codeTypePeriode?: string;
  codeTypeActivite?: string;
  codeTypeTerritoire?: string;
}

export interface CaracteristiqueData {
  codeCaract?: string;
  libCaract?: string;
  codeTypeCaract?: string;
  nombre?: number;
  montant?: number;
  taux?: number;
  pourcentage?: number;
}

export interface SalairePeriodeData {
  codeActivite?: string;
  libActivite?: string;
  libPeriode?: string;
  salaireValeurMontant?: Array<{
    codeNomenclature?: string;
    valeurPrincipaleMontant?: number;
  }>;
}

export interface SalaireActivite {
  codeActivite: string;
  libActivite: string;
  periode?: string;
  salaireDebutant?: number;
  salaireExperimente?: number;
  salaireMoyen?: number;
}

export interface TensionIndicator {
  code: string;
  label: string;
  value: number;
  decimal: number;
  color: string;
}

export interface AgeBreakdown {
  label: string;
  value: number;
}

export interface EmbaucheDetails {
  genre?: { hommes: number; femmes: number; hommesNombre?: number; femmesNombre?: number };
  contrats?: { cdi: number; cdd: number; autres: number };
  qualification?: { cadres: number; techniciens: number; employes: number; ouvriers?: number };
  experience?: { debutant: number; experimente: number };
  age?: { jeunes: number; adultes: number; seniors: number };
  ageDetaille?: AgeBreakdown[];
  formation?: { sansQualif: number; bac: number; bacPlus: number };
  formationDetaille?: AgeBreakdown[];
  periode?: string;
  territoire?: string;
  pourcentageTotal?: number;
}

export interface ParsedMetadata {
  indicateur?: string;
  codeIndicateur?: string;
  territoire?: string;
  activite?: string;
  periode?: string;
  nomenclature?: string;
  valeurPrincipale?: number;
  valeurPrincipaleType?: 'nombre' | 'montant' | 'taux';
  valeurSecondaire?: number;
  valeurSecondarieType?: 'pourcentage' | 'nombre' | 'montant';
  caracteristiques?: Array<{
    label: string;
    nombre?: number;
    montant?: number;
    taux?: number;
    pourcentage?: number;
  }>;
  typeSpecific?: {
    tensionLevel?: string;
    tensionColor?: string;
    tensionIndicators?: TensionIndicator[];
    salairesParActivite?: SalaireActivite[];
    salaireMin?: number;
    salaireMax?: number;
    salaireMedian?: number;
    totalCount?: number;
    evolutionPercent?: number;
    embaucheDetails?: EmbaucheDetails;
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

export interface TrendMetadataDisplayProps {
  metadata: Record<string, unknown> | string | null;
  type: string;
  value?: number | string | null;
  compact?: boolean;
  className?: string;
}

/**
 * MarketTrendsTab - Market Trends Analysis for Market Radar
 * Displays labor market trends from France Travail Marché du Travail API
 * - Hiring data by job type and sector
 * - Employment dynamics indicator
 * - Recruitment difficulties
 * - Proposed salaries by job
 * - AI dynamism indicator
 */

import { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import {
  ArrowPathIcon,
  ArrowTrendingUpIcon,
  ArrowTrendingDownIcon,
  ChartBarIcon,
  BriefcaseIcon,
  CurrencyEuroIcon,
  MapPinIcon,
  ExclamationTriangleIcon,
  SparklesIcon
} from '@heroicons/react/24/outline';
import Pagination from '../Pagination';
import { formatDate } from '../../utils/dateFormatter';
import {
  getTrends,
  getTrendsSummary,
  getTrendFilters,
  triggerTrendsCollection,
  triggerDynamicsCollection,
  MarketTrend,
  TrendsSummary,
  TrendFilters
} from '../../services/marketRadarService';
import { getStoredMetiers, Metier } from '../../services/romeService';

interface MarketTrendsTabProps {
  className?: string;
}

type TrendType = 'all' | 'tension' | 'salaire' | 'dynamique_emploi' | 'embauche';

const TREND_TYPE_LABELS: Record<string, string> = {
  'tension': 'Tensions recrutement',
  'salaire': 'Salaires',
  'dynamique_emploi': 'Dynamique emploi',
  'embauche': 'Embauches',
  'offre': 'Offres d\'emploi',
  'demandeur': 'Demandeurs d\'emploi',
  'demandeur_entrant': 'Nouveaux demandeurs'
};

const TREND_TYPE_ICONS: Record<string, typeof ChartBarIcon> = {
  'tension': ExclamationTriangleIcon,
  'salaire': CurrencyEuroIcon,
  'dynamique_emploi': ArrowTrendingUpIcon,
  'embauche': BriefcaseIcon,
  'offre': BriefcaseIcon,
  'demandeur': ChartBarIcon,
  'demandeur_entrant': ArrowTrendingUpIcon
};

// Parse metadata from France Travail API response
interface CaracteristiqueData {
  libCaract?: string;
  codeCaract?: string;
  codeTypeCaract?: string;
  nombre?: number;
  pourcentage?: number;
  montant?: number;
  taux?: number;
}

interface SalaireValeurMontant {
  codeNomenclature?: string; // SAL1 = débutant, SAL2 = expérimenté, SAL3 = moyen
  valeurPrincipaleMontant?: number;
}

interface SalairePeriodeData {
  datMaj?: string;
  codeActivite?: string;
  libActivite?: string;
  codeTypePeriode?: string;
  codePeriode?: string;
  libPeriode?: string;
  salaireValeurMontant?: SalaireValeurMontant[];
}

interface PeriodeData {
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
interface SalaireActivite {
  codeActivite: string;
  libActivite: string;
  periode?: string;
  salaireDebutant?: number;  // SAL1
  salaireExperimente?: number;  // SAL2
  salaireMoyen?: number;  // SAL3
}

interface ParsedMetadata {
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
interface TensionIndicator {
  code: string;
  label: string;
  value: number;
  decimal: number;
  color: string;
}

// Embauche details structure
interface EmbaucheDetails {
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
interface CaracteristiqueAffichage {
  label: string;
  nombre: number;
  pourcentage: number;
  type: string;
}

function parseMetadata(metadata: Record<string, unknown> | string | null, type: string, trendValue?: number | string | null): ParsedMetadata | null {
  // Handle string metadata (JSON string from database)
  let parsedMeta: Record<string, unknown> = {};
  if (metadata) {
    if (typeof metadata === 'string') {
      try {
        parsedMeta = JSON.parse(metadata);
      } catch {
        // Invalid JSON, continue with empty metadata
      }
    } else {
      parsedMeta = metadata;
    }
  }
  
  const result: ParsedMetadata = {
    indicateur: parsedMeta.libIndicateur as string,
    codeIndicateur: parsedMeta.codeIndicateur as string,
    territoire: parsedMeta.libTerritoire as string,
    typeSpecific: {}
  };
  
  const periodes = parsedMeta.listeValeursParPeriode as PeriodeData[] | undefined;
  if (periodes?.length) {
    const p = periodes[0];
    result.periode = p.libPeriode;
    result.activite = p.libActivite;
    result.nomenclature = p.libNomenclature;
    
    // Extract primary value with type
    if (p.valeurPrincipaleNombre !== undefined) {
      result.valeurPrincipale = p.valeurPrincipaleNombre;
      result.valeurPrincipaleType = 'nombre';
    } else if (p.valeurPrincipaleMontant !== undefined) {
      result.valeurPrincipale = p.valeurPrincipaleMontant;
      result.valeurPrincipaleType = 'montant';
    } else if (p.valeurPrincipaleTaux !== undefined) {
      result.valeurPrincipale = p.valeurPrincipaleTaux;
      result.valeurPrincipaleType = 'taux';
    }
    
    // Extract secondary value
    if (p.valeurSecondairePourcentage !== undefined) {
      result.valeurSecondaire = p.valeurSecondairePourcentage;
      result.valeurSecondarieType = 'pourcentage';
    } else if (p.valeurSecondarieNombre !== undefined) {
      result.valeurSecondaire = p.valeurSecondarieNombre;
      result.valeurSecondarieType = 'nombre';
    } else if (p.valeurSecondaireMontant !== undefined) {
      result.valeurSecondaire = p.valeurSecondaireMontant;
      result.valeurSecondarieType = 'montant';
    }
    
    // Parse characteristics - keep all entries (API already filters relevant data)
    if (p.listeValeurParCaract?.length) {
      result.caracteristiques = p.listeValeurParCaract.map(c => ({
        label: c.libCaract || '',
        nombre: c.nombre,
        montant: c.montant,
        taux: c.taux,
        pourcentage: c.pourcentage
      }));
    }
  }
  
  // Type-specific parsing
  switch (type) {
    case 'tension':
      // Parse all tension indicators from listeValeursParPeriode
      const tensionIndicators: TensionIndicator[] = [];
      let mainTensionValue: number | undefined;
      
      if (periodes?.length) {
        periodes.forEach((p: PeriodeData) => {
          const code = p.codeNomenclature;
          const label = p.libNomenclature;
          const value = p.valeurPrincipaleNombre;
          const decimal = p.valeurPrincipaleDecimale;
          
          if (code && label && value !== undefined) {
            // Determine color based on value (1-5 scale)
            let color = 'gray';
            if (value >= 4) color = 'red';
            else if (value >= 3) color = 'orange';
            else if (value >= 2) color = 'yellow';
            else if (value >= 1) color = 'green';
            
            tensionIndicators.push({
              code,
              label,
              value,
              decimal: decimal ?? 0,
              color
            });
            
            // Extract main tension value (PERSPECTIVE indicator)
            if (code === 'PERSPECTIVE') {
              mainTensionValue = value;
            }
          }
        });
      }
      
      // Use main tension value, or fallback to trendValue
      let tensionValue = mainTensionValue ?? result.valeurPrincipale;
      if (tensionValue === undefined && trendValue !== undefined && trendValue !== null) {
        tensionValue = typeof trendValue === 'string' ? parseFloat(trendValue) : trendValue;
      }
      
      if (tensionValue !== undefined && !isNaN(tensionValue)) {
        result.valeurPrincipale = tensionValue;
        if (tensionValue >= 4) {
          result.typeSpecific!.tensionLevel = 'Très forte tension';
          result.typeSpecific!.tensionColor = 'red';
        } else if (tensionValue >= 3) {
          result.typeSpecific!.tensionLevel = 'Forte tension';
          result.typeSpecific!.tensionColor = 'orange';
        } else if (tensionValue >= 2) {
          result.typeSpecific!.tensionLevel = 'Tension modérée';
          result.typeSpecific!.tensionColor = 'yellow';
        } else if (tensionValue >= 1) {
          result.typeSpecific!.tensionLevel = 'Tension faible';
          result.typeSpecific!.tensionColor = 'green';
        } else {
          result.typeSpecific!.tensionLevel = 'Pas de tension';
          result.typeSpecific!.tensionColor = 'gray';
        }
      }
      
      // Store all indicators for detailed display
      if (tensionIndicators.length > 0) {
        result.typeSpecific!.tensionIndicators = tensionIndicators;
      }
      break;
      
    case 'salaire':
      // Parse salary data from valeursParPeriode structure
      const salairePeriodes = parsedMeta.valeursParPeriode as SalairePeriodeData[] | undefined;
      if (salairePeriodes?.length) {
        const salairesParActivite: SalaireActivite[] = [];
        const allSalaires: number[] = [];
        
        salairePeriodes.forEach(sp => {
          if (sp.libActivite && sp.salaireValeurMontant?.length) {
            const activite: SalaireActivite = {
              codeActivite: sp.codeActivite || '',
              libActivite: sp.libActivite,
              periode: sp.libPeriode
            };
            
            sp.salaireValeurMontant.forEach(sv => {
              if (sv.valeurPrincipaleMontant !== undefined) {
                allSalaires.push(sv.valeurPrincipaleMontant);
                switch (sv.codeNomenclature) {
                  case 'SAL1':
                    activite.salaireDebutant = sv.valeurPrincipaleMontant;
                    break;
                  case 'SAL2':
                    activite.salaireExperimente = sv.valeurPrincipaleMontant;
                    break;
                  case 'SAL3':
                    activite.salaireMoyen = sv.valeurPrincipaleMontant;
                    break;
                }
              }
            });
            
            salairesParActivite.push(activite);
          }
        });
        
        if (salairesParActivite.length > 0) {
          result.typeSpecific!.salairesParActivite = salairesParActivite;
        }
        
        if (allSalaires.length > 0) {
          allSalaires.sort((a, b) => a - b);
          result.typeSpecific!.salaireMin = allSalaires[0];
          result.typeSpecific!.salaireMax = allSalaires[allSalaires.length - 1];
          result.typeSpecific!.salaireMedian = allSalaires[Math.floor(allSalaires.length / 2)];
        }
      }
      // Fallback to old parsing if no valeursParPeriode
      else if (result.caracteristiques?.length) {
        const salaires = result.caracteristiques.filter(c => c.montant);
        if (salaires.length > 0) {
          const values = salaires.map(s => s.montant!).sort((a, b) => a - b);
          result.typeSpecific!.salaireMin = values[0];
          result.typeSpecific!.salaireMax = values[values.length - 1];
          if (values.length > 2) {
            result.typeSpecific!.salaireMedian = values[Math.floor(values.length / 2)];
          }
        }
      }
      break;
      
    case 'dynamique_emploi':
        // Parse dynamique emploi from dataemploi API format
        // Response: { listeValeursParPeriode: [{ valeurPrincipaleNombre, libPeriode, libTerritoire, libActivite, ... }] }
        if (periodes?.length) {
          const p = periodes[0];
          // Extract additional fields specific to dynamique emploi
          result.typeSpecific!.dynamiqueDetails = {
            territoire: p.libTerritoire as string,
            codeTerritoire: p.codeTerritoire as string,
            activite: p.libActivite as string,
            periode: p.libPeriode as string,
            codePeriode: p.codePeriode as string,
            dateMaj: p.datMaj as string
          };
        }
        
        // Also check root level for datMaj
        if (parsedMeta.datMaj) {
          if (!result.typeSpecific!.dynamiqueDetails) {
            result.typeSpecific!.dynamiqueDetails = {};
          }
          result.typeSpecific!.dynamiqueDetails.dateMajGlobale = parsedMeta.datMaj as string;
        }
        
        // Use valeurPrincipale from metadata, or fallback to trendValue
        let dynamiqueValue = result.valeurPrincipale;
        if (dynamiqueValue === undefined && trendValue !== undefined && trendValue !== null) {
          dynamiqueValue = typeof trendValue === 'string' ? parseFloat(trendValue) : trendValue;
          result.valeurPrincipale = dynamiqueValue;
        }
        
        // Interpret the value (1 = positive dynamics, 0 = negative, etc.)
        if (dynamiqueValue !== undefined && !isNaN(dynamiqueValue)) {
          if (dynamiqueValue >= 1) {
            result.typeSpecific!.tendance = 'hausse';
            result.typeSpecific!.tendanceLabel = 'Dynamique positive';
            result.typeSpecific!.tendanceDescription = 'Le marché de l\'emploi est en croissance';
          } else if (dynamiqueValue <= 0) {
            result.typeSpecific!.tendance = 'baisse';
            result.typeSpecific!.tendanceLabel = 'Dynamique négative';
            result.typeSpecific!.tendanceDescription = 'Le marché de l\'emploi est en recul';
          } else {
            result.typeSpecific!.tendance = 'stable';
            result.typeSpecific!.tendanceLabel = 'Dynamique stable';
            result.typeSpecific!.tendanceDescription = 'Le marché de l\'emploi est stable';
          }
        }
        break;
      
    case 'embauche':
    case 'offre':
    case 'demandeur':
    case 'demandeur_entrant':
      // Use valeurPrincipale from metadata, or fallback to trendValue
      let countValue = result.valeurPrincipale;
      if (countValue === undefined && trendValue !== undefined && trendValue !== null) {
        countValue = typeof trendValue === 'string' ? parseFloat(trendValue) : trendValue;
        result.valeurPrincipale = countValue;
      }
      result.typeSpecific!.totalCount = countValue;
      if (result.valeurSecondaire !== undefined && result.valeurSecondarieType === 'pourcentage') {
        result.typeSpecific!.evolutionPercent = result.valeurSecondaire;
      }
      
      // Parse detailed characteristics from listeValeurParCaract
      if (periodes?.length) {
        const firstPeriode = periodes[0];
        const caracts = firstPeriode.listeValeurParCaract;
        
        if (caracts?.length) {
          const embaucheDetails: EmbaucheDetails = {
            periode: firstPeriode.libPeriode,
            territoire: firstPeriode.libTerritoire
          };
          
          // Extract genre breakdown
          const hommes = caracts.find((c: CaracteristiqueData) => c.codeCaract === 'H');
          const femmes = caracts.find((c: CaracteristiqueData) => c.codeCaract === 'F');
          if (hommes || femmes) {
            embaucheDetails.genre = {
              hommes: hommes?.pourcentage || 0,
              femmes: femmes?.pourcentage || 0
            };
          }
          
          // Extract contract type breakdown
          const cdi = caracts.find((c: CaracteristiqueData) => c.codeCaract === 'CDI');
          const cdd1 = caracts.find((c: CaracteristiqueData) => c.codeCaract === 'CDD1');
          const cdd2 = caracts.find((c: CaracteristiqueData) => c.codeCaract === 'CDD2');
          const cdd3 = caracts.find((c: CaracteristiqueData) => c.codeCaract === 'CDD3');
          const autres = caracts.find((c: CaracteristiqueData) => c.codeCaract === 'AUTR');
          if (cdi || cdd1 || cdd2 || cdd3 || autres) {
            embaucheDetails.contrats = {
              cdi: cdi?.pourcentage || 0,
              cdd: (cdd1?.pourcentage || 0) + (cdd2?.pourcentage || 0) + (cdd3?.pourcentage || 0),
              autres: autres?.pourcentage || 0
            };
          }
          
          // Extract qualification breakdown
          const cadres = caracts.find((c: CaracteristiqueData) => c.codeCaract === 'CADRE');
          const tech = caracts.find((c: CaracteristiqueData) => c.codeCaract === 'TECH');
          const eq = caracts.find((c: CaracteristiqueData) => c.codeCaract === 'EQ');
          const enq = caracts.find((c: CaracteristiqueData) => c.codeCaract === 'ENQ');
          if (cadres || tech || eq || enq) {
            embaucheDetails.qualification = {
              cadres: cadres?.pourcentage || 0,
              techniciens: tech?.pourcentage || 0,
              employes: (eq?.pourcentage || 0) + (enq?.pourcentage || 0)
            };
          }
          
          // Extract experience breakdown
          const exp2 = caracts.find((c: CaracteristiqueData) => c.codeCaract === 'EXP2'); // < 1 an
          const exp3 = caracts.find((c: CaracteristiqueData) => c.codeCaract === 'EXP3'); // 1-2 ans
          const exp4 = caracts.find((c: CaracteristiqueData) => c.codeCaract === 'EXP4'); // 2-4 ans
          const exp5 = caracts.find((c: CaracteristiqueData) => c.codeCaract === 'EXP5'); // 4+ ans
          if (exp2 || exp3 || exp4 || exp5) {
            embaucheDetails.experience = {
              debutant: (exp2?.pourcentage || 0) + (exp3?.pourcentage || 0),
              experimente: (exp4?.pourcentage || 0) + (exp5?.pourcentage || 0)
            };
          }
          
          // Extract age breakdown (for demandeur_entrant)
          const age1 = caracts.find((c: CaracteristiqueData) => c.codeCaract === 'AGE1'); // 15-24 ans
          const age2 = caracts.find((c: CaracteristiqueData) => c.codeCaract === 'AGE2'); // 25-49 ans
          const age3 = caracts.find((c: CaracteristiqueData) => c.codeCaract === 'AGE3'); // 50 ans et +
          if (age1 || age2 || age3) {
            embaucheDetails.age = {
              jeunes: age1?.pourcentage || 0,
              adultes: age2?.pourcentage || 0,
              seniors: age3?.pourcentage || 0
            };
          }
          
          // Extract formation breakdown (for demandeur_entrant)
          const sans = caracts.find((c: CaracteristiqueData) => c.codeCaract === 'SANS');
          const capbep = caracts.find((c: CaracteristiqueData) => c.codeCaract === 'CAPBEP');
          const bac = caracts.find((c: CaracteristiqueData) => c.codeCaract === 'BAC');
          const bac2 = caracts.find((c: CaracteristiqueData) => c.codeCaract === 'BAC2');
          const bac3 = caracts.find((c: CaracteristiqueData) => c.codeCaract === 'BAC3EP');
          const bac5 = caracts.find((c: CaracteristiqueData) => c.codeCaract === 'BAC5EP');
          if (sans || capbep || bac || bac2 || bac3 || bac5) {
            embaucheDetails.formation = {
              sansQualif: (sans?.pourcentage || 0) + (capbep?.pourcentage || 0),
              bac: bac?.pourcentage || 0,
              bacPlus: (bac2?.pourcentage || 0) + (bac3?.pourcentage || 0) + (bac5?.pourcentage || 0)
            };
          }
          
          // Extract all detailed characteristics for demandeur display
          const caracteristiquesDetaillees: CaracteristiqueAffichage[] = [];
          const typesAffichage = ['GENRE', 'AGE', 'GENRExAGE'];
          caracts.forEach((c: CaracteristiqueData) => {
            if (c.libCaract && typesAffichage.includes(c.codeTypeCaract || '')) {
              caracteristiquesDetaillees.push({
                label: c.libCaract,
                nombre: c.nombre || 0,
                pourcentage: c.pourcentage || 0,
                type: c.codeTypeCaract || ''
              });
            }
          });
          if (caracteristiquesDetaillees.length > 0) {
            embaucheDetails.caracteristiquesDetaillees = caracteristiquesDetaillees;
          }
          
          result.typeSpecific!.embaucheDetails = embaucheDetails;
        }
      }
      break;
  }
  
  return result;
}

export default function MarketTrendsTab({ className = '' }: MarketTrendsTabProps) {
  const { t } = useTranslation();
  const [trends, setTrends] = useState<MarketTrend[]>([]);
  const [groupedTrends, setGroupedTrends] = useState<Record<string, MarketTrend[]> | null>(null);
  const [countsByType, setCountsByType] = useState<Record<string, number>>({});
  const [isGrouped, setIsGrouped] = useState(true);
  const [totalCount, setTotalCount] = useState(0);
  const [filters, setFilters] = useState<TrendFilters | null>(null);
  const [summary, setSummary] = useState<TrendsSummary | null>(null);
  const [metiers, setMetiers] = useState<Metier[]>([]);
  const [loading, setLoading] = useState(true);
  const [collecting, setCollecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [collectionResult, setCollectionResult] = useState<{ stored: number; created: number; updated: number; duration: number } | null>(null);
  const [filtersLoading, setFiltersLoading] = useState(true);
  
  // Server-side filters - empty means all types
  const [typeFilter, setTypeFilter] = useState<string>('');
  const [regionFilter, setRegionFilter] = useState<string>('');
  const [romeFilter, setRomeFilter] = useState<string>('');
  
  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const pageSize = 20;

  // Load filters and metiers on mount
  useEffect(() => {
    const loadInitialData = async () => {
      setFiltersLoading(true);
      try {
        // Load filters first
        const filtersResponse = await getTrendFilters();
        if (filtersResponse.filters) {
          setFilters(filtersResponse.filters);
        }
        
        // Then load summary and metiers in parallel
        const [summaryResponse, metiersData] = await Promise.all([
          getTrendsSummary(),
          getStoredMetiers()
        ]);
        setSummary(summaryResponse.summary);
        setMetiers(metiersData);
      } catch (err) {
        // Set empty filters as fallback
        setFilters({ types: [], regions: [], romeCodes: [] });
      } finally {
        setFiltersLoading(false);
      }
    };
    loadInitialData();
  }, []);

  // Load trends when filters or page change (wait for initial filters to load)
  useEffect(() => {
    // Don't load trends until filters are loaded to avoid race conditions
    if (filtersLoading) return;
    
    const loadTrends = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await getTrends({
          type: typeFilter || undefined,
          codeRome: romeFilter || undefined,
          regionCode: regionFilter || undefined,
          page: currentPage,
          pageSize
        });
        
        if (response.grouped) {
          // Grouped response (no type filter)
          setIsGrouped(true);
          setGroupedTrends(response.groupedTrends || {});
          setCountsByType(response.countsByType || {});
          setTrends([]);
          setTotalPages(1); // No pagination for grouped view
        } else {
          // Paginated response (with type filter)
          setIsGrouped(false);
          setGroupedTrends(null);
          setCountsByType({});
          setTrends(response.trends || []);
          if (response.pagination) {
            setTotalPages(response.pagination.totalPages);
          }
        }
        setTotalCount(response.totalCount);
      } catch (err) {
        setError(err instanceof Error ? err.message : t('marketRadar.errors.loadFailed'));
      } finally {
        setLoading(false);
      }
    };
    loadTrends();
  }, [filtersLoading, typeFilter, regionFilter, romeFilter, currentPage, t]);

  // Reset pagination when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [typeFilter, regionFilter, romeFilter]);

  // Create ROME labels map
  const romeLabelsMap = useMemo(() => {
    return metiers.reduce((acc, m) => {
      acc[m.CodeRome] = m.Libelle;
      return acc;
    }, {} as Record<string, string>);
  }, [metiers]);

  // Group trends by type for display
  // Use backend-grouped data when available, otherwise group locally
  const trendsByType = useMemo(() => {
    if (isGrouped && groupedTrends) {
      return groupedTrends;
    }
    // Fallback: group locally for paginated response
    const grouped: Record<string, MarketTrend[]> = {};
    trends.forEach(t => {
      if (!grouped[t.Type]) grouped[t.Type] = [];
      grouped[t.Type].push(t);
    });
    return grouped;
  }, [isGrouped, groupedTrends, trends]);

  // Handle collection (fire-and-forget)
  const handleCollect = async () => {
    setError(null);
    try {
      const result = await triggerTrendsCollection();
      toast.success(
        t('marketRadar.trends.collection.started') || 
        `Collecte lancée en arrière-plan. Durée estimée : ${result.estimatedDuration}`,
        { duration: 5000 }
      );
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erreur de lancement de la collecte';
      setError(errorMessage);
      toast.error(errorMessage);
    }
  };

  // TEMPORARY: Handle DYN_1 dynamics collection only
  const handleCollectDynamics = async () => {
    setError(null);
    try {
      const result = await triggerDynamicsCollection();
      toast.success(
        `Collecte DYN_1 (dynamique emploi) lancée. Durée estimée : ${result.estimatedDuration}`,
        { duration: 5000 }
      );
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erreur de lancement de la collecte DYN_1';
      setError(errorMessage);
      toast.error(errorMessage);
    }
  };

  if (loading && trends.length === 0) {
    return (
      <div className={`flex items-center justify-center py-12 ${className}`}>
        <ArrowPathIcon className="h-8 w-8 text-indigo-600 dark:text-indigo-400 animate-spin" />
        <span className="ml-2 text-gray-600 dark:text-gray-400">{t('marketRadar.trends.loading')}</span>
      </div>
    );
  }

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header with refresh and collect buttons */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            {t('marketRadar.trends.title')}
          </h2>
          
          <div className="flex items-center gap-2">
            <button
              onClick={async () => {
                setLoading(true);
                setError(null);
                try {
                  const [trendsResponse, summaryResponse, filtersResponse] = await Promise.all([
                    getTrends({ type: typeFilter || undefined, codeRome: romeFilter || undefined, regionCode: regionFilter || undefined, page: currentPage, pageSize }),
                    getTrendsSummary(),
                    getTrendFilters()
                  ]);
                  setTrends(trendsResponse.trends || []);
                  setTotalCount(trendsResponse.totalCount);
                  if (trendsResponse.pagination) {
                    setTotalPages(trendsResponse.pagination.totalPages);
                  }
                  setSummary(summaryResponse.summary);
                  setFilters(filtersResponse.filters);
                } catch (err) {
                  setError(err instanceof Error ? err.message : t('marketRadar.errors.loadFailed'));
                } finally {
                  setLoading(false);
                }
              }}
              disabled={loading}
              className="inline-flex items-center px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
              title={t('marketRadar.trends.refresh')}
            >
              <ArrowPathIcon className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
            
            <button
              onClick={handleCollect}
              className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
            >
              <ArrowPathIcon className="h-4 w-4 mr-2" />
              {t('marketRadar.trends.collection.button')}
            </button>
            
            {/* TEMPORARY: DYN_1 only collection button */}
            <button
              onClick={handleCollectDynamics}
              className="inline-flex items-center px-4 py-2 border border-orange-500 rounded-md shadow-sm text-sm font-medium text-orange-700 dark:text-orange-300 bg-orange-50 dark:bg-orange-900/20 hover:bg-orange-100 dark:hover:bg-orange-900/30 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-orange-500"
              title="TEMPORAIRE: Collecte uniquement DYN_1 (dynamique emploi)"
            >
              <SparklesIcon className="h-4 w-4 mr-2" />
              DYN_1 Only
            </button>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="mt-4 p-4 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-md">
            <div className="flex items-center">
              <ExclamationTriangleIcon className="h-5 w-5 text-red-500 dark:text-red-400" />
              <p className="ml-2 text-sm text-red-700 dark:text-red-400">{error}</p>
            </div>
          </div>
        )}
      </div>

      {/* Summary Stats */}
      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          {summary.types.map(({ type, count, latestDate }) => {
            const Icon = TREND_TYPE_ICONS[type] || ChartBarIcon;
            // Card is "selected" if: this type is filtered OR no filter is active (all types shown)
            const isSelected = typeFilter === type || typeFilter === '';
            return (
              <div
                key={type}
                className={`bg-white dark:bg-gray-800 rounded-lg shadow-sm p-4 cursor-pointer transition-colors ${
                  isSelected 
                    ? 'border-2 border-indigo-500 dark:border-indigo-400' 
                    : 'border border-gray-200 dark:border-gray-700 hover:border-indigo-300 dark:hover:border-indigo-600'
                }`}
                onClick={() => setTypeFilter(typeFilter === type ? '' : type as TrendType)}
              >
                <div className="flex items-center gap-2 mb-2">
                  <Icon className={`h-5 w-5 ${isSelected ? 'text-indigo-600 dark:text-indigo-400' : 'text-gray-400'}`} />
                  <span className="text-xs text-gray-500 dark:text-gray-400 truncate">
                    {TREND_TYPE_LABELS[type] || type}
                  </span>
                </div>
                <div className="text-2xl font-bold text-gray-900 dark:text-white">{count}</div>
                {latestDate && (
                  <div className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                    Dernière collecte: {latestDate}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Filters */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4">
        {filtersLoading ? (
          <div className="flex items-center justify-center py-4">
            <ArrowPathIcon className="h-5 w-5 text-indigo-600 dark:text-indigo-400 animate-spin mr-2" />
            <span className="text-sm text-gray-500 dark:text-gray-400">{t('common.loading')}</span>
          </div>
        ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Type {filters?.types?.length ? `(${filters.types.length})` : ''}
              </label>
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                className="w-full rounded-md border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm focus:border-indigo-500 focus:ring-indigo-500 text-sm"
              >
                <option value="">{t('marketRadar.trends.filters.allTypes')}</option>
                {(filters?.types || []).map(type => (
                  <option key={type} value={type}>{TREND_TYPE_LABELS[type] || type}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Région {filters?.regions?.length ? `(${filters.regions.length})` : ''}
              </label>
              <select
                value={regionFilter}
                onChange={(e) => setRegionFilter(e.target.value)}
                className="w-full rounded-md border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm focus:border-indigo-500 focus:ring-indigo-500 text-sm"
              >
                <option value="">{t('marketRadar.trends.filters.allRegions')}</option>
                {(filters?.regions || []).map(r => (
                  <option key={r.code} value={r.code}>{r.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Métier {filters?.romeCodes?.length ? `(${filters.romeCodes.length})` : ''}
              </label>
              <select
                value={romeFilter}
                onChange={(e) => setRomeFilter(e.target.value)}
                className="w-full rounded-md border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm focus:border-indigo-500 focus:ring-indigo-500 text-sm"
              >
                <option value="">{t('marketRadar.facts.filters.allMetiers')}</option>
                {(filters?.romeCodes || []).map(code => (
                  <option key={code} value={code}>{romeLabelsMap[code] || code}</option>
                ))}
              </select>
            </div>
          </div>
          {(typeFilter || regionFilter || romeFilter) && (
            <div className="flex justify-end">
              <button
                onClick={() => { setTypeFilter(''); setRegionFilter(''); setRomeFilter(''); }}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
              >
                {t('common.resetFilters')}
              </button>
            </div>
          )}
        </div>
        )}
      </div>

      {/* Trends Display */}
      {(trends.length === 0 && Object.keys(trendsByType).length === 0) ? (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-12 text-center">
          <ChartBarIcon className="h-12 w-12 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">{t('marketRadar.trends.noData')}</h3>
          <p className="text-gray-500 dark:text-gray-400">
            {t('marketRadar.facts.collection.startCollection')}
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Pagination - only show when filtered by type (not grouped) */}
          {!isGrouped && (
            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              totalCount={totalCount}
              pageSize={pageSize}
              onPageChange={setCurrentPage}
              loading={loading}
              itemName={t('marketRadar.trends.results')}
            />
          )}

          {/* Display trends grouped by type with proper headers */}
          {Object.entries(trendsByType).map(([type, typeTrends]) => {
            const Icon = TREND_TYPE_ICONS[type] || ChartBarIcon;
            // Get total count for this type from countsByType (backend) or summary
            const typeTotal = countsByType[type] || summary?.types?.find(t => t.type === type)?.count || typeTrends.length;
            return (
              <div key={type} className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
                <div className="px-6 py-4 bg-gray-50 dark:bg-gray-900/50 border-b border-gray-200 dark:border-gray-700">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                    <Icon className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
                    {TREND_TYPE_LABELS[type] || type}
                    <span className="text-sm font-normal text-gray-500 dark:text-gray-400">
                      ({typeTrends.length} affichés / {typeTotal} total)
                    </span>
                  </h3>
                </div>
                <div className="p-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    {typeTrends.map((trend) => {
                      const parsed = parseMetadata(trend.Metadata || null, type, trend.Value);
                      return (
                        <TrendCard
                          key={trend.id}
                          trend={trend}
                          type={type}
                          parsed={parsed}
                          romeLabel={trend.CodeRome ? romeLabelsMap[trend.CodeRome] : undefined}
                        />
                      );
                    })}
                  </div>
                </div>
              </div>
            );
          })}

          {/* Bottom Pagination - only show when filtered by type (not grouped) */}
          {!isGrouped && (
            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              totalCount={totalCount}
              pageSize={pageSize}
              onPageChange={setCurrentPage}
              loading={loading}
              itemName={t('marketRadar.trends.results')}
            />
          )}
        </div>
      )}
    </div>
  );
}

// Trend Card Component with rich metadata display
interface TrendCardProps {
  trend: MarketTrend;
  type: string;
  parsed: ParsedMetadata | null;
  romeLabel?: string;
}

function TrendCard({ trend, type, parsed, romeLabel }: TrendCardProps) {
  // Format number based on type
  const formatNumber = (value: number | string | undefined, valueType?: 'nombre' | 'montant' | 'taux') => {
    if (value === undefined || value === null) return '—';
    // Convert to number if string
    const numValue = typeof value === 'string' ? parseFloat(value) : value;
    if (isNaN(numValue)) return '—';
    if (valueType === 'montant' || type === 'salaire') return `${numValue.toLocaleString('fr-FR')} €`;
    if (valueType === 'taux' || type === 'tension') return numValue.toFixed(2);
    return numValue.toLocaleString('fr-FR');
  };

  // Get color based on type and value
  const getValueColor = () => {
    const value = parsed?.valeurPrincipale ?? trend.Value;
    if (value === undefined || value === null) return 'text-gray-500';
    
    switch (type) {
      case 'tension':
        if (value >= 2) return 'text-red-600 dark:text-red-400';
        if (value >= 1.5) return 'text-orange-500 dark:text-orange-400';
        if (value >= 1) return 'text-yellow-600 dark:text-yellow-400';
        return 'text-green-600 dark:text-green-400';
      case 'dynamique_emploi':
        if (value > 0) return 'text-green-600 dark:text-green-400';
        if (value < 0) return 'text-red-600 dark:text-red-400';
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
  };

  // Get characteristic value for display
  const getCharValue = (c: { nombre?: number; montant?: number; taux?: number; pourcentage?: number }) => {
    if (c.montant !== undefined) return formatNumber(c.montant, 'montant');
    if (c.nombre !== undefined) return formatNumber(c.nombre, 'nombre');
    if (c.taux !== undefined) return formatNumber(c.taux, 'taux');
    return '—';
  };

  // Render type-specific content
  const renderTypeSpecificContent = () => {
    if (!parsed) return null;

    switch (type) {
      case 'tension':
        return (
          <div className="space-y-3">
            {/* Main tension level badge */}
            {parsed.typeSpecific?.tensionLevel && (
              <div className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                parsed.typeSpecific.tensionColor === 'red' ? 'bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300' :
                parsed.typeSpecific.tensionColor === 'orange' ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/50 dark:text-orange-300' :
                parsed.typeSpecific.tensionColor === 'yellow' ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/50 dark:text-yellow-300' :
                parsed.typeSpecific.tensionColor === 'green' ? 'bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300' :
                'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300'
              }`}>
                {parsed.typeSpecific.tensionLevel}
              </div>
            )}
            
            {/* Detailed tension indicators */}
            {parsed.typeSpecific?.tensionIndicators && parsed.typeSpecific.tensionIndicators.length > 0 && (
              <div className="space-y-1.5">
                {parsed.typeSpecific.tensionIndicators
                  .filter(ind => ind.code !== 'PERSPECTIVE') // Skip main indicator (already shown above)
                  .map((indicator) => (
                    <div key={indicator.code} className="flex items-center justify-between text-xs">
                      <span className="text-gray-600 dark:text-gray-400 truncate mr-2" title={indicator.label}>
                        {indicator.label}
                      </span>
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        {/* Value bar visualization */}
                        <div className="w-12 h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                          <div 
                            className={`h-full rounded-full ${
                              indicator.color === 'red' ? 'bg-red-500' :
                              indicator.color === 'orange' ? 'bg-orange-500' :
                              indicator.color === 'yellow' ? 'bg-yellow-500' :
                              indicator.color === 'green' ? 'bg-green-500' :
                              'bg-gray-400'
                            }`}
                            style={{ width: `${(indicator.value / 5) * 100}%` }}
                          />
                        </div>
                        <span className={`font-medium w-4 text-right ${
                          indicator.color === 'red' ? 'text-red-600 dark:text-red-400' :
                          indicator.color === 'orange' ? 'text-orange-600 dark:text-orange-400' :
                          indicator.color === 'yellow' ? 'text-yellow-600 dark:text-yellow-400' :
                          indicator.color === 'green' ? 'text-green-600 dark:text-green-400' :
                          'text-gray-600 dark:text-gray-400'
                        }`}>
                          {indicator.value}
                        </span>
                      </div>
                    </div>
                  ))}
              </div>
            )}
            
            {parsed.indicateur && !parsed.typeSpecific?.tensionIndicators?.length && (
              <div className="text-xs text-gray-500 dark:text-gray-400">{parsed.indicateur}</div>
            )}
          </div>
        );

      case 'salaire':
        return (
          <div className="space-y-3">
            {/* Summary stats */}
            {parsed.typeSpecific?.salaireMin !== undefined && parsed.typeSpecific?.salaireMax !== undefined && (
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
                <div>
                  <span className="text-gray-500 dark:text-gray-400">Min: </span>
                  <span className="font-medium text-gray-900 dark:text-white">
                    {parsed.typeSpecific.salaireMin.toLocaleString('fr-FR')} €
                  </span>
                </div>
                <div>
                  <span className="text-gray-500 dark:text-gray-400">Max: </span>
                  <span className="font-medium text-gray-900 dark:text-white">
                    {parsed.typeSpecific.salaireMax.toLocaleString('fr-FR')} €
                  </span>
                </div>
                {parsed.typeSpecific?.salaireMedian !== undefined && (
                  <div>
                    <span className="text-gray-500 dark:text-gray-400">Médian: </span>
                    <span className="font-medium text-emerald-600 dark:text-emerald-400">
                      {parsed.typeSpecific.salaireMedian.toLocaleString('fr-FR')} €
                    </span>
                  </div>
                )}
              </div>
            )}
            
            {/* Detailed breakdown by activity */}
            {parsed.typeSpecific?.salairesParActivite && parsed.typeSpecific.salairesParActivite.length > 0 && (
              <div className="mt-2 space-y-2">
                <div className="text-xs font-medium text-gray-700 dark:text-gray-300">Par catégorie :</div>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {parsed.typeSpecific.salairesParActivite.map((activite, idx) => (
                    <div key={idx} className="p-2 bg-white dark:bg-gray-800 rounded border border-gray-200 dark:border-gray-600">
                      <div className="text-xs font-medium text-gray-800 dark:text-gray-200 mb-1 line-clamp-2" title={activite.libActivite}>
                        {activite.libActivite}
                      </div>
                      <div className="grid grid-cols-3 gap-1 text-xs">
                        {activite.salaireDebutant !== undefined && (
                          <div className="text-center">
                            <div className="text-gray-500 dark:text-gray-400">Débutant</div>
                            <div className="font-semibold text-blue-600 dark:text-blue-400">
                              {activite.salaireDebutant.toLocaleString('fr-FR')} €
                            </div>
                          </div>
                        )}
                        {activite.salaireMoyen !== undefined && (
                          <div className="text-center">
                            <div className="text-gray-500 dark:text-gray-400">Moyen</div>
                            <div className="font-semibold text-emerald-600 dark:text-emerald-400">
                              {activite.salaireMoyen.toLocaleString('fr-FR')} €
                            </div>
                          </div>
                        )}
                        {activite.salaireExperimente !== undefined && (
                          <div className="text-center">
                            <div className="text-gray-500 dark:text-gray-400">Expérimenté</div>
                            <div className="font-semibold text-purple-600 dark:text-purple-400">
                              {activite.salaireExperimente.toLocaleString('fr-FR')} €
                            </div>
                          </div>
                        )}
                      </div>
                      {activite.periode && (
                        <div className="text-xs text-gray-400 dark:text-gray-500 mt-1">{activite.periode}</div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        );

      case 'dynamique_emploi':
        const dynDetails = parsed.typeSpecific?.dynamiqueDetails;
        return (
          <div className="space-y-3">
            {/* Tendance badge with icon */}
            {parsed.typeSpecific?.tendance && (
              <div className="flex items-center gap-2">
                <div className={`inline-flex items-center px-3 py-1.5 rounded-full text-sm font-medium ${
                  parsed.typeSpecific.tendance === 'hausse' ? 'bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300' :
                  parsed.typeSpecific.tendance === 'baisse' ? 'bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300' :
                  'bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300'
                }`}>
                  {parsed.typeSpecific.tendance === 'hausse' && <ArrowTrendingUpIcon className="h-4 w-4 mr-1" />}
                  {parsed.typeSpecific.tendance === 'baisse' && <ArrowTrendingDownIcon className="h-4 w-4 mr-1" />}
                  {parsed.typeSpecific.tendanceLabel || (
                    parsed.typeSpecific.tendance === 'hausse' ? 'Dynamique positive' :
                    parsed.typeSpecific.tendance === 'baisse' ? 'Dynamique négative' : 'Dynamique stable'
                  )}
                </div>
              </div>
            )}
            
            {/* Description */}
            {parsed.typeSpecific?.tendanceDescription && (
              <p className="text-xs text-gray-600 dark:text-gray-400">
                {parsed.typeSpecific.tendanceDescription}
              </p>
            )}
            
            {/* Detailed info from metadata */}
            {dynDetails && (
              <div className="space-y-2 pt-2 border-t border-gray-100 dark:border-gray-700">
                {/* Territoire */}
                {dynDetails.territoire && (
                  <div className="flex items-center gap-2 text-xs">
                    <MapPinIcon className="h-3.5 w-3.5 text-gray-400" />
                    <span className="text-gray-600 dark:text-gray-400">{dynDetails.territoire}</span>
                  </div>
                )}
                
                {/* Période */}
                {dynDetails.periode && (
                  <div className="flex items-center gap-2 text-xs">
                    <ChartBarIcon className="h-3.5 w-3.5 text-gray-400" />
                    <span className="text-gray-600 dark:text-gray-400">{dynDetails.periode}</span>
                    {dynDetails.codePeriode && (
                      <span className="text-gray-400 dark:text-gray-500">({dynDetails.codePeriode})</span>
                    )}
                  </div>
                )}
                
                {/* Activité */}
                {dynDetails.activite && (
                  <div className="flex items-center gap-2 text-xs">
                    <BriefcaseIcon className="h-3.5 w-3.5 text-gray-400" />
                    <span className="text-gray-600 dark:text-gray-400 truncate" title={dynDetails.activite}>
                      {dynDetails.activite}
                    </span>
                  </div>
                )}
                
                {/* Date de mise à jour */}
                {(dynDetails.dateMaj || dynDetails.dateMajGlobale) && (
                  <div className="text-xs text-gray-400 dark:text-gray-500 pt-1">
                    Mis à jour : {formatDate(dynDetails.dateMaj || dynDetails.dateMajGlobale, 'long')}
                  </div>
                )}
              </div>
            )}
            
            {/* Fallback: show indicator name if no details */}
            {!dynDetails && parsed.indicateur && (
              <div className="text-xs text-gray-500 dark:text-gray-400">{parsed.indicateur}</div>
            )}
          </div>
        );

      case 'embauche':
      case 'offre':
      case 'demandeur':
      case 'demandeur_entrant':
        const details = parsed.typeSpecific?.embaucheDetails;
        return (
          <div className="space-y-3">
            {/* Evolution badge */}
            {parsed.typeSpecific?.evolutionPercent !== undefined && (
              <div className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                parsed.typeSpecific.evolutionPercent > 0 ? 'bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300' :
                parsed.typeSpecific.evolutionPercent < 0 ? 'bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300' :
                'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300'
              }`}>
                {parsed.typeSpecific.evolutionPercent > 0 ? '+' : ''}{Number(parsed.typeSpecific.evolutionPercent).toFixed(1)}% évolution
              </div>
            )}
            
            {/* Detailed breakdown */}
            {details && (
              <div className="space-y-2">
                {/* Genre breakdown */}
                {details.genre && (
                  <div className="flex items-center gap-2 text-xs">
                    <span className="text-gray-500 dark:text-gray-400 w-16">Genre:</span>
                    <div className="flex-1 flex items-center gap-1">
                      <div className="flex-1 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden flex">
                        <div className="h-full bg-blue-500" style={{ width: `${details.genre.hommes}%` }} />
                        <div className="h-full bg-pink-500" style={{ width: `${details.genre.femmes}%` }} />
                      </div>
                      <span className="text-blue-600 dark:text-blue-400 w-8 text-right">{details.genre.hommes}%</span>
                      <span className="text-pink-600 dark:text-pink-400 w-8 text-right">{details.genre.femmes}%</span>
                    </div>
                  </div>
                )}
                
                {/* Contract type breakdown */}
                {details.contrats && (
                  <div className="flex items-center gap-2 text-xs">
                    <span className="text-gray-500 dark:text-gray-400 w-16">Contrats:</span>
                    <div className="flex-1 flex items-center gap-1">
                      <div className="flex-1 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden flex">
                        <div className="h-full bg-green-500" style={{ width: `${details.contrats.cdi}%` }} title="CDI" />
                        <div className="h-full bg-yellow-500" style={{ width: `${details.contrats.cdd}%` }} title="CDD" />
                        <div className="h-full bg-gray-400" style={{ width: `${details.contrats.autres}%` }} title="Autres" />
                      </div>
                      <span className="text-green-600 dark:text-green-400 text-[10px]">CDI {details.contrats.cdi}%</span>
                    </div>
                  </div>
                )}
                
                {/* Qualification breakdown */}
                {details.qualification && (
                  <div className="flex items-center gap-2 text-xs">
                    <span className="text-gray-500 dark:text-gray-400 w-16">Qualif:</span>
                    <div className="flex-1 flex items-center gap-1">
                      <div className="flex-1 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden flex">
                        <div className="h-full bg-purple-500" style={{ width: `${details.qualification.cadres}%` }} title="Cadres" />
                        <div className="h-full bg-indigo-400" style={{ width: `${details.qualification.techniciens}%` }} title="Techniciens" />
                        <div className="h-full bg-gray-400" style={{ width: `${details.qualification.employes}%` }} title="Employés" />
                      </div>
                      <span className="text-purple-600 dark:text-purple-400 text-[10px]">Cadres {details.qualification.cadres}%</span>
                    </div>
                  </div>
                )}
                
                {/* Experience breakdown */}
                {details.experience && (
                  <div className="flex items-center gap-2 text-xs">
                    <span className="text-gray-500 dark:text-gray-400 w-16">Exp:</span>
                    <div className="flex-1 flex items-center gap-1">
                      <div className="flex-1 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden flex">
                        <div className="h-full bg-teal-400" style={{ width: `${details.experience.debutant}%` }} title="Débutant" />
                        <div className="h-full bg-teal-600" style={{ width: `${details.experience.experimente}%` }} title="Expérimenté" />
                      </div>
                      <span className="text-teal-600 dark:text-teal-400 text-[10px]">Exp. {details.experience.experimente}%</span>
                    </div>
                  </div>
                )}
                
                {/* Age breakdown (for demandeur_entrant) */}
                {details.age && (
                  <div className="flex items-center gap-2 text-xs">
                    <span className="text-gray-500 dark:text-gray-400 w-16">Âge:</span>
                    <div className="flex-1 flex items-center gap-1">
                      <div className="flex-1 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden flex">
                        <div className="h-full bg-amber-400" style={{ width: `${details.age.jeunes}%` }} title="15-24 ans" />
                        <div className="h-full bg-amber-500" style={{ width: `${details.age.adultes}%` }} title="25-49 ans" />
                        <div className="h-full bg-amber-600" style={{ width: `${details.age.seniors}%` }} title="50+ ans" />
                      </div>
                      <span className="text-amber-600 dark:text-amber-400 text-[10px]">25-49: {details.age.adultes}%</span>
                    </div>
                  </div>
                )}
                
                {/* Formation breakdown (for demandeur_entrant) */}
                {details.formation && (
                  <div className="flex items-center gap-2 text-xs">
                    <span className="text-gray-500 dark:text-gray-400 w-16">Form:</span>
                    <div className="flex-1 flex items-center gap-1">
                      <div className="flex-1 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden flex">
                        <div className="h-full bg-rose-400" style={{ width: `${details.formation.sansQualif}%` }} title="< Bac" />
                        <div className="h-full bg-rose-500" style={{ width: `${details.formation.bac}%` }} title="Bac" />
                        <div className="h-full bg-rose-600" style={{ width: `${details.formation.bacPlus}%` }} title="Bac+" />
                      </div>
                      <span className="text-rose-600 dark:text-rose-400 text-[10px]">Bac+ {details.formation.bacPlus}%</span>
                    </div>
                  </div>
                )}
                
                {/* Detailed characteristics for demandeur - grouped by type */}
                {details.caracteristiquesDetaillees && details.caracteristiquesDetaillees.length > 0 && (() => {
                  const genreData = details.caracteristiquesDetaillees.filter(c => c.type === 'GENRE');
                  const ageData = details.caracteristiquesDetaillees.filter(c => c.type === 'AGE');
                  const genreAgeData = details.caracteristiquesDetaillees.filter(c => c.type === 'GENRExAGE');
                  
                  return (
                    <div className="mt-3 space-y-3">
                      {/* Genre section */}
                      {genreData.length > 0 && (
                        <div className="bg-gradient-to-r from-blue-50 to-pink-50 dark:from-blue-900/20 dark:to-pink-900/20 rounded-lg p-2">
                          <div className="text-[10px] font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wide mb-1.5">Genre</div>
                          <div className="flex gap-3">
                            {genreData.map((g, i) => (
                              <div key={i} className="flex-1">
                                <div className="flex items-center justify-between mb-1">
                                  <span className={`text-xs font-medium ${g.label === 'Hommes' ? 'text-blue-600 dark:text-blue-400' : 'text-pink-600 dark:text-pink-400'}`}>
                                    {g.label}
                                  </span>
                                  <span className="text-xs font-bold text-gray-700 dark:text-gray-300">{g.pourcentage}%</span>
                                </div>
                                <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                                  <div 
                                    className={`h-full rounded-full ${g.label === 'Hommes' ? 'bg-blue-500' : 'bg-pink-500'}`}
                                    style={{ width: `${g.pourcentage}%` }}
                                  />
                                </div>
                                <div className="text-[10px] text-gray-500 dark:text-gray-400 mt-0.5 text-center">{g.nombre} pers.</div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      
                      {/* Age section */}
                      {ageData.length > 0 && (
                        <div className="bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-900/20 dark:to-orange-900/20 rounded-lg p-2">
                          <div className="text-[10px] font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wide mb-1.5">Tranches d'âge</div>
                          <div className="space-y-1.5">
                            {ageData.slice(0, 5).map((a, i) => (
                              <div key={i} className="flex items-center gap-2">
                                <span className="text-[10px] text-gray-600 dark:text-gray-400 w-20 truncate" title={a.label}>{a.label}</span>
                                <div className="flex-1 h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                                  <div 
                                    className="h-full bg-gradient-to-r from-amber-400 to-orange-500 rounded-full"
                                    style={{ width: `${a.pourcentage}%` }}
                                  />
                                </div>
                                <span className={`text-[10px] font-medium w-8 text-right ${a.pourcentage > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-gray-400'}`}>
                                  {a.pourcentage}%
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      
                      {/* Genre x Age section - collapsible style */}
                      {genreAgeData.length > 0 && (
                        <details className="group">
                          <summary className="cursor-pointer text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide flex items-center gap-1 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors">
                            <span className="group-open:rotate-90 transition-transform">▶</span>
                            Détail Genre × Âge ({genreAgeData.length})
                          </summary>
                          <div className="mt-2 grid grid-cols-2 gap-1.5 max-h-32 overflow-y-auto">
                            {genreAgeData.map((ga, i) => (
                              <div key={i} className="flex items-center gap-1 bg-gray-50 dark:bg-gray-800/50 rounded px-1.5 py-0.5">
                                <div 
                                  className={`w-1.5 h-1.5 rounded-full ${ga.label.startsWith('Hommes') ? 'bg-blue-500' : 'bg-pink-500'}`}
                                />
                                <span className="text-[9px] text-gray-600 dark:text-gray-400 flex-1 truncate" title={ga.label}>
                                  {ga.label.replace('Hommes - ', 'H ').replace('Femmes - ', 'F ')}
                                </span>
                                <span className={`text-[9px] font-medium ${ga.pourcentage > 0 ? 'text-indigo-600 dark:text-indigo-400' : 'text-gray-400'}`}>
                                  {ga.pourcentage}%
                                </span>
                              </div>
                            ))}
                          </div>
                        </details>
                      )}
                    </div>
                  );
                })()}
                
                {/* Period info */}
                {details.periode && (
                  <div className="text-[10px] text-gray-400 dark:text-gray-500 mt-1">{details.periode}</div>
                )}
              </div>
            )}
            
            {!details && parsed.indicateur && (
              <div className="text-xs text-gray-500 dark:text-gray-400">{parsed.indicateur}</div>
            )}
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="p-4 bg-gray-50 dark:bg-gray-900/30 rounded-lg border border-gray-100 dark:border-gray-700 hover:border-indigo-200 dark:hover:border-indigo-800 transition-colors">
      {/* Header: Métier + Région */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1 min-w-0">
          {(romeLabel || trend.CodeRome) && (
            <div className="text-sm font-semibold text-gray-900 dark:text-white truncate" title={romeLabel || trend.CodeRome}>
              {romeLabel || trend.CodeRome}
            </div>
          )}
          {(trend.Region || parsed?.territoire) && (
            <div className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1 mt-0.5">
              <MapPinIcon className="h-3 w-3 flex-shrink-0" />
              <span className="truncate">{parsed?.territoire || trend.Region}</span>
            </div>
          )}
        </div>
        {/* Type badge */}
        <span className="text-xs px-1.5 py-0.5 rounded bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400 ml-2 flex-shrink-0">
          {parsed?.codeIndicateur || type}
        </span>
      </div>

      {/* Main Value */}
      <div className="mb-3">
        <div className={`text-2xl font-bold ${getValueColor()}`}>
          {formatNumber(parsed?.valeurPrincipale ?? trend.Value, parsed?.valeurPrincipaleType)}
        </div>
        {/* ValueLabel from API or DB */}
        {(trend.ValueLabel || parsed?.indicateur) && (
          <div className="text-xs text-indigo-600 dark:text-indigo-400 font-medium mt-0.5 line-clamp-2">
            {trend.ValueLabel || parsed?.indicateur}
          </div>
        )}
        {/* Secondary value */}
        {parsed?.valeurSecondaire !== undefined && (
          <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            {parsed.valeurSecondarieType === 'pourcentage' 
              ? `${Number(parsed.valeurSecondaire).toFixed(1)}%`
              : formatNumber(parsed.valeurSecondaire, parsed.valeurSecondarieType as 'nombre' | 'montant' | undefined)
            }
            {parsed.valeurSecondarieType === 'pourcentage' && ' du total'}
          </div>
        )}
      </div>

      {/* Type-specific content */}
      {renderTypeSpecificContent()}

      {/* Activité */}
      {parsed?.activite && (
        <div className="text-xs text-gray-600 dark:text-gray-400 mt-2 line-clamp-2" title={parsed.activite}>
          {parsed.activite}
        </div>
      )}

      {/* Caractéristiques (breakdown) - hidden for types that have detailed display */}
      {parsed?.caracteristiques && parsed.caracteristiques.length > 0 && 
       !['demandeur', 'demandeur_entrant', 'offre', 'embauche'].includes(trend.Type) && (
        <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
          <div className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-2">
            {parsed.nomenclature || 'Répartition'}
          </div>
          <div className="space-y-1.5 max-h-64 overflow-y-auto">
            {parsed.caracteristiques.map((c, i) => (
              <div key={i} className="flex items-center justify-between text-xs">
                <span className="text-gray-600 dark:text-gray-400 truncate flex-1 mr-2" title={c.label}>
                  {c.label}
                </span>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className="font-medium text-gray-900 dark:text-white">
                    {getCharValue(c)}
                  </span>
                  {c.pourcentage !== undefined && (
                    <span className="text-gray-400 dark:text-gray-500 w-10 text-right">
                      {Number(c.pourcentage).toFixed(0)}%
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Footer: Période */}
      <div className="mt-3 pt-2 border-t border-gray-100 dark:border-gray-700/50 flex items-center justify-between">
        <span className="text-xs text-gray-400 dark:text-gray-500">
          {parsed?.periode || trend.Date}
        </span>
      </div>
    </div>
  );
}

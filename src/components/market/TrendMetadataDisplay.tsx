/**
 * TrendMetadataDisplay - Reusable component for displaying trend metadata
 * Used in both MarketTrendsTab (cards) and FranceMapTab (hover tooltips)
 */

import { useMemo } from 'react';

// Types for metadata parsing
interface PeriodeData {
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

interface CaracteristiqueData {
  codeCaract?: string;
  libCaract?: string;
  codeTypeCaract?: string;
  nombre?: number;
  montant?: number;
  taux?: number;
  pourcentage?: number;
}

interface SalairePeriodeData {
  codeActivite?: string;
  libActivite?: string;
  libPeriode?: string;
  salaireValeurMontant?: Array<{
    codeNomenclature?: string;
    valeurPrincipaleMontant?: number;
  }>;
}

interface SalaireActivite {
  codeActivite: string;
  libActivite: string;
  periode?: string;
  salaireDebutant?: number;
  salaireExperimente?: number;
  salaireMoyen?: number;
}

interface TensionIndicator {
  code: string;
  label: string;
  value: number;
  decimal: number;
  color: string;
}

interface EmbaucheDetails {
  genre?: { hommes: number; femmes: number };
  contrats?: { cdi: number; cdd: number; autres: number };
  qualification?: { cadres: number; techniciens: number; employes: number };
  experience?: { debutant: number; experimente: number };
  age?: { jeunes: number; adultes: number; seniors: number };
  formation?: { sansQualif: number; bac: number; bacPlus: number };
  periode?: string;
  territoire?: string;
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

/**
 * Parse metadata from trend data
 */
export function parseMetadata(metadata: Record<string, unknown> | string | null, type: string, trendValue?: number | string | null): ParsedMetadata | null {
  let parsedMeta: Record<string, unknown> = {};
  if (metadata) {
    if (typeof metadata === 'string') {
      try {
        parsedMeta = JSON.parse(metadata);
      } catch {
        // Invalid JSON
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
      const tensionIndicators: TensionIndicator[] = [];
      let mainTensionValue: number | undefined;
      
      if (periodes?.length) {
        periodes.forEach((p: PeriodeData) => {
          const code = p.codeNomenclature;
          const label = p.libNomenclature;
          const value = p.valeurPrincipaleNombre;
          const decimal = p.valeurPrincipaleDecimale;
          
          if (code && label && value !== undefined) {
            let color = 'gray';
            if (value >= 4) color = 'red';
            else if (value >= 3) color = 'orange';
            else if (value >= 2) color = 'yellow';
            else if (value >= 1) color = 'green';
            
            tensionIndicators.push({ code, label, value, decimal: decimal ?? 0, color });
            
            if (code === 'PERSPECTIVE') {
              mainTensionValue = value;
            }
          }
        });
      }
      
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
      
      if (tensionIndicators.length > 0) {
        result.typeSpecific!.tensionIndicators = tensionIndicators;
      }
      break;
      
    case 'salaire':
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
                  case 'SAL1': activite.salaireDebutant = sv.valeurPrincipaleMontant; break;
                  case 'SAL2': activite.salaireExperimente = sv.valeurPrincipaleMontant; break;
                  case 'SAL3': activite.salaireMoyen = sv.valeurPrincipaleMontant; break;
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
      break;
      
    case 'dynamique_emploi':
      if (periodes?.length) {
        const p = periodes[0];
        result.typeSpecific!.dynamiqueDetails = {
          territoire: p.libTerritoire as string,
          codeTerritoire: p.codeTerritoire as string,
          activite: p.libActivite as string,
          periode: p.libPeriode as string,
          codePeriode: p.codePeriode as string,
          dateMaj: p.datMaj as string
        };
      }
      
      if (parsedMeta.datMaj) {
        if (!result.typeSpecific!.dynamiqueDetails) {
          result.typeSpecific!.dynamiqueDetails = {};
        }
        result.typeSpecific!.dynamiqueDetails.dateMajGlobale = parsedMeta.datMaj as string;
      }
      
      let dynamiqueValue = result.valeurPrincipale;
      if (dynamiqueValue === undefined && trendValue !== undefined && trendValue !== null) {
        dynamiqueValue = typeof trendValue === 'string' ? parseFloat(trendValue) : trendValue;
        result.valeurPrincipale = dynamiqueValue;
      }
      
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
      let countValue = result.valeurPrincipale;
      if (countValue === undefined && trendValue !== undefined && trendValue !== null) {
        countValue = typeof trendValue === 'string' ? parseFloat(trendValue) : trendValue;
        result.valeurPrincipale = countValue;
      }
      result.typeSpecific!.totalCount = countValue;
      if (result.valeurSecondaire !== undefined && result.valeurSecondarieType === 'pourcentage') {
        result.typeSpecific!.evolutionPercent = result.valeurSecondaire;
      }
      
      if (periodes?.length) {
        const firstPeriode = periodes[0];
        const caracts = firstPeriode.listeValeurParCaract;
        
        if (caracts?.length) {
          const embaucheDetails: EmbaucheDetails = {
            periode: firstPeriode.libPeriode,
            territoire: firstPeriode.libTerritoire
          };
          
          const hommes = caracts.find((c: CaracteristiqueData) => c.codeCaract === 'H');
          const femmes = caracts.find((c: CaracteristiqueData) => c.codeCaract === 'F');
          if (hommes || femmes) {
            embaucheDetails.genre = {
              hommes: hommes?.pourcentage || 0,
              femmes: femmes?.pourcentage || 0
            };
          }
          
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
          
          const exp2 = caracts.find((c: CaracteristiqueData) => c.codeCaract === 'EXP2');
          const exp3 = caracts.find((c: CaracteristiqueData) => c.codeCaract === 'EXP3');
          const exp4 = caracts.find((c: CaracteristiqueData) => c.codeCaract === 'EXP4');
          const exp5 = caracts.find((c: CaracteristiqueData) => c.codeCaract === 'EXP5');
          if (exp2 || exp3 || exp4 || exp5) {
            embaucheDetails.experience = {
              debutant: (exp2?.pourcentage || 0) + (exp3?.pourcentage || 0),
              experimente: (exp4?.pourcentage || 0) + (exp5?.pourcentage || 0)
            };
          }
          
          const age1 = caracts.find((c: CaracteristiqueData) => c.codeCaract === 'AGE1');
          const age2 = caracts.find((c: CaracteristiqueData) => c.codeCaract === 'AGE2');
          const age3 = caracts.find((c: CaracteristiqueData) => c.codeCaract === 'AGE3');
          if (age1 || age2 || age3) {
            embaucheDetails.age = {
              jeunes: age1?.pourcentage || 0,
              adultes: age2?.pourcentage || 0,
              seniors: age3?.pourcentage || 0
            };
          }
          
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
          
          result.typeSpecific!.embaucheDetails = embaucheDetails;
        }
      }
      break;
  }
  
  return result;
}

// Progress bar component for percentages
function ProgressBar({ value, color = 'indigo', label }: { value: number; color?: string; label?: string }) {
  const colorClasses: Record<string, string> = {
    indigo: 'bg-indigo-500',
    green: 'bg-green-500',
    red: 'bg-red-500',
    orange: 'bg-orange-500',
    yellow: 'bg-yellow-500',
    blue: 'bg-blue-500',
    purple: 'bg-purple-500',
    teal: 'bg-teal-500'
  };
  
  return (
    <div className="flex items-center gap-2">
      {label && <span className="text-xs text-gray-500 dark:text-gray-400 w-16 truncate">{label}</span>}
      <div className="flex-1 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
        <div 
          className={`h-full ${colorClasses[color] || colorClasses.indigo} rounded-full transition-all`}
          style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
        />
      </div>
      <span className="text-xs font-medium text-gray-700 dark:text-gray-300 w-10 text-right">{value.toFixed(0)}%</span>
    </div>
  );
}

interface TrendMetadataDisplayProps {
  metadata: Record<string, unknown> | string | null;
  type: string;
  value?: number | string | null;
  compact?: boolean;
  className?: string;
}

/**
 * Component to display parsed trend metadata
 */
export default function TrendMetadataDisplay({ metadata, type, value, compact = false, className = '' }: TrendMetadataDisplayProps) {
  const parsed = useMemo(() => parseMetadata(metadata, type, value), [metadata, type, value]);
  
  if (!parsed) {
    return null;
  }
  
  const formatNumber = (val: number | undefined, valType?: 'nombre' | 'montant' | 'taux') => {
    if (val === undefined || val === null) return '—';
    if (valType === 'montant' || type === 'salaire') return `${val.toLocaleString('fr-FR')} €`;
    if (valType === 'taux' || type === 'tension') return val.toFixed(2);
    return val.toLocaleString('fr-FR');
  };
  
  // Compact mode for tooltips
  if (compact) {
    return (
      <div className={`text-xs space-y-1 ${className}`}>
        {parsed.indicateur && (
          <div className="font-medium text-gray-900 dark:text-white truncate">{parsed.indicateur}</div>
        )}
        {parsed.valeurPrincipale !== undefined && (
          <div className="text-lg font-bold text-indigo-600 dark:text-indigo-400">
            {formatNumber(parsed.valeurPrincipale, parsed.valeurPrincipaleType)}
          </div>
        )}
        {parsed.valeurSecondaire !== undefined && parsed.valeurSecondarieType === 'pourcentage' && (
          <div className={`text-xs ${parsed.valeurSecondaire >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            {parsed.valeurSecondaire >= 0 ? '↑' : '↓'} {Math.abs(parsed.valeurSecondaire).toFixed(1)}% évolution
          </div>
        )}
        {parsed.periode && (
          <div className="text-gray-500 dark:text-gray-400">{parsed.periode}</div>
        )}
        
        {/* Type-specific compact display */}
        {type === 'tension' && parsed.typeSpecific?.tensionLevel && (
          <div className={`font-medium ${
            parsed.typeSpecific.tensionColor === 'red' ? 'text-red-600' :
            parsed.typeSpecific.tensionColor === 'orange' ? 'text-orange-600' :
            parsed.typeSpecific.tensionColor === 'yellow' ? 'text-yellow-600' :
            parsed.typeSpecific.tensionColor === 'green' ? 'text-green-600' :
            'text-gray-600'
          }`}>
            {parsed.typeSpecific.tensionLevel}
          </div>
        )}
        
        {type === 'dynamique_emploi' && parsed.typeSpecific?.tendanceLabel && (
          <div className={`font-medium ${
            parsed.typeSpecific.tendance === 'hausse' ? 'text-green-600' :
            parsed.typeSpecific.tendance === 'baisse' ? 'text-red-600' :
            'text-gray-600'
          }`}>
            {parsed.typeSpecific.tendanceLabel}
          </div>
        )}
        
        {/* Contrats breakdown */}
        {parsed.typeSpecific?.embaucheDetails?.contrats && (
          <div className="space-y-0.5 mt-1">
            <ProgressBar value={parsed.typeSpecific.embaucheDetails.contrats.cdi} color="green" label="CDI" />
            <ProgressBar value={parsed.typeSpecific.embaucheDetails.contrats.cdd} color="orange" label="CDD" />
          </div>
        )}
        
        {/* Qualification breakdown */}
        {parsed.typeSpecific?.embaucheDetails?.qualification && (
          <div className="space-y-0.5 mt-1">
            <ProgressBar value={parsed.typeSpecific.embaucheDetails.qualification.cadres} color="purple" label="Cadres" />
            <ProgressBar value={parsed.typeSpecific.embaucheDetails.qualification.techniciens} color="blue" label="Tech." />
          </div>
        )}
        
        {/* Experience breakdown */}
        {parsed.typeSpecific?.embaucheDetails?.experience && (
          <div className="space-y-0.5 mt-1">
            <ProgressBar value={parsed.typeSpecific.embaucheDetails.experience.debutant} color="teal" label="Déb." />
            <ProgressBar value={parsed.typeSpecific.embaucheDetails.experience.experimente} color="indigo" label="Exp." />
          </div>
        )}
      </div>
    );
  }
  
  // Full display mode (for cards)
  return (
    <div className={`space-y-2 ${className}`}>
      {parsed.indicateur && (
        <div className="text-sm text-gray-600 dark:text-gray-400 truncate" title={parsed.indicateur}>
          {parsed.indicateur}
        </div>
      )}
      
      {parsed.valeurPrincipale !== undefined && (
        <div className="text-2xl font-bold text-gray-900 dark:text-white">
          {formatNumber(parsed.valeurPrincipale, parsed.valeurPrincipaleType)}
        </div>
      )}
      
      {parsed.valeurSecondaire !== undefined && parsed.valeurSecondarieType === 'pourcentage' && (
        <div className={`text-sm font-medium ${parsed.valeurSecondaire >= 0 ? 'text-green-600' : 'text-red-600'}`}>
          {parsed.valeurSecondaire >= 0 ? '↑' : '↓'} {Math.abs(parsed.valeurSecondaire).toFixed(1)}% évolution
        </div>
      )}
      
      {parsed.periode && (
        <div className="text-xs text-gray-500 dark:text-gray-400">{parsed.periode}</div>
      )}
      
      {/* Type-specific full display */}
      {type === 'tension' && parsed.typeSpecific?.tensionLevel && (
        <div className={`text-sm font-medium px-2 py-1 rounded inline-block ${
          parsed.typeSpecific.tensionColor === 'red' ? 'bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300' :
          parsed.typeSpecific.tensionColor === 'orange' ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/50 dark:text-orange-300' :
          parsed.typeSpecific.tensionColor === 'yellow' ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/50 dark:text-yellow-300' :
          parsed.typeSpecific.tensionColor === 'green' ? 'bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300' :
          'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300'
        }`}>
          {parsed.typeSpecific.tensionLevel}
        </div>
      )}
      
      {type === 'dynamique_emploi' && parsed.typeSpecific?.tendanceLabel && (
        <div className={`text-sm font-medium px-2 py-1 rounded inline-block ${
          parsed.typeSpecific.tendance === 'hausse' ? 'bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300' :
          parsed.typeSpecific.tendance === 'baisse' ? 'bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300' :
          'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300'
        }`}>
          {parsed.typeSpecific.tendanceLabel}
        </div>
      )}
      
      {/* Detailed breakdowns */}
      {parsed.typeSpecific?.embaucheDetails?.contrats && (
        <div className="space-y-1 mt-2">
          <div className="text-xs font-medium text-gray-700 dark:text-gray-300">Contrats</div>
          <ProgressBar value={parsed.typeSpecific.embaucheDetails.contrats.cdi} color="green" label="CDI" />
          <ProgressBar value={parsed.typeSpecific.embaucheDetails.contrats.cdd} color="orange" label="CDD" />
        </div>
      )}
      
      {parsed.typeSpecific?.embaucheDetails?.qualification && (
        <div className="space-y-1 mt-2">
          <div className="text-xs font-medium text-gray-700 dark:text-gray-300">Qualification</div>
          <ProgressBar value={parsed.typeSpecific.embaucheDetails.qualification.cadres} color="purple" label="Cadres" />
          <ProgressBar value={parsed.typeSpecific.embaucheDetails.qualification.techniciens} color="blue" label="Tech." />
        </div>
      )}
      
      {parsed.typeSpecific?.embaucheDetails?.experience && (
        <div className="space-y-1 mt-2">
          <div className="text-xs font-medium text-gray-700 dark:text-gray-300">Expérience</div>
          <ProgressBar value={parsed.typeSpecific.embaucheDetails.experience.debutant} color="teal" label="Débutant" />
          <ProgressBar value={parsed.typeSpecific.embaucheDetails.experience.experimente} color="indigo" label="Expérimenté" />
        </div>
      )}
    </div>
  );
}

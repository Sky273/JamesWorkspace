/**
 * MarketTrendsTab - Metadata parsing logic
 * Pure function to parse France Travail API metadata into structured data
 */

import type {
  ParsedMetadata,
  PeriodeData,
  SalairePeriodeData,
  SalaireActivite,
  TensionIndicator,
  EmbaucheDetails,
  CaracteristiqueData,
  CaracteristiqueAffichage
} from './marketTrends.types';

export function parseMetadata(metadata: Record<string, unknown> | string | null, type: string, trendValue?: number | string | null): ParsedMetadata | null {
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
      parseTension(result, periodes, trendValue);
      break;
      
    case 'salaire':
      parseSalaire(result, parsedMeta);
      break;
      
    case 'dynamique_emploi':
      parseDynamiqueEmploi(result, parsedMeta, periodes, trendValue);
      break;
      
    case 'embauche':
    case 'offre':
    case 'demandeur':
    case 'demandeur_entrant':
      parseEmbauche(result, periodes, trendValue);
      break;
  }
  
  return result;
}

function parseTension(result: ParsedMetadata, periodes: PeriodeData[] | undefined, trendValue?: number | string | null): void {
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
}

function parseSalaire(result: ParsedMetadata, parsedMeta: Record<string, unknown>): void {
  // Parse salary data from valeursParPeriode or listeValeursParPeriode structure
  const salairePeriodes = (parsedMeta.valeursParPeriode || parsedMeta.listeValeursParPeriode) as SalairePeriodeData[] | undefined;
  if (salairePeriodes?.length) {
    const salairesParActivite: SalaireActivite[] = [];
    const allSalaires: number[] = [];
    
    salairePeriodes.forEach((sp, index) => {
      // Include entries even if libActivite is missing (use fallback label)
      if (sp.salaireValeurMontant?.length) {
        const activite: SalaireActivite = {
          codeActivite: sp.codeActivite || '',
          libActivite: sp.libActivite || sp.libPeriode || `Catégorie ${index + 1}`,
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
}

function parseDynamiqueEmploi(result: ParsedMetadata, parsedMeta: Record<string, unknown>, periodes: PeriodeData[] | undefined, trendValue?: number | string | null): void {
  // Parse dynamique emploi from dataemploi API format
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
}

function parseEmbauche(result: ParsedMetadata, periodes: PeriodeData[] | undefined, trendValue?: number | string | null): void {
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
}

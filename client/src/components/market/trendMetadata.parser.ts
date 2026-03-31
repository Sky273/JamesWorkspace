import type {
  AgeBreakdown,
  CaracteristiqueData,
  EmbaucheDetails,
  ParsedMetadata,
  PeriodeData,
  SalaireActivite,
  SalairePeriodeData,
  TensionIndicator
} from './trendMetadata.types';

export function parseMetadata(metadata: Record<string, unknown> | string | null, type: string, trendValue?: number | string | null): ParsedMetadata | null {
  let parsedMeta: Record<string, unknown> = {};
  if (metadata) {
    if (typeof metadata === 'string') {
      try {
        parsedMeta = JSON.parse(metadata);
      } catch {
        parsedMeta = {};
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
      result.caracteristiques = p.listeValeurParCaract.map((c: CaracteristiqueData) => ({
        label: c.libCaract || '',
        nombre: c.nombre,
        montant: c.montant,
        taux: c.taux,
        pourcentage: c.pourcentage
      }));
    }
  }

  if (result.valeurPrincipale === undefined && trendValue !== undefined && trendValue !== null) {
    result.valeurPrincipale = typeof trendValue === 'string' ? parseFloat(trendValue) : trendValue;
    result.valeurPrincipaleType = 'nombre';
  }

  switch (type) {
    case 'tension': {
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
            if (code === 'PERSPECTIVE') mainTensionValue = value;
          }
        });
      }
      const tensionValue = result.valeurPrincipale ?? mainTensionValue;
      if (tensionValue !== undefined && !Number.isNaN(tensionValue)) {
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
      if (tensionIndicators.length > 0) result.typeSpecific!.tensionIndicators = tensionIndicators;
      break;
    }
    case 'salaire': {
      const salairePeriodes = parsedMeta.valeursParPeriode as SalairePeriodeData[] | undefined;
      if (salairePeriodes?.length) {
        const salairesParActivite: SalaireActivite[] = [];
        const allSalaires: number[] = [];
        salairePeriodes.forEach((sp) => {
          if (sp.libActivite && sp.salaireValeurMontant?.length) {
            const activite: SalaireActivite = {
              codeActivite: sp.codeActivite || '',
              libActivite: sp.libActivite,
              periode: sp.libPeriode
            };
            sp.salaireValeurMontant.forEach((sv) => {
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
        if (salairesParActivite.length > 0) result.typeSpecific!.salairesParActivite = salairesParActivite;
        if (allSalaires.length > 0) {
          allSalaires.sort((a, b) => a - b);
          result.typeSpecific!.salaireMin = allSalaires[0];
          result.typeSpecific!.salaireMax = allSalaires[allSalaires.length - 1];
          result.typeSpecific!.salaireMedian = allSalaires[Math.floor(allSalaires.length / 2)];
        }
      }
      break;
    }
    case 'dynamique_emploi': {
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
        if (!result.typeSpecific!.dynamiqueDetails) result.typeSpecific!.dynamiqueDetails = {};
        result.typeSpecific!.dynamiqueDetails.dateMajGlobale = parsedMeta.datMaj as string;
      }
      const dynamiqueValue = result.valeurPrincipale;
      if (dynamiqueValue !== undefined && !Number.isNaN(dynamiqueValue)) {
        if (dynamiqueValue >= 1) {
          result.typeSpecific!.tendance = 'hausse';
          result.typeSpecific!.tendanceLabel = 'Dynamique positive';
          result.typeSpecific!.tendanceDescription = "Le marché de l'emploi est en croissance";
        } else if (dynamiqueValue <= 0) {
          result.typeSpecific!.tendance = 'baisse';
          result.typeSpecific!.tendanceLabel = 'Dynamique négative';
          result.typeSpecific!.tendanceDescription = "Le marché de l'emploi est en recul";
        } else {
          result.typeSpecific!.tendance = 'stable';
          result.typeSpecific!.tendanceLabel = 'Dynamique stable';
          result.typeSpecific!.tendanceDescription = "Le marché de l'emploi est stable";
        }
      }
      break;
    }
    case 'embauche':
    case 'offre':
    case 'demandeur':
    case 'demandeur_entrant': {
      result.typeSpecific!.totalCount = result.valeurPrincipale;
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
          const hommes = caracts.find((c) => c.codeCaract === 'H');
          const femmes = caracts.find((c) => c.codeCaract === 'F');
          if (hommes || femmes) {
            embaucheDetails.genre = {
              hommes: hommes?.pourcentage || 0,
              femmes: femmes?.pourcentage || 0,
              hommesNombre: hommes?.nombre,
              femmesNombre: femmes?.nombre
            };
          }
          const cdi = caracts.find((c) => c.codeCaract === 'CDI');
          const cdd1 = caracts.find((c) => c.codeCaract === 'CDD1');
          const cdd2 = caracts.find((c) => c.codeCaract === 'CDD2');
          const cdd3 = caracts.find((c) => c.codeCaract === 'CDD3');
          const autres = caracts.find((c) => c.codeCaract === 'AUTR');
          if (cdi || cdd1 || cdd2 || cdd3 || autres) {
            embaucheDetails.contrats = {
              cdi: cdi?.pourcentage || 0,
              cdd: (cdd1?.pourcentage || 0) + (cdd2?.pourcentage || 0) + (cdd3?.pourcentage || 0),
              autres: autres?.pourcentage || 0
            };
          }
          const cadres = caracts.find((c) => c.codeCaract === 'CADRE');
          const tech = caracts.find((c) => c.codeCaract === 'TECH');
          const eq = caracts.find((c) => c.codeCaract === 'EQ');
          const enq = caracts.find((c) => c.codeCaract === 'ENQ');
          const oq = caracts.find((c) => c.codeCaract === 'OQ');
          const onq = caracts.find((c) => c.codeCaract === 'ONQ');
          if (cadres || tech || eq || enq || oq || onq) {
            embaucheDetails.qualification = {
              cadres: cadres?.pourcentage || 0,
              techniciens: tech?.pourcentage || 0,
              employes: (eq?.pourcentage || 0) + (enq?.pourcentage || 0),
              ouvriers: (oq?.pourcentage || 0) + (onq?.pourcentage || 0)
            };
          }
          const exp2 = caracts.find((c) => c.codeCaract === 'EXP2');
          const exp3 = caracts.find((c) => c.codeCaract === 'EXP3');
          const exp4 = caracts.find((c) => c.codeCaract === 'EXP4');
          const exp5 = caracts.find((c) => c.codeCaract === 'EXP5');
          if (exp2 || exp3 || exp4 || exp5) {
            embaucheDetails.experience = {
              debutant: (exp2?.pourcentage || 0) + (exp3?.pourcentage || 0),
              experimente: (exp4?.pourcentage || 0) + (exp5?.pourcentage || 0)
            };
          }
          const age1 = caracts.find((c) => c.codeCaract === 'AGE1');
          const age2 = caracts.find((c) => c.codeCaract === 'AGE2');
          const age3 = caracts.find((c) => c.codeCaract === 'AGE3');
          if (age1 || age2 || age3) {
            embaucheDetails.age = {
              jeunes: age1?.pourcentage || 0,
              adultes: age2?.pourcentage || 0,
              seniors: age3?.pourcentage || 0
            };
          }
          const ageDetails: AgeBreakdown[] = [];
          const ageMapping: Record<string, string> = {
            AGE1524: '15-24 ans',
            AGE2549: '25-49 ans',
            AGE50P: '50 ans et +',
            AGE2534: '25-34 ans',
            AGE3549: '35-49 ans',
            AGE1: '< 25 ans',
            AGE2: '25-49 ans',
            AGE3: '50 ans et +'
          };
          Object.entries(ageMapping).forEach(([code, label]) => {
            const ageCaract = caracts.find((c) => c.codeCaract === code);
            if (ageCaract?.pourcentage !== undefined) ageDetails.push({ label, value: ageCaract.pourcentage });
          });
          if (ageDetails.length > 0) embaucheDetails.ageDetaille = ageDetails;
          const sans = caracts.find((c) => c.codeCaract === 'SANS');
          const capbep = caracts.find((c) => c.codeCaract === 'CAPBEP');
          const bac = caracts.find((c) => c.codeCaract === 'BAC');
          const bac2 = caracts.find((c) => c.codeCaract === 'BAC2');
          const bac3 = caracts.find((c) => c.codeCaract === 'BAC3EP');
          const bac5 = caracts.find((c) => c.codeCaract === 'BAC5EP');
          if (sans || capbep || bac || bac2 || bac3 || bac5) {
            embaucheDetails.formation = {
              sansQualif: (sans?.pourcentage || 0) + (capbep?.pourcentage || 0),
              bac: bac?.pourcentage || 0,
              bacPlus: (bac2?.pourcentage || 0) + (bac3?.pourcentage || 0) + (bac5?.pourcentage || 0)
            };
            const formationDetails: AgeBreakdown[] = [];
            const formMapping: Record<string, string> = {
              SANS: 'Sans diplôme',
              CAPBEP: 'CAP/BEP',
              BAC: 'Bac',
              BAC2: 'Bac+2',
              BAC3EP: 'Bac+3/4',
              BAC5EP: 'Bac+5 et +'
            };
            Object.entries(formMapping).forEach(([code, label]) => {
              const formCaract = caracts.find((c) => c.codeCaract === code);
              if (formCaract?.pourcentage !== undefined) formationDetails.push({ label, value: formCaract.pourcentage });
            });
            if (formationDetails.length > 0) embaucheDetails.formationDetaille = formationDetails;
          }
          if (firstPeriode.valeurSecondairePourcentage !== undefined) {
            embaucheDetails.pourcentageTotal = firstPeriode.valeurSecondairePourcentage;
          }
          result.typeSpecific!.embaucheDetails = embaucheDetails;
        }
      }
      break;
    }
  }

  return result;
}

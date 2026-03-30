export function toNumber(value) {
    if (value === null || value === undefined) return null;
    if (typeof value === 'number') return value;
    if (typeof value === 'string') {
        const parsed = parseFloat(value);
        return Number.isNaN(parsed) ? null : parsed;
    }
    return null;
}

export function extractRawValue(data) {
    if (!data) return null;

    let value = toNumber(data.valeurPrincipaleNombre)
        ?? toNumber(data.valeurPrincipaleDecimale)
        ?? toNumber(data.valeurPrincipaleMontant)
        ?? toNumber(data.valeurPrincipaleTaux)
        ?? toNumber(data.valeur)
        ?? toNumber(data.indicateur);

    if (value !== null) return value;

    if (data.listeValeursParPeriode?.length > 0) {
        const lastPeriode = data.listeValeursParPeriode[data.listeValeursParPeriode.length - 1];

        value = toNumber(lastPeriode?.valeurPrincipaleNombre)
            ?? toNumber(lastPeriode?.valeurPrincipaleDecimale)
            ?? toNumber(lastPeriode?.valeurPrincipaleMontant)
            ?? toNumber(lastPeriode?.valeurPrincipaleTaux)
            ?? toNumber(lastPeriode?.valeur)
            ?? toNumber(lastPeriode?.indicateur);

        if (value !== null) return value;

        if (lastPeriode?.salaireValeurMontant?.length > 0) {
            const sal3 = lastPeriode.salaireValeurMontant.find((salary) => salary.codeNomenclature === 'SAL3');
            if (sal3) {
                value = toNumber(sal3.valeurPrincipaleMontant);
                if (value !== null) return value;
            }

            value = toNumber(lastPeriode.salaireValeurMontant[0]?.valeurPrincipaleMontant);
            if (value !== null) return value;
        }
    }

    return null;
}

export function extractValueLabel(data) {
    if (!data) return null;

    if (data.libIndicateur) return data.libIndicateur;
    if (data.libelle) return data.libelle;
    if (data.label) return data.label;

    if (data.listeValeursParPeriode?.length > 0) {
        const periode = data.listeValeursParPeriode[0];
        if (periode.libIndicateur) return periode.libIndicateur;
        if (periode.libelle) return periode.libelle;
        if (periode.libPeriode) return periode.libPeriode;
    }

    if (data.libTypeValeur) return data.libTypeValeur;
    if (data.libelleIndicateur) return data.libelleIndicateur;

    return null;
}

export function extractDynamiqueLabel(data) {
    if (!data) return null;

    if (data.libIndicateur) return data.libIndicateur;
    if (data.libelle) return data.libelle;

    if (data.listeValeursParPeriode?.length > 0) {
        const periode = data.listeValeursParPeriode[0];
        if (periode.libPeriode) return `Dynamique emploi - ${periode.libPeriode}`;
        if (periode.libTerritoire) return `Dynamique emploi - ${periode.libTerritoire}`;
    }

    return 'Dynamique de l\'emploi';
}

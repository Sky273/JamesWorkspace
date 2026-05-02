export function toNumber(value) {
    if (value === null || value === undefined) return null;
    if (typeof value === 'number') return Number.isFinite(value) ? value : null;
    if (typeof value === 'string') {
        const normalized = normalizeNumericString(value);
        if (!normalized) return null;

        const parsed = Number(normalized);
        return Number.isFinite(parsed) ? parsed : null;
    }
    return null;
}

export function normalizeNumericString(value) {
    let normalized = value
        .trim()
        .replace(/[\s\u00a0\u202f]/g, '')
        .replace(/[^\d,.\-+]/g, '');

    if (!normalized) return '';

    const lastComma = normalized.lastIndexOf(',');
    const lastDot = normalized.lastIndexOf('.');

    if (lastComma !== -1 && lastDot !== -1) {
        if (lastComma > lastDot) {
            normalized = normalized.replace(/\./g, '').replace(',', '.');
        } else {
            normalized = normalized.replace(/,/g, '');
        }
    } else if (lastComma !== -1) {
        normalized = normalized
            .split('')
            .map((char, index) => {
                if (char !== ',') return char;
                return index === lastComma ? '.' : '';
            })
            .join('');
    } else if ((normalized.match(/\./g) || []).length > 1) {
        const lastSeparator = normalized.lastIndexOf('.');
        normalized = normalized
            .split('')
            .map((char, index) => {
                if (char !== '.') return char;
                return index === lastSeparator ? '.' : '';
            })
            .join('');
    }

    return /^[+-]?\d*(\.\d*)?$/.test(normalized) && /\d/.test(normalized)
        ? normalized
        : '';
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

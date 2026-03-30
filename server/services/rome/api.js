import axios from 'axios';
import { ROME_FICHES_METIERS_API_URL } from '../../config/constants.js';
import { getAccessToken, getReferentiel } from '../franceTravail.service.js';

async function getMetiers(log) {
    try {
        log.info('Fetching métiers from referentiel');
        const metiers = await getReferentiel('metiers');
        log.info('Métiers fetched', { count: metiers?.length || 0 });
        return metiers || [];
    } catch (error) {
        log.error('Failed to fetch métiers', { error: error.message });
        throw error;
    }
}

async function getMetierByCode(codeRome, log, allFiches = null) {
    if (allFiches) {
        const fiche = allFiches.find((item) => item.code === codeRome || item.codeRome === codeRome);
        if (fiche) {
            return fiche;
        }
    }

    const token = await getAccessToken();

    try {
        const url = `${ROME_FICHES_METIERS_API_URL}/metier/${codeRome}`;
        log.debug('Fetching fiche métier', { codeRome });

        const response = await axios.get(url, {
            headers: {
                Authorization: `Bearer ${token}`,
                Accept: 'application/json'
            },
            timeout: 30000
        });

        return response.data;
    } catch (error) {
        if (error.response?.status === 401 || error.response?.status === 403) {
            log.warn('Fiches Métiers API access denied', { codeRome, status: error.response?.status });
            return { code: codeRome, libelle: 'Unknown' };
        }

        log.error('Failed to fetch fiche métier', { codeRome, error: error.message });
        throw error;
    }
}

async function getCompetencesByMetier(codeRome, log) {
    try {
        const ficheMetier = await getMetierByCode(codeRome, log);
        return ficheMetier?.competences || ficheMetier?.competencesMobilisees || ficheMetier?.savoirFaire || [];
    } catch (error) {
        log.warn('Failed to get compétences', { codeRome, error: error.message });
        return [];
    }
}

async function getGrandsDomaines(log) {
    try {
        const metiers = await getReferentiel('metiers');
        const grandsDomaines = new Map();
        metiers?.forEach((metier) => {
            if (metier.codeGrandDomaine && !grandsDomaines.has(metier.codeGrandDomaine)) {
                grandsDomaines.set(metier.codeGrandDomaine, {
                    code: metier.codeGrandDomaine,
                    libelle: metier.libelleGrandDomaine || metier.codeGrandDomaine
                });
            }
        });
        return Array.from(grandsDomaines.values());
    } catch (error) {
        log.error('Failed to fetch grands domaines', { error: error.message });
        throw error;
    }
}

async function getDomaines(codeGrandDomaine, log) {
    try {
        const metiers = await getReferentiel('metiers');
        const domaines = new Map();
        metiers?.forEach((metier) => {
            if (metier.codeDomaineProfessionnel && !domaines.has(metier.codeDomaineProfessionnel)) {
                if (!codeGrandDomaine || metier.codeGrandDomaine === codeGrandDomaine) {
                    domaines.set(metier.codeDomaineProfessionnel, {
                        code: metier.codeDomaineProfessionnel,
                        libelle: metier.libelleDomaineProfessionnel || metier.codeDomaineProfessionnel,
                        codeGrandDomaine: metier.codeGrandDomaine
                    });
                }
            }
        });
        return Array.from(domaines.values());
    } catch (error) {
        log.error('Failed to fetch domaines', { error: error.message });
        throw error;
    }
}

async function searchMetiers(keyword, log) {
    try {
        const metiers = await getReferentiel('metiers');
        const lowerKeyword = keyword.toLowerCase();
        return metiers?.filter(
            (metier) =>
                metier.libelle?.toLowerCase().includes(lowerKeyword) ||
                metier.code?.toLowerCase().includes(lowerKeyword)
        ) || [];
    } catch (error) {
        log.error('Search failed', { keyword, error: error.message });
        throw error;
    }
}

async function getITMetiers(log) {
    try {
        log.info('Fetching IT métiers from referentiel');
        const allMetiers = await getReferentiel('metiers');
        log.info('Total métiers from referentiel', { count: allMetiers?.length || 0 });

        const itMetiers = allMetiers?.filter((metier) => metier.code?.startsWith('M18')) || [];
        log.info('IT métiers filtered', { count: itMetiers.length });
        return itMetiers;
    } catch (error) {
        log.error('Failed to fetch IT métiers', { error: error.message });
        throw error;
    }
}

async function fetchFicheMetierForCollection(codeRome, log) {
    const ficheUrl = `${ROME_FICHES_METIERS_API_URL}/fiches-rome/fiche-metier/${codeRome}`;
    log.debug('Fetching fiche', { url: ficheUrl });

    const token = await getAccessToken();
    const response = await axios.get(ficheUrl, {
        headers: {
            Authorization: `Bearer ${token}`,
            Accept: 'application/json'
        },
        timeout: 30000
    });

    return response.data;
}

export {
    fetchFicheMetierForCollection,
    getCompetencesByMetier,
    getDomaines,
    getGrandsDomaines,
    getITMetiers,
    getMetierByCode,
    getMetiers,
    searchMetiers
};

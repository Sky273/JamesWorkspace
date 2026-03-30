import { query as dbQuery } from '../../config/database.js';

function extractCompetencesFromFiche(metier) {
    const result = {
        competencesDetaillees: [],
        macroSavoirFaire: [],
        enjeux: []
    };

    const groupes = metier.groupesCompetencesMobilisees;
    if (!groupes || !Array.isArray(groupes)) {
        return result;
    }

    const enjeuxSet = new Set();

    for (const groupe of groupes) {
        if (groupe.enjeu) {
            const enjeuKey = `${groupe.enjeu.code}|${groupe.enjeu.libelle}`;
            if (!enjeuxSet.has(enjeuKey)) {
                enjeuxSet.add(enjeuKey);
                result.enjeux.push({
                    code: groupe.enjeu.code,
                    libelle: groupe.enjeu.libelle
                });
            }
        }

        if (groupe.competences && Array.isArray(groupe.competences)) {
            for (const comp of groupe.competences) {
                const competence = {
                    code: comp.code,
                    libelle: comp.libelle,
                    enjeu: groupe.enjeu?.libelle || null
                };

                if (comp.type === 'COMPETENCE-DETAILLEE') {
                    result.competencesDetaillees.push(competence);
                } else if (comp.type === 'MACRO-SAVOIR-FAIRE') {
                    result.macroSavoirFaire.push(competence);
                }
            }
        }
    }

    return result;
}

function extractSavoirsFromFiche(metier) {
    const savoirs = [];
    const groupes = metier.groupesSavoirs;

    if (!groupes || !Array.isArray(groupes)) {
        return savoirs;
    }

    for (const groupe of groupes) {
        if (groupe.savoirs && Array.isArray(groupe.savoirs)) {
            for (const savoir of groupe.savoirs) {
                savoirs.push({
                    code: savoir.code,
                    libelle: savoir.libelle,
                    categorie: groupe.categorie?.libelle || null
                });
            }
        }
    }

    return savoirs;
}

async function storeMetier(metier, log) {
    try {
        const competencesData = extractCompetencesFromFiche(metier);
        const savoirsData = extractSavoirsFromFiche(metier);

        const codeRome = metier.code || metier.codeRome;
        const libelle = metier.metier?.libelle || metier.libelle || null;
        const obsolete = metier.obsolete === true;
        const enjeux = competencesData.enjeux.length > 0 ? JSON.stringify(competencesData.enjeux) : null;
        const competencesDetaillees = competencesData.competencesDetaillees.length > 0
            ? JSON.stringify(competencesData.competencesDetaillees)
            : null;
        const macroSavoirFaire = competencesData.macroSavoirFaire.length > 0
            ? JSON.stringify(competencesData.macroSavoirFaire)
            : null;
        const savoirs = savoirsData.length > 0 ? JSON.stringify(savoirsData) : null;

        const existing = await dbQuery('SELECT id FROM rome_metiers WHERE code_rome = $1', [codeRome]);

        if (existing.rows.length > 0) {
            const result = await dbQuery(
                `UPDATE rome_metiers SET 
                    libelle = $1, obsolete = $2, enjeux = $3, 
                    competences = $4, macro_savoir_faire = $5, savoirs = $6,
                    updated_at = NOW()
                WHERE code_rome = $7 RETURNING *`,
                [libelle, obsolete, enjeux, competencesDetaillees, macroSavoirFaire, savoirs, codeRome]
            );
            return { action: 'updated', record: result.rows[0] };
        }

        const result = await dbQuery(
            `INSERT INTO rome_metiers (code_rome, libelle, obsolete, enjeux, competences, macro_savoir_faire, savoirs)
            VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
            [codeRome, libelle, obsolete, enjeux, competencesDetaillees, macroSavoirFaire, savoirs]
        );
        return { action: 'created', record: result.rows[0] };
    } catch (error) {
        log.error('Failed to store métier', { code: metier.code || metier.codeRome, error: error.message });
        throw error;
    }
}

function mapStoredMetierRecord(record, includeDetails) {
    const metier = {
        id: record.id,
        CodeRome: record.code_rome,
        Libelle: record.libelle,
        Obsolete: record.obsolete || false,
        LastUpdated: record.updated_at
    };

    if (includeDetails) {
        metier.Enjeux = record.enjeux ? (typeof record.enjeux === 'string' ? JSON.parse(record.enjeux) : record.enjeux) : [];
        metier.CompetencesDetaillees = record.competences
            ? (typeof record.competences === 'string' ? JSON.parse(record.competences) : record.competences)
            : [];
        metier.MacroSavoirFaire = record.macro_savoir_faire
            ? (typeof record.macro_savoir_faire === 'string' ? JSON.parse(record.macro_savoir_faire) : record.macro_savoir_faire)
            : [];
        metier.Savoirs = record.savoirs
            ? (typeof record.savoirs === 'string' ? JSON.parse(record.savoirs) : record.savoirs)
            : [];
    }

    return metier;
}

async function queryStoredMetiers(filters = {}) {
    const includeDetails = filters.includeDetails === true || filters.includeDetails === 'true';

    let whereClause = '';
    const params = [];
    let paramIndex = 1;

    if (filters.codeRome) {
        whereClause = `WHERE code_rome = $${paramIndex}`;
        params.push(filters.codeRome);
        paramIndex++;
    } else if (filters.grandDomaine) {
        whereClause = `WHERE code_grand_domaine = $${paramIndex}`;
        params.push(filters.grandDomaine);
        paramIndex++;
    } else if (filters.search) {
        whereClause = `WHERE libelle ILIKE $${paramIndex} OR code_rome ILIKE $${paramIndex}`;
        params.push(`%${filters.search}%`);
        paramIndex++;
    }

    const columns = includeDetails
        ? 'id, code_rome, libelle, obsolete, enjeux, competences, macro_savoir_faire, savoirs, updated_at'
        : 'id, code_rome, libelle, obsolete, updated_at';

    const result = await dbQuery(
        `SELECT ${columns} FROM rome_metiers ${whereClause} ORDER BY code_rome ASC`,
        params
    );

    return result.rows.map((record) => mapStoredMetierRecord(record, includeDetails));
}

async function getMetiersStats(log) {
    try {
        const countResult = await dbQuery('SELECT COUNT(*) as total, MAX(updated_at) as last_updated FROM rome_metiers');
        const totalMetiers = parseInt(countResult.rows[0]?.total || 0, 10);
        const lastUpdated = countResult.rows[0]?.last_updated;

        const competencesResult = await dbQuery(`
            SELECT 
                COALESCE(SUM(jsonb_array_length(COALESCE(competences, '[]'::jsonb))), 0) as total_competences,
                COALESCE(SUM(jsonb_array_length(COALESCE(macro_savoir_faire, '[]'::jsonb))), 0) as total_macro,
                COALESCE(SUM(jsonb_array_length(COALESCE(savoirs, '[]'::jsonb))), 0) as total_savoirs
            FROM rome_metiers
        `);

        const totalCompetencesDetaillees = parseInt(competencesResult.rows[0]?.total_competences || 0, 10);
        const totalMacroSavoirFaire = parseInt(competencesResult.rows[0]?.total_macro || 0, 10);
        const totalSavoirs = parseInt(competencesResult.rows[0]?.total_savoirs || 0, 10);

        return {
            totalMetiers,
            totalCompetences: totalCompetencesDetaillees + totalMacroSavoirFaire,
            totalCompetencesDetaillees,
            totalMacroSavoirFaire,
            totalSavoirs,
            lastUpdated
        };
    } catch (error) {
        log.error('Failed to get métiers stats', { error: error.message });
        throw error;
    }
}

export {
    getMetiersStats,
    queryStoredMetiers,
    storeMetier
};

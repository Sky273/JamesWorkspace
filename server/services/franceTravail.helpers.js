export function isFranceTravailTokenError(error) {
    const responseData = error.response?.data;
    return error.response?.status === 401
        || (typeof responseData === 'string' && responseData.includes('Mal_wellFormed'))
        || (responseData?.error === 'Mal_wellFormed')
        || (responseData?.message?.includes?.('Mal_wellFormed'));
}

export function buildFranceTravailSearchParams(params = {}) {
    const queryParams = new URLSearchParams();

    if (params.motsCles) queryParams.append('motsCles', params.motsCles);
    if (params.codeROME) queryParams.append('codeROME', params.codeROME);
    if (params.departement) queryParams.append('departement', params.departement);
    if (params.region) queryParams.append('region', params.region);
    if (params.commune) queryParams.append('commune', params.commune);
    if (params.typeContrat) queryParams.append('typeContrat', params.typeContrat);
    if (params.experience) queryParams.append('experience', params.experience);

    queryParams.append('range', params.range || '0-149');
    return queryParams;
}

export function normalizeFranceTravailSearchResponse(response) {
    const contentRange = response.headers['content-range'];
    const totalCount = contentRange ? parseInt(contentRange.split('/')[1]) : 0;

    return {
        results: response.data.resultats || [],
        filters: response.data.filtresPossibles || [],
        totalCount,
        contentRange
    };
}


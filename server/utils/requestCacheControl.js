export function shouldBypassCache(req) {
    const refresh = req?.query?.refresh;
    return refresh === '1' || refresh === 'true';
}


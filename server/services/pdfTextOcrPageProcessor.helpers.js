export async function unlinkQuietly(fs, filePath) {
    if (!filePath) {
        return;
    }

    await fs.unlink(filePath).catch(() => {});
}

export async function unlinkMany(fs, items = []) {
    for (const item of items) {
        await unlinkQuietly(fs, item?.path);
    }
}

export function createAdvancedFallback(engine) {
    return {
        text: '',
        confidence: 0,
        score: 0,
        engine,
        psm: null
    };
}

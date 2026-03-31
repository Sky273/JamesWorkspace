const DEFAULT_MIN_SCANNED_TEXT_LENGTH = 5;
const DEFAULT_MIN_SCANNED_ITEMS = 5;
const DEFAULT_OCR_DARK_PIXEL_THRESHOLD = 245;

function normalizeExtractedText(text) {
    return text
        .replace(/[ \t]+/g, ' ')
        .replace(/\n{3,}/g, '\n\n')
        .trim();
}

export function getScannedPageInfo(
    textContent,
    minTextLength = DEFAULT_MIN_SCANNED_TEXT_LENGTH,
    minItems = DEFAULT_MIN_SCANNED_ITEMS
) {
    const totalTextLength = textContent.items.reduce((sum, item) => sum + (item.str || '').length, 0);
    return {
        totalTextLength,
        scanned: totalTextLength < minTextLength && textContent.items.length < minItems
    };
}

export function findInkBoundingBox(
    imageData,
    width,
    height,
    darkPixelThreshold = DEFAULT_OCR_DARK_PIXEL_THRESHOLD
) {
    let minX = width;
    let minY = height;
    let maxX = -1;
    let maxY = -1;

    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const offset = (y * width + x) * 4;
            const r = imageData[offset];
            const g = imageData[offset + 1];
            const b = imageData[offset + 2];
            const alpha = imageData[offset + 3];

            if (alpha > 0 && (r < darkPixelThreshold || g < darkPixelThreshold || b < darkPixelThreshold)) {
                if (x < minX) minX = x;
                if (y < minY) minY = y;
                if (x > maxX) maxX = x;
                if (y > maxY) maxY = y;
            }
        }
    }

    if (maxX < minX || maxY < minY) {
        return null;
    }

    return { minX, minY, maxX, maxY };
}

export function scoreOcrResult(text, confidence) {
    return (text?.trim().length || 0) + ((confidence || 0) * 2);
}

export function getTextLength(value) {
    return value?.text?.trim().length || 0;
}

export function scoreOcrCandidateQuality(text, confidence = 0) {
    const normalized = normalizeExtractedText(text || '');
    const length = normalized.length;
    if (!length) {
        return 0;
    }

    const words = normalized.match(/[A-Za-zÀ-ÿ]{2,}/g) || [];
    const emailMatches = normalized.match(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g) || [];
    const phoneMatches = normalized.match(/(?:\+\d{1,3}\s*)?(?:\d[\s.-]*){8,}/g) || [];
    const yearMatches = normalized.match(/\b(?:19|20)\d{2}\b/g) || [];
    const sectionMatches = normalized.match(/\b(PROFIL|EXPERIENCE|EXPÉRIENCE|COMPETENCES|COMPÉTENCES|FORMATION|LANGUES|SKILLS|SUMMARY|EDUCATION)\b/gi) || [];
    const alphaChars = (normalized.match(/[A-Za-zÀ-ÿ]/g) || []).length;
    const weirdChars = (normalized.match(/[^A-Za-zÀ-ÿ0-9\s@.+,;:()/'"!?&%#\-|]/g) || []).length;
    const lineCount = normalized.split('\n').filter((line) => line.trim().length > 0).length;
    const avgWordLength = words.length
        ? words.reduce((sum, word) => sum + word.length, 0) / words.length
        : 0;

    let score = 0;
    score += Math.min(180, length * 0.45);
    score += Math.min(70, words.length * 3);
    score += Math.min(35, lineCount * 4);
    score += emailMatches.length * 40;
    score += phoneMatches.length * 25;
    score += Math.min(20, yearMatches.length * 5);
    score += Math.min(24, sectionMatches.length * 6);
    score += Math.min(25, confidence * 0.4);

    if (alphaChars > 0) {
        const weirdRatio = weirdChars / Math.max(alphaChars + weirdChars, 1);
        const alphaRatio = alphaChars / Math.max(length, 1);
        score -= weirdRatio * 120;
        score += alphaRatio * 20;
    }

    if (avgWordLength < 3.2 && words.length > 20) {
        score -= 25;
    }

    return Math.max(0, Math.round(score));
}

export function buildOcrCandidate(variant, recognition) {
    return {
        variant,
        text: recognition.text,
        confidence: recognition.confidence,
        score: scoreOcrCandidateQuality(recognition.text, recognition.confidence),
        engine: recognition.engine,
        psm: recognition.psm
    };
}

export function scoreBlockSequence(results = []) {
    return results.reduce((sum, result) => sum + scoreOcrResult(result.text, result.confidence), 0);
}

export function buildBlockSequenceText(results = []) {
    return results
        .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
        .map((result) => (result.text || '').trim())
        .filter(Boolean)
        .join('\n\n')
        .trim();
}

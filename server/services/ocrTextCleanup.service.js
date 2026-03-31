import { cleanupText, decodeHtmlEntities, normalizeUtf8Text } from './openai/textUtils.js';

const PLACEHOLDER_NAME_PATTERNS = [
    /^X{2,}$/i,
    /^CAN$/i,
    /^CANDIDAT(?:\s*#?\s*\d+)?$/i,
    /^CANDIDATE(?:\s*#?\s*\d+)?$/i,
    /^CV(?:\s*#?\s*\d+)?$/i,
    /^RESUME(?:\s*#?\s*\d+)?$/i,
    /^PROFILE(?:\s*#?\s*\d+)?$/i,
    /^PROFIL(?:\s*#?\s*\d+)?$/i,
    /^NOM\s+PRENOM$/i,
    /^PRENOM\s+NOM$/i,
    /^FIRST\s+LAST$/i,
    /^FIRSTNAME\s+LASTNAME$/i
];

function normalizeLine(line) {
    return line
        .replace(/\u00a0/g, ' ')
        .replace(/[\u200B-\u200D\uFEFF]/g, '')
        .replace(/[•·▪◦]/g, '-')
        .replace(/[ \t]+/g, ' ')
        .trim();
}

function fixOcrEmailArtifacts(text) {
    return text
        .replace(/([A-Za-z0-9._%+-])\s*@\s*([A-Za-z0-9.-]+\.[A-Za-z]{2,})/g, '$1@$2')
        .replace(/([A-Za-z0-9._%+-]+)\s*@\s*([A-Za-z0-9.-]+)/g, '$1@$2')
        .replace(/([A-Za-z0-9])\s*\.\s*([A-Za-z0-9])/g, '$1.$2')
        .replace(/@([A-Za-z0-9-]+)\.?(com|fr|net|org|io)\b/gi, '@$1.$2');
}

function fixOcrPhoneArtifacts(text) {
    return text
        .replace(/(\+\d{1,3})\s*[-.]\s*(\d)/g, '$1 $2')
        .replace(/(\d)\s*[-.]\s*(\d)/g, '$1 $2');
}

function fixCommonOcrWordArtifacts(text) {
    return text
        .replace(/\b[Cc]hetde\b/g, 'Chef de')
        .replace(/\b[Cc]hefde\b/g, 'Chef de')
        .replace(/\b[Pp]royet\b/g, 'Projet')
        .replace(/\b[Ee]xp[üu]rience\b/g, 'experience')
        .replace(/\b[Dd]alploiement\b/g, 'Deploiement')
        .replace(/\b[Mm]a2\b/g, 'M€')
        .replace(/\b((?:19|20)\d{2})((?:19|20)\d{2})\b/g, '$1 $2')
        .replace(/\b([A-Za-zÀ-ÿ]{3,})(\d{4})\b/g, '$1 $2')
        .replace(/\b(\d{4})([A-Za-zÀ-ÿ]{3,})\b/g, '$1 $2')
        .replace(/([A-Za-zÀ-ÿ])\|([A-Za-zÀ-ÿ])/g, '$1 | $2')
        .replace(/([A-Za-zÀ-ÿ])([A-Z][a-z]{2,})/g, '$1 $2')
        .replace(/\b([A-Z]{2,})\s+([A-Z]{2,})\b/g, '$1 $2');
}

function improveSectionBreaks(text) {
    return text
        .replace(
            /\b(FORMATIONS?\s+ET\s+DIPLOMES?|FORMATION ACAD[ÉE]MIQUE|EXPERIENCES? PROFESSIONNELLES?|CENTRES D['’ ]INT[ÉE]R[ÊE]T|COORDONNEES|COORDONNÉES|POSTES\s+RECHERCH[ÉE]S|PASSIONS?\s+ET\s+SOFT\s+SKILLS|R[EÉ]SUM[EÉ]|CONTACT|PROFIL|EXPERIENCES?|EXP[ÉE]RIENCES?|COMPETENCES?(?:\s+PROFESSIONNELLES?)?|COMP[ÉE]TENCES?(?:\s+PROFESSIONNELLES?)?|FORMATIONS?|LANGUES?|CERTIFICATIONS?|LOISIRS)\b\s*/gi,
            '\n$1\n'
        )
        .replace(/([a-zÀ-ÿ])\.([A-ZÀ-Ý][A-ZÀ-Ý '&/-]{2,}\s*(?:\(|\d{4}))/g, '$1.\n$2')
        .replace(/\s+-\s+(?=[A-Za-zÀ-ÿ])/g, '\n- ')
        .replace(/\s+\|\s+/g, '\n')
        .replace(/\s*;\s+(?=[A-ZÀ-Ý])/g, '\n')
        .replace(
            /\s+(?=(?:Depuis\s+)?(?:(?:0?[1-9]|1[0-2])\/\d{4}|\d{4})\s*(?:-|–|—|à)\s*(?:(?:0?[1-9]|1[0-2])\/\d{4}|\d{4}|Aujourd'hui|Aujourd’hui|Present|Présent))/gi,
            '\n'
        )
        .replace(/\n{3,}/g, '\n\n');
}

function applyMinimalResumeFormatting(text) {
    return improveSectionBreaks(
        fixOcrPhoneArtifacts(
            fixOcrEmailArtifacts(text)
        )
    )
        .replace(/\n(COMP[ÉE]TENCES?|EXP[ÉE]RIENCES?|FORMATIONS?)\n(professionnelles?|techniques?|et dipl[oô]mes?)\b/gi, '\n$1 $2\n')
        .replace(/((?:0?[1-9]|1[0-2])\/\d{4})\s+((?:0?[1-9]|1[0-2])\/\d{4})/g, '$1 - $2')
        .replace(/\b((?:19|20)\d{2})\s+((?:19|20)\d{2})\b/g, '$1 - $2')
        .replace(/\n-\s*\n/g, '\n')
        .replace(/\n{3,}/g, '\n\n')
        .split('\n')
        .map((line) => line.trim())
        .join('\n')
        .trim();
}

export function cleanExtractedResumeText(text, options = {}) {
    if (!text || typeof text !== 'string') {
        return {
            text,
            metadata: {
                changed: false,
                ocrOptimized: false,
                originalLength: text?.length || 0,
                cleanedLength: text?.length || 0
            }
        };
    }

    const { ocrUsed = false } = options;
    const originalLength = text.length;
    let cleaned = cleanupText(text);

    cleaned = decodeHtmlEntities(normalizeUtf8Text(cleaned));
    cleaned = cleaned.replace(/\r\n?/g, '\n');
    cleaned = cleaned
        .split('\n')
        .map(normalizeLine)
        .join('\n')
        .replace(/\n{3,}/g, '\n\n')
        .trim();

    cleaned = applyMinimalResumeFormatting(cleaned);

    if (ocrUsed) {
        cleaned = fixCommonOcrWordArtifacts(cleaned);
        cleaned = cleaned
            .replace(/\b([A-Z])\s+([A-Z])\s+([A-Z])\b/g, '$1$2$3')
            .replace(/([A-Za-z])\s+\|\s+([A-Za-z])/g, '$1 | $2')
            .replace(/\n-\s*\n/g, '\n')
            .replace(/\n{3,}/g, '\n\n')
            .trim();
    }

    return {
        text: cleaned,
        metadata: {
            changed: cleaned !== text,
            ocrOptimized: ocrUsed,
            originalLength,
            cleanedLength: cleaned.length
        }
    };
}

export function isPlaceholderCandidateName(name) {
    if (!name || typeof name !== 'string') {
        return true;
    }

    const normalized = normalizeUtf8Text(name)
        .replace(/\s+/g, ' ')
        .trim();

    if (!normalized) {
        return true;
    }

    return PLACEHOLDER_NAME_PATTERNS.some((pattern) => pattern.test(normalized));
}

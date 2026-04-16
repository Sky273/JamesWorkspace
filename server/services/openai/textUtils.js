/**
 * OpenAI Text Utilities
 * HTML entity decoding, text cleanup, and HTML cleanup functions
 */

/**
 * HTML entities mapping for text cleanup
 */
const HTML_ENTITIES = {
    '&nbsp;': ' ',
    '&amp;': '&',
    '&lt;': '<',
    '&gt;': '>',
    '&quot;': '"',
    '&#39;': "'",
    '&apos;': "'",
    '&laquo;': '\u00ab',
    '&raquo;': '\u00bb',
    '&ldquo;': '\u201c',
    '&rdquo;': '\u201d',
    '&lsquo;': '\u2018',
    '&rsquo;': '\u2019',
    '&ndash;': '\u2013',
    '&mdash;': '\u2014',
    '&hellip;': '\u2026',
    '&bull;': '\u2022',
    '&middot;': '\u00b7',
    '&copy;': '\u00a9',
    '&reg;': '\u00ae',
    '&trade;': '\u2122',
    '&euro;': '\u20ac',
    '&pound;': '\u00a3',
    '&yen;': '\u00a5',
    '&cent;': '\u00a2',
    '&deg;': '\u00b0',
    '&plusmn;': '\u00b1',
    '&times;': '\u00d7',
    '&divide;': '\u00f7',
    '&frac12;': '\u00bd',
    '&frac14;': '\u00bc',
    '&frac34;': '\u00be',
    '&sup2;': '\u00b2',
    '&sup3;': '\u00b3',
    '&acute;': '\u00b4',
    '&cedil;': '\u00b8',
    '&iexcl;': '\u00a1',
    '&iquest;': '\u00bf',
    '&sect;': '\u00a7',
    '&para;': '\u00b6',
    '&dagger;': '\u2020',
    '&Dagger;': '\u2021',
    '&permil;': '\u2030'
};

const MOJIBAKE_SEQUENCES = ['\\u00c3', '\\u00c2', '\\u00e2\\u20ac', '\\u00e2\\u20ac\\u201c', '\\u00e2\\u20ac\\u201d', '\\u00e2\\u20ac\\u00a6', '\\u00e2\\u20ac\\u00a2', '\\u00ef\\u00bf\\u00bd'];

function sanitizeJsonLikePayload(text) {
    if (!text || typeof text !== 'string') {
        return text;
    }

    return text
        .replace(/^\uFEFF/, '')
        .replaceAll('\u0000', '')
        .trim();
}

export function normalizeUtf8Text(text) {
    if (!text || typeof text !== 'string') {
        return text;
    }

    if (!MOJIBAKE_SEQUENCES.some(sequence => text.includes(sequence))) {
        return text;
    }

    const repaired = Buffer.from(text, 'latin1').toString('utf8');
    const originalHits = MOJIBAKE_SEQUENCES.reduce((count, sequence) => count + (text.split(sequence).length - 1), 0);
    const repairedHits = MOJIBAKE_SEQUENCES.reduce((count, sequence) => count + (repaired.split(sequence).length - 1), 0);

    if (repaired.includes('\u0000')) {
        return text;
    }

    return repairedHits < originalHits ? repaired : text;
}

export function decodeHtmlEntities(text) {
    if (!text) return text;

    let decoded = normalizeUtf8Text(text);

    for (const [entity, char] of Object.entries(HTML_ENTITIES)) {
        decoded = decoded.replace(new RegExp(entity, 'gi'), char);
    }

    decoded = decoded.replace(/&#(\d+);/g, (match, dec) => String.fromCharCode(parseInt(dec, 10)));
    decoded = decoded.replace(/&#x([0-9a-fA-F]+);/g, (match, hex) => String.fromCharCode(parseInt(hex, 16)));

    return decoded;
}

export function stripLlmThinkingContent(text) {
    if (!text || typeof text !== 'string') {
        return text;
    }

    let cleaned = normalizeUtf8Text(text).trim();

    cleaned = cleaned
        .replace(/<think>[\s\S]*?<\/think>/gi, '')
        .replace(/<thinking>[\s\S]*?<\/thinking>/gi, '')
        .trim();

    const firstJsonObject = cleaned.indexOf('{');
    const firstJsonArray = cleaned.indexOf('[');
    const jsonStartCandidates = [firstJsonObject, firstJsonArray].filter(index => index >= 0);
    const firstJsonStart = jsonStartCandidates.length > 0 ? Math.min(...jsonStartCandidates) : -1;

    if (firstJsonStart >= 0) {
        const beforeJson = cleaned.slice(0, firstJsonStart);
        if (/<think(?:ing)?>/i.test(beforeJson)) {
            cleaned = cleaned.slice(firstJsonStart);
        }
    }

    return cleaned
        .replace(/^```(?:json|html)?\s*/i, '')
        .replace(/\s*```$/i, '')
        .trim();
}

export function extractJsonPayload(text) {
    const cleaned = sanitizeJsonLikePayload(stripLlmThinkingContent(text));
    if (!cleaned) {
        return cleaned;
    }

    const directParse = (() => {
        try {
            JSON.parse(cleaned);
            return cleaned;
        } catch {
            return null;
        }
    })();

    if (directParse) {
        return directParse;
    }

    const firstBrace = cleaned.indexOf('{');
    const firstBracket = cleaned.indexOf('[');
    const startCandidates = [firstBrace, firstBracket].filter(index => index >= 0);
    if (startCandidates.length === 0) {
        return cleaned;
    }

    const startIndex = Math.min(...startCandidates);
    const openingChar = cleaned[startIndex];
    const closingChar = openingChar === '{' ? '}' : ']';

    let depth = 0;
    let inString = false;
    let escapeNext = false;

    for (let index = startIndex; index < cleaned.length; index++) {
        const char = cleaned[index];

        if (escapeNext) {
            escapeNext = false;
            continue;
        }

        if (char === '\\') {
            escapeNext = true;
            continue;
        }

        if (char === '"') {
            inString = !inString;
            continue;
        }

        if (inString) {
            continue;
        }

        if (char === openingChar) {
            depth++;
        } else if (char === closingChar) {
            depth--;
            if (depth === 0) {
                return cleaned.slice(startIndex, index + 1).trim();
            }
        }
    }

    return cleaned.slice(startIndex).trim();
}

function repairMalformedJsonStrings(text) {
    if (!text || typeof text !== 'string') {
        return text;
    }

    let result = '';
    let inString = false;
    let escapeNext = false;

    for (let index = 0; index < text.length; index++) {
        const char = text[index];

        if (escapeNext) {
            result += char;
            escapeNext = false;
            continue;
        }

        if (char === '\\') {
            result += char;
            escapeNext = true;
            continue;
        }

        if (char === '"') {
            if (!inString) {
                inString = true;
                result += char;
                continue;
            }

            let lookaheadIndex = index + 1;
            while (lookaheadIndex < text.length && /\s/.test(text[lookaheadIndex])) {
                lookaheadIndex++;
            }
            const nextSignificantChar = text[lookaheadIndex];

            if (nextSignificantChar === ',' || nextSignificantChar === '}' || nextSignificantChar === ']' || nextSignificantChar === ':' || nextSignificantChar === undefined) {
                inString = false;
                result += char;
                continue;
            }

            result += '\\"';
            continue;
        }

        if (inString) {
            if (char === '\n') {
                result += '\\n';
                continue;
            }
            if (char === '\r') {
                result += '\\r';
                continue;
            }
            if (char === '\t') {
                result += '\\t';
                continue;
            }
        }

        result += char;
    }

    return result;
}
function escapeJsonControlCharacters(text) {
    if (!text || typeof text !== 'string') {
        return text;
    }

    let result = '';
    let inString = false;
    let escapeNext = false;

    for (const char of text) {
        if (escapeNext) {
            result += char;
            escapeNext = false;
            continue;
        }

        if (char === '\\') {
            result += char;
            escapeNext = true;
            continue;
        }

        if (char === '"') {
            result += char;
            inString = !inString;
            continue;
        }

        if (inString) {
            if (char === '\n') {
                result += '\\n';
                continue;
            }
            if (char === '\r') {
                result += '\\r';
                continue;
            }
            if (char === '\t') {
                result += '\\t';
                continue;
            }
        }

        result += char;
    }

    return result;
}

function removeTrailingJsonCommas(text) {
    if (!text || typeof text !== 'string') {
        return text;
    }

    return text.replace(/,\s*([}\]])/g, '$1');
}

function stripJsonComments(text) {
    if (!text || typeof text !== 'string') {
        return text;
    }

    let result = '';
    let inString = false;
    let escapeNext = false;

    for (let index = 0; index < text.length; index++) {
        const char = text[index];
        const nextChar = text[index + 1];

        if (escapeNext) {
            result += char;
            escapeNext = false;
            continue;
        }

        if (char === '\\') {
            result += char;
            escapeNext = true;
            continue;
        }

        if (char === '"') {
            result += char;
            inString = !inString;
            continue;
        }

        if (!inString && char === '/' && nextChar === '/') {
            index += 2;
            while (index < text.length && text[index] !== '\n' && text[index] !== '\r') {
                index++;
            }
            index--;
            continue;
        }

        if (!inString && char === '/' && nextChar === '*') {
            index += 2;
            while (index < text.length - 1 && !(text[index] === '*' && text[index + 1] === '/')) {
                index++;
            }
            index++;
            continue;
        }

        result += char;
    }

    return result;
}

function normalizeJsonQuotes(text) {
    if (!text || typeof text !== 'string') {
        return text;
    }

    return text
        .replace(/[\u201c\u201d\u00ab\u00bb]/g, '"')
        .replace(/[\u2018\u2019]/g, '\'');
}

function insertMissingJsonCommas(text) {
    if (!text || typeof text !== 'string') {
        return text;
    }

    return text
        .replace(
            /("(?:\\.|[^"\\])*")\s+("(?:\\.|[^"\\])*"\s*:)/g,
            '$1,$2'
        )
        .replace(
            /(\}|\]|-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?|\btrue\b|\bfalse\b|\bnull\b)\s+("(?:\\.|[^"\\])*"\s*:)/g,
            '$1,$2'
        );
}

function removeDuplicateJsonSeparators(text) {
    if (!text || typeof text !== 'string') {
        return text;
    }

    return text
        .replace(/,\s*,+/g, ',')
        .replace(/:\s*:+/g, ':')
        .replace(/,\s*:/g, ':')
        .replace(/:\s*,/g, ':');
}

function balanceJsonDelimiters(text) {
    if (!text || typeof text !== 'string') {
        return text;
    }

    const stack = [];
    let inString = false;
    let escapeNext = false;

    for (const char of text) {
        if (escapeNext) {
            escapeNext = false;
            continue;
        }

        if (char === '\\') {
            escapeNext = true;
            continue;
        }

        if (char === '"') {
            inString = !inString;
            continue;
        }

        if (inString) {
            continue;
        }

        if (char === '{') {
            stack.push('}');
        } else if (char === '[') {
            stack.push(']');
        } else if ((char === '}' || char === ']') && stack[stack.length - 1] === char) {
            stack.pop();
        }
    }

    if (inString) {
        return text;
    }

    return `${text}${stack.reverse().join('')}`;
}

export function parseJsonFromLlmResponse(text) {
    const payload = extractJsonPayload(text);

    try {
        return JSON.parse(payload);
    } catch (error) {
        const repairedPayload = removeTrailingJsonCommas(
            repairMalformedJsonStrings(
                removeDuplicateJsonSeparators(
                    insertMissingJsonCommas(
                        balanceJsonDelimiters(
                            escapeJsonControlCharacters(
                                stripJsonComments(
                                    normalizeJsonQuotes(
                                        sanitizeJsonLikePayload(payload)
                                    )
                                )
                            )
                        )
                    )
                )
            )
        );
        if (repairedPayload !== payload) {
            return JSON.parse(repairedPayload);
        }
        throw error;
    }
}

function sanitizeLooseAnalysisLine(line) {
    return normalizeUtf8Text(String(line || ''))
        .replace(/^\s*[-*•]\s+/, '')
        .replace(/^\s*\d+[.)]\s+/, '')
        .trim();
}

function parseLooseListValue(value) {
    return String(value || '')
        .split(/\r?\n|[;,]/)
        .map(item => sanitizeLooseAnalysisLine(item))
        .filter(Boolean);
}

function parseLooseScore(value) {
    const match = String(value || '').match(/(\d{1,3})\s*%?/);
    if (!match) {
        return null;
    }

    const numeric = Number.parseInt(match[1], 10);
    if (!Number.isFinite(numeric)) {
        return null;
    }

    return `${Math.max(0, Math.min(100, numeric))}%`;
}

function mapLooseAnalysisSectionKey(rawKey) {
    const normalized = normalizeUtf8Text(String(rawKey || ''))
        .toLowerCase()
        .replace(/[`*_#]/g, '')
        .replace(/\s+/g, ' ')
        .trim();

    if (!normalized) {
        return null;
    }

    if (/^(name|nom|candidate|candidate name)$/.test(normalized)) return { kind: 'field', key: 'name' };
    if (/^(title|poste|role|professional title|job title)$/.test(normalized)) return { kind: 'field', key: 'title' };
    if (/^(summary|resume summary|profile summary)$/.test(normalized)) return { kind: 'field', key: 'Summary' };
    if (/^(global rating|overall rating|overall score|score global|note globale)$/.test(normalized)) return { kind: 'field', key: 'globalRating', score: true };
    if (/^(executive summary|executive summary rating|summary rating|resume summary rating)$/.test(normalized)) return { kind: 'field', key: 'executiveSummaryRating', score: true };
    if (/^(skills rating|skills score|competences rating|competences score)$/.test(normalized)) return { kind: 'field', key: 'skillsRating', score: true };
    if (/^(experience|experiences|experience rating|work experience rating)$/.test(normalized)) return { kind: 'field', key: 'experiencesRating', score: true };
    if (/^(education|education rating|formation|formation rating)$/.test(normalized)) return { kind: 'field', key: 'educationRating', score: true };
    if (/^(hobbies languages|hobbies & languages|languages & hobbies|languages and hobbies|languages|hobbies)$/.test(normalized)) return { kind: 'field', key: 'hobbiesLanguagesRating', score: true };
    if (/^(ats|ats compatibility|ats optimization|ats optimization rating)$/.test(normalized)) return { kind: 'field', key: 'atsOptimizationRating', score: true };

    if (/^(top skills|skills keywords|skills|competences|comp[eé]tences)$/.test(normalized)) return { kind: 'section', key: 'skills' };
    if (/^(top industries|industries|industry|secteurs)$/.test(normalized)) return { kind: 'section', key: 'industries' };
    if (/^(top tools|tools|technologies|stack|outils)$/.test(normalized)) return { kind: 'section', key: 'tools' };
    if (/^(top soft skills|soft skills|soft-skills|qualities|qualites)$/.test(normalized)) return { kind: 'section', key: 'softSkills' };

    if (/^(key improvements|recommendations|suggestions|improvements)$/.test(normalized)) return { kind: 'suggestion-section', key: 'general' };
    if (/^(executive summary improvements|summary improvements|executive summary suggestions)$/.test(normalized)) return { kind: 'suggestion-section', key: 'executiveSummary' };
    if (/^(skills improvements|skills suggestions|skills recommendations)$/.test(normalized)) return { kind: 'suggestion-section', key: 'skills' };
    if (/^(experience improvements|experience suggestions|work experience suggestions)$/.test(normalized)) return { kind: 'suggestion-section', key: 'experiences' };
    if (/^(education improvements|education suggestions|formation suggestions)$/.test(normalized)) return { kind: 'suggestion-section', key: 'education' };
    if (/^(hobbies languages improvements|languages suggestions|hobbies suggestions)$/.test(normalized)) return { kind: 'suggestion-section', key: 'hobbiesLanguages' };
    if (/^(ats improvements|ats suggestions|ats recommendations)$/.test(normalized)) return { kind: 'suggestion-section', key: 'atsOptimization' };

    return null;
}

function assignLooseAnalysisValue(target, section, value) {
    const items = parseLooseListValue(value);
    if (section.kind === 'section') {
        if (items.length > 0) {
            target.tags[section.key].push(...items);
        }
        return;
    }

    if (section.kind === 'suggestion-section') {
        if (section.key === 'general') {
            target.suggestions.executiveSummary.push(...items);
        } else if (items.length > 0) {
            target.suggestions[section.key].push(...items);
        }
        return;
    }

    if (section.kind === 'field') {
        if (section.score) {
            const parsedScore = parseLooseScore(value);
            if (parsedScore) {
                target[section.key] = parsedScore;
            }
            return;
        }

        const normalizedValue = normalizeUtf8Text(String(value || '')).trim();
        if (normalizedValue) {
            target[section.key] = normalizedValue;
        }
    }
}

function dedupeLooseAnalysisPayload(payload) {
    const dedupe = (items) => [...new Set(items.map(item => item.trim()).filter(Boolean))];

    return {
        ...payload,
        tags: {
            skills: dedupe(payload.tags.skills),
            industries: dedupe(payload.tags.industries),
            tools: dedupe(payload.tags.tools),
            softSkills: dedupe(payload.tags.softSkills)
        },
        suggestions: {
            executiveSummary: dedupe(payload.suggestions.executiveSummary),
            skills: dedupe(payload.suggestions.skills),
            experiences: dedupe(payload.suggestions.experiences),
            education: dedupe(payload.suggestions.education),
            hobbiesLanguages: dedupe(payload.suggestions.hobbiesLanguages),
            atsOptimization: dedupe(payload.suggestions.atsOptimization)
        }
    };
}

export function salvageResumeAnalysisFromText(text) {
    const cleaned = normalizeUtf8Text(stripLlmThinkingContent(text || ''));
    if (!cleaned || !cleaned.trim()) {
        return null;
    }

    const payload = {
        tags: {
            skills: [],
            industries: [],
            tools: [],
            softSkills: []
        },
        suggestions: {
            executiveSummary: [],
            skills: [],
            experiences: [],
            education: [],
            hobbiesLanguages: [],
            atsOptimization: []
        }
    };

    let activeSection = null;
    for (const rawLine of cleaned.split(/\r?\n/)) {
        const line = sanitizeLooseAnalysisLine(rawLine);
        if (!line) {
            activeSection = null;
            continue;
        }

        const headingMatch = line.match(/^(.+?)\s*:\s*(.*)$/);
        if (headingMatch) {
            const [, rawKey, rawValue] = headingMatch;
            const mappedSection = mapLooseAnalysisSectionKey(rawKey);
            if (!mappedSection) {
                activeSection = null;
                continue;
            }

            activeSection = mappedSection;
            if (rawValue.trim()) {
                assignLooseAnalysisValue(payload, mappedSection, rawValue);
                if (mappedSection.kind !== 'field') {
                    activeSection = null;
                }
            }
            continue;
        }

        const standaloneSection = mapLooseAnalysisSectionKey(line);
        if (standaloneSection && standaloneSection.kind !== 'field') {
            activeSection = standaloneSection;
            continue;
        }

        if (activeSection) {
            assignLooseAnalysisValue(payload, activeSection, line);
        }
    }

    const deduped = dedupeLooseAnalysisPayload(payload);
    const hasContent = Boolean(
        deduped.name
        || deduped.title
        || deduped.Summary
        || Object.values(deduped.tags).some(items => items.length > 0)
        || Object.values(deduped.suggestions).some(items => items.length > 0)
        || [
            deduped.globalRating,
            deduped.executiveSummaryRating,
            deduped.skillsRating,
            deduped.experiencesRating,
            deduped.educationRating,
            deduped.hobbiesLanguagesRating,
            deduped.atsOptimizationRating
        ].some(Boolean)
    );

    return hasContent ? deduped : null;
}

export function cleanupText(text) {
    if (!text) return text;

    let cleaned = decodeHtmlEntities(normalizeUtf8Text(text));
    cleaned = cleaned.replace(/<br\s*\/?>/gi, '\n');
    cleaned = cleaned.replace(/<\/p>/gi, '\n');
    cleaned = cleaned.replace(/<\/li>/gi, '\n');
    cleaned = cleaned.replace(/<\/h[1-6]>/gi, '\n\n');
    cleaned = cleaned.replace(/<[^>]*>/g, '');
    cleaned = cleaned.replace(/[ \t]+/g, ' ');
    cleaned = cleaned.replace(/\n[ \t]+/g, '\n');
    cleaned = cleaned.replace(/[ \t]+\n/g, '\n');
    cleaned = cleaned.replace(/\n{3,}/g, '\n\n');

    return cleaned.trim();
}

export function cleanupHtml(html) {
    if (!html) return html;

    let cleaned = decodeHtmlEntities(normalizeUtf8Text(html));
    cleaned = cleaned.replace(/<li>\s*<p>(.*?)<\/p>\s*<\/li>/gi, '<li>$1</li>');
    cleaned = cleaned.replace(/<p>\s*(<ul[^>]*>)/gi, '$1');
    cleaned = cleaned.replace(/(<\/ul>)\s*<\/p>/gi, '$1');
    cleaned = cleaned.replace(/<p>\s*(<ol[^>]*>)/gi, '$1');
    cleaned = cleaned.replace(/(<\/ol>)\s*<\/p>/gi, '$1');
    cleaned = cleaned.replace(/<p>\s*(<h[1-6][^>]*>)/gi, '$1');
    cleaned = cleaned.replace(/(<\/h[1-6]>)\s*<\/p>/gi, '$1');
    cleaned = cleaned.replace(/<p>\s*<\/p>/gi, '');
    cleaned = cleaned.replace(/<p>\s*<p>/gi, '<p>');
    cleaned = cleaned.replace(/<\/p>\s*<\/p>/gi, '</p>');
    cleaned = cleaned.replace(/(<br\s*\/?>\s*){3,}/gi, '<br><br>');
    cleaned = cleaned.replace(/<p>\s*(<br\s*\/?>\s*)*<\/p>/gi, '');

    return cleaned;
}




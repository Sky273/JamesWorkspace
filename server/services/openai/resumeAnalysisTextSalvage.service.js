import { normalizeUtf8Text, stripLlmThinkingContent } from './textUtils.js';

function sanitizeLooseAnalysisLine(line) {
    return normalizeUtf8Text(String(line || ''))
        .replace(/^\s*[-*â€¢]\s+/, '')
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

    if (/^(top skills|skills keywords|skills|competences|comp[eÃ©]tences)$/.test(normalized)) return { kind: 'section', key: 'skills' };
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

function inferLooseAnalysisStructureKind(cleanedText) {
    const normalized = normalizeUtf8Text(String(cleanedText || ''));
    const hasBullets = /(^|\n)\s*[-*â€¢]\s+/m.test(normalized);
    const hasKeyValue = /(^|\n)\s*[^:\n]{2,60}\s*:\s*.+/m.test(normalized);
    const hasMarkdownHeadings = /(^|\n)\s*#{1,6}\s+\S+/m.test(normalized);

    if (hasKeyValue && hasBullets) return 'key_value_with_bullets';
    if (hasKeyValue) return 'key_value';
    if (hasMarkdownHeadings && hasBullets) return 'markdown_sections';
    if (hasBullets) return 'bullet_list';
    return 'plain_text';
}

function buildLooseAnalysisSalvageMetadata(payload, cleanedText) {
    const recoveredFields = [];
    const missingFields = [];

    const scalarFields = [
        ['name', payload.name],
        ['title', payload.title],
        ['summary', payload.Summary],
        ['globalRating', payload.globalRating],
        ['executiveSummaryRating', payload.executiveSummaryRating],
        ['skillsRating', payload.skillsRating],
        ['experiencesRating', payload.experiencesRating],
        ['educationRating', payload.educationRating],
        ['hobbiesLanguagesRating', payload.hobbiesLanguagesRating],
        ['atsOptimizationRating', payload.atsOptimizationRating]
    ];

    for (const [field, value] of scalarFields) {
        if (typeof value === 'string' && value.trim()) {
            recoveredFields.push(field);
        } else {
            missingFields.push(field);
        }
    }

    const collectionFields = [
        ['skills', payload.tags.skills],
        ['industries', payload.tags.industries],
        ['tools', payload.tags.tools],
        ['softSkills', payload.tags.softSkills],
        ['suggestions.executiveSummary', payload.suggestions.executiveSummary],
        ['suggestions.skills', payload.suggestions.skills],
        ['suggestions.experiences', payload.suggestions.experiences],
        ['suggestions.education', payload.suggestions.education],
        ['suggestions.hobbiesLanguages', payload.suggestions.hobbiesLanguages],
        ['suggestions.atsOptimization', payload.suggestions.atsOptimization]
    ];

    for (const [field, value] of collectionFields) {
        if (Array.isArray(value) && value.length > 0) {
            recoveredFields.push(field);
        } else {
            missingFields.push(field);
        }
    }

    return {
        detectedStructure: inferLooseAnalysisStructureKind(cleanedText),
        recoveredFields,
        missingFields,
        counts: {
            skills: payload.tags.skills.length,
            industries: payload.tags.industries.length,
            tools: payload.tags.tools.length,
            softSkills: payload.tags.softSkills.length,
            executiveSummarySuggestions: payload.suggestions.executiveSummary.length,
            skillsSuggestions: payload.suggestions.skills.length,
            experiencesSuggestions: payload.suggestions.experiences.length,
            educationSuggestions: payload.suggestions.education.length,
            hobbiesLanguagesSuggestions: payload.suggestions.hobbiesLanguages.length,
            atsOptimizationSuggestions: payload.suggestions.atsOptimization.length
        }
    };
}

export function salvageResumeAnalysisFromTextDetailed(text) {
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

    if (!hasContent) {
        return null;
    }

    return {
        payload: deduped,
        metadata: buildLooseAnalysisSalvageMetadata(deduped, cleaned)
    };
}

export function salvageResumeAnalysisFromText(text) {
    return salvageResumeAnalysisFromTextDetailed(text)?.payload || null;
}

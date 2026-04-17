function extractSuggestionText(value) {
    if (value === null || value === undefined) return [];

    if (typeof value === 'string') {
        const trimmed = value.trim();
        return trimmed ? [trimmed] : [];
    }

    if (typeof value === 'number' || typeof value === 'boolean') {
        return [String(value)];
    }

    if (Array.isArray(value)) {
        return value.flatMap(extractSuggestionText);
    }

    if (typeof value === 'object') {
        const directText = [
            value.text,
            value.suggestion,
            value.content,
            value.message,
            value.label,
            value.title,
            value.value,
            value.description
        ].find(candidate => typeof candidate === 'string' && candidate.trim());

        if (directText) {
            return [directText.trim()];
        }

        return Object.values(value)
            .filter(candidate => candidate !== null && candidate !== undefined)
            .flatMap(extractSuggestionText);
    }

    return [];
}

function asSuggestionArray(value) {
    return [...new Set(extractSuggestionText(value).filter(Boolean))];
}

function normalizeStringArray(value) {
    if (value === null || value === undefined) return [];

    if (typeof value === 'string') {
        const trimmed = value.trim();
        return trimmed ? trimmed.split(/[;,]/).map(item => item.trim()).filter(Boolean) : [];
    }

    if (Array.isArray(value)) {
        return [...new Set(value.flatMap(normalizeStringArray).filter(Boolean))];
    }

    if (typeof value === 'object') {
        const directValues = ['label', 'name', 'title', 'text', 'value', 'skill', 'tool']
            .map((key) => value[key])
            .filter((candidate) => typeof candidate === 'string' && candidate.trim())
            .map((candidate) => candidate.trim());

        if (directValues.length > 0) {
            return [...new Set(directValues)];
        }

        return [...new Set(Object.values(value).flatMap(normalizeStringArray).filter(Boolean))];
    }

    return [];
}

export function normalizeKeywordEvidenceArray(value) {
    if (!Array.isArray(value)) return [];

    return value
        .filter((item) => item && typeof item === 'object' && !Array.isArray(item))
        .map((item) => ({
            ...item,
            name: typeof item.name === 'string'
                ? item.name.trim()
                : typeof item.skill === 'string'
                    ? item.skill.trim()
                    : typeof item.tool === 'string'
                        ? item.tool.trim()
                        : ''
        }))
        .filter((item) => item.name);
}

export function pickFirstNonEmptyArray(...values) {
    for (const value of values) {
        const normalized = normalizeStringArray(value);
        if (normalized.length > 0) {
            return normalized;
        }
    }

    return [];
}

export function normalizeSuggestionsBySection(source) {
    const suggestionsSource = source?.suggestions || source?.['Key Improvements'] || source?.keyImprovements || source?.recommendations || source?.sectionSuggestions || source?.section_improvements || source || {};
    return {
        executiveSummary: asSuggestionArray(
            suggestionsSource.executiveSummary
            ?? suggestionsSource.executive_summary
            ?? suggestionsSource.executiveBrief
            ?? suggestionsSource.executive_summary_suggestions
            ?? suggestionsSource.summary
            ?? suggestionsSource.resumeSummary
        ),
        skills: asSuggestionArray(
            suggestionsSource.skills
            ?? suggestionsSource.skillsKeywords
            ?? suggestionsSource.competencies
            ?? suggestionsSource.keywords
            ?? suggestionsSource.skillSuggestions
            ?? suggestionsSource.skills_and_keywords
        ),
        experiences: asSuggestionArray(
            suggestionsSource.experiences
            ?? suggestionsSource.experience
            ?? suggestionsSource.professionalExperience
            ?? suggestionsSource.workExperience
            ?? suggestionsSource.projects
            ?? suggestionsSource.missions
        ),
        education: asSuggestionArray(
            suggestionsSource.education
            ?? suggestionsSource.formation
            ?? suggestionsSource.training
        ),
        hobbiesLanguages: asSuggestionArray(
            suggestionsSource.hobbiesLanguages
            ?? suggestionsSource.hobbies
            ?? suggestionsSource.languages
            ?? suggestionsSource.languagesAndHobbies
            ?? suggestionsSource.languages_hobbies
            ?? suggestionsSource.interests
        ),
        atsOptimization: asSuggestionArray(
            suggestionsSource.atsOptimization
            ?? suggestionsSource.ats
            ?? suggestionsSource.atsCompatibility
            ?? suggestionsSource.atsSuggestions
            ?? suggestionsSource.formatting
        )
    };
}

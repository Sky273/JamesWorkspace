function toTrimmedString(value, fallback = '') {
    if (value === null || value === undefined) {
        return fallback;
    }

    const normalized = String(value).trim();
    return normalized || fallback;
}

function toStrictString(value, fallback = '') {
    if (typeof value !== 'string') {
        return fallback;
    }

    const normalized = value.trim();
    return normalized || fallback;
}

function toScoreString(value, fallback = '0%') {
    if (value === null || value === undefined || value === '') {
        return fallback;
    }

    if (typeof value === 'number' && Number.isFinite(value)) {
        return `${Math.round(value)}%`;
    }

    const normalized = String(value).trim();
    if (!normalized) {
        return fallback;
    }

    if (/^\d+%$/.test(normalized)) {
        return normalized;
    }

    const parsed = parseInt(normalized.replace('%', ''), 10);
    return Number.isNaN(parsed) ? fallback : `${parsed}%`;
}

function extractStrings(value) {
    if (value === null || value === undefined) {
        return [];
    }

    if (typeof value === 'string') {
        return value
            .split(/\r?\n|[;,]/)
            .map(item => item.trim())
            .filter(Boolean);
    }

    if (Array.isArray(value)) {
        return value.flatMap(extractStrings);
    }

    if (typeof value === 'object') {
        const directValues = ['label', 'name', 'title', 'text', 'value', 'keyword', 'item']
            .map(key => value[key])
            .filter(candidate => candidate !== undefined && candidate !== null);
        if (directValues.length > 0) {
            return directValues.flatMap(extractStrings);
        }

        return Object.values(value).flatMap(extractStrings);
    }

    return [String(value)];
}

function toStringArray(value) {
    return [...new Set(extractStrings(value).filter(Boolean))];
}

function toSuggestionMap(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
        return {};
    }

    return Object.fromEntries(
        Object.entries(value).map(([key, entry]) => [key, toStringArray(entry)])
    );
}

export function validateResumeAnalysisPayload(payload = {}) {
    const tags = payload.tags && typeof payload.tags === 'object' && !Array.isArray(payload.tags)
        ? payload.tags
        : {};

    return {
        ...payload,
        name: toTrimmedString(payload.name ?? payload.Name, 'Candidat'),
        title: toTrimmedString(payload.title ?? payload.Title ?? payload['Professional Title']),
        globalRating: toScoreString(payload.globalRating ?? payload['Global Rating']),
        executiveSummaryRating: toScoreString(payload.executiveSummaryRating ?? payload['Executive Summary']),
        skillsRating: toScoreString(payload.skillsRating ?? payload['Skills']),
        experiencesRating: toScoreString(payload.experiencesRating ?? payload['Experience']),
        educationRating: toScoreString(payload.educationRating ?? payload['Education']),
        hobbiesLanguagesRating: toScoreString(
            payload.hobbiesLanguagesRating
            ?? payload['Hobbies Languages']
            ?? payload.hobbiesLanguages
            ?? payload['Hobbies & Languages']
            ?? payload['Languages & Hobbies']
        ),
        atsOptimizationRating: toScoreString(payload.atsOptimizationRating ?? payload['ATS Compatibility'] ?? payload['ATS']),
        tags: {
            ...tags,
            skills: toStringArray(tags.skills ?? payload['Top Skills'] ?? payload.skills),
            industries: toStringArray(tags.industries ?? payload['Top Industries'] ?? payload.industries),
            tools: toStringArray(tags.tools ?? payload['Top Tools'] ?? payload.tools),
            softSkills: toStringArray(tags.softSkills ?? tags.soft_skills ?? payload['Top Soft Skills'] ?? payload.softSkills ?? payload.soft_skills)
        },
        suggestions: toSuggestionMap(
            payload.suggestions
            ?? payload['Key Improvements']
            ?? payload.keyImprovements
            ?? payload.recommendations
            ?? payload.sectionSuggestions
            ?? payload.section_improvements
            ?? {}
        )
    };
}

export function validateResumeImprovementEnvelope(payload = {}) {
    const summary = payload.summary && typeof payload.summary === 'object' && !Array.isArray(payload.summary)
        ? payload.summary
        : {};
    const improvements = payload.improvements && typeof payload.improvements === 'object' && !Array.isArray(payload.improvements)
        ? payload.improvements
        : {};
    const tags = payload.tags && typeof payload.tags === 'object' && !Array.isArray(payload.tags)
        ? payload.tags
        : {};

    return {
        ...payload,
        improvedText: toTrimmedString(payload.improvedText ?? payload.text ?? payload.content),
        summary: {
            ...summary,
            title: toTrimmedString(summary.title),
            targetRole: toTrimmedString(summary.targetRole),
            skills: toStringArray(summary.skills),
            industries: toStringArray(summary.industries),
            tools: toStringArray(summary.tools),
            softSkills: toStringArray(summary.softSkills)
        },
        improvements,
        tags: {
            ...tags,
            skills: toStringArray(tags.skills ?? payload.skills),
            industries: toStringArray(tags.industries ?? payload.industries),
            tools: toStringArray(tags.tools ?? payload.tools),
            softSkills: toStringArray(tags.softSkills ?? tags.soft_skills ?? payload.softSkills ?? payload.soft_skills)
        },
        certifications: toStringArray(payload.certifications),
        languages: toStringArray(payload.languages)
    };
}

export function validateMatchAnalysisPayload(payload = {}) {
    const normalized = {
        ...payload,
        strengths: Array.isArray(payload.strengths) ? payload.strengths : toStringArray(payload.strengths),
        gaps: Array.isArray(payload.gaps) ? payload.gaps : toStringArray(payload.gaps),
        keywordMatches: toStringArray(payload.keywordMatches),
        missingKeywords: toStringArray(payload.missingKeywords)
    };

    if (normalized.keywordAnalysis && typeof normalized.keywordAnalysis === 'object') {
        normalized.keywordAnalysis = {
            ...normalized.keywordAnalysis,
            matchedKeywords: toStringArray(normalized.keywordAnalysis.matchedKeywords),
            partialKeywords: toStringArray(normalized.keywordAnalysis.partialKeywords),
            missingKeywords: toStringArray(normalized.keywordAnalysis.missingKeywords)
        };
    }

    return normalized;
}

export function validateAdaptationPayload(payload = {}) {
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
        return {};
    }

    return {
        ...payload,
        improvedText: toTrimmedString(payload.improvedText),
        adaptedText: toTrimmedString(payload.adaptedText),
        adaptedTitle: toStrictString(payload.adaptedTitle, null),
        targetedTitle: toStrictString(payload.targetedTitle, null),
        professionalSummary: toTrimmedString(payload.professionalSummary),
        keySkills: toStringArray(payload.keySkills),
        toolsAndTechnologies: toStringArray(payload.toolsAndTechnologies),
        certifications: toStringArray(payload.certifications),
        languages: toStringArray(payload.languages),
        education: Array.isArray(payload.education) ? payload.education : toStringArray(payload.education),
        professionalExperience: Array.isArray(payload.professionalExperience) ? payload.professionalExperience : [],
        summary: payload.summary && typeof payload.summary === 'object' && !Array.isArray(payload.summary)
            ? {
                ...payload.summary,
                title: toStrictString(payload.summary.title),
                targetRole: toStrictString(payload.summary.targetRole)
            }
            : {}
    };
}

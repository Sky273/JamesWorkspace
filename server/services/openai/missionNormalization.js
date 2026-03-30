import { safeLog } from '../../utils/logger.backend.js';

function normalizeStringArray(value, { prefix = '' } = {}) {
    if (value === null || value === undefined) return [];

    if (typeof value === 'string') {
        const trimmed = value.trim();
        if (!trimmed) return [];
        return trimmed
            .split(/[;,]/)
            .map((item) => `${prefix}${item.trim()}`.trim())
            .filter(Boolean);
    }

    if (typeof value === 'number' || typeof value === 'boolean') {
        return [`${prefix}${String(value)}`];
    }

    if (Array.isArray(value)) {
        return [...new Set(value.flatMap((item) => normalizeStringArray(item, { prefix })).filter(Boolean))];
    }

    if (typeof value === 'object') {
        const directValues = ['item', 'keyword', 'label', 'name', 'title', 'text', 'value']
            .map((key) => value[key])
            .filter((candidate) => typeof candidate === 'string' && candidate.trim())
            .map((candidate) => `${prefix}${candidate.trim()}`);

        if (directValues.length > 0) {
            return [...new Set(directValues)];
        }

        return [...new Set(Object.values(value).flatMap((item) => normalizeStringArray(item, { prefix })).filter(Boolean))];
    }

    return [];
}

function asDetailedStrength(value) {
    if (!value || typeof value !== 'object' || !value.item) return null;
    return {
        item: String(value.item).trim(),
        evidence: typeof value.evidence === 'string' ? value.evidence.trim() : '',
        coverage: typeof value.coverage === 'string' ? value.coverage.trim() : ''
    };
}

function asDetailedGap(value) {
    if (!value || typeof value !== 'object' || !value.item) return null;
    return {
        item: String(value.item).trim(),
        reason: typeof value.reason === 'string' ? value.reason.trim() : '',
        severity: typeof value.severity === 'string' ? value.severity.trim() : ''
    };
}

export function normalizeMatchAnalysis(analysis) {
    const normalized = { ...analysis };

    if (typeof normalized.matchScore === 'string') {
        normalized.matchScore = parseInt(normalized.matchScore.replace('%', ''), 10) || 0;
    }

    if (Array.isArray(normalized.strengths) && normalized.strengths.length > 0) {
        if (typeof normalized.strengths[0] === 'object' && normalized.strengths[0].item) {
            normalized._strengthsDetailed = normalized.strengths
                .map(asDetailedStrength)
                .filter(Boolean);
            normalized.strengths = normalized._strengthsDetailed.map((strength) => {
                const coverage = strength.coverage === 'explicit' ? '✓' : strength.coverage === 'partial' ? '~' : '';
                return `${coverage} ${strength.item}${strength.evidence ? ` (${strength.evidence})` : ''}`.trim();
            });
        }
    } else {
        normalized.strengths = normalizeStringArray(normalized.strengths);
    }

    if (Array.isArray(normalized.gaps) && normalized.gaps.length > 0) {
        if (typeof normalized.gaps[0] === 'object' && normalized.gaps[0].item) {
            normalized._gapsDetailed = normalized.gaps
                .map(asDetailedGap)
                .filter(Boolean);
            normalized.gaps = normalized._gapsDetailed.map((gap) => {
                const severity = gap.severity === 'high' ? '⚠️' : gap.severity === 'medium' ? '⚡' : '';
                return `${severity} ${gap.item}${gap.reason ? ` - ${gap.reason}` : ''}`.trim();
            });
        }
    } else {
        normalized.gaps = normalizeStringArray(normalized.gaps);
    }

    if (normalized.keywordAnalysis) {
        normalized._keywordAnalysisDetailed = normalized.keywordAnalysis;
        normalized.keywordMatches = [
            ...normalizeStringArray(normalized.keywordAnalysis.matchedKeywords),
            ...normalizeStringArray(normalized.keywordAnalysis.partialKeywords, { prefix: '~' })
        ];
        normalized.missingKeywords = normalizeStringArray(normalized.keywordAnalysis.missingKeywords);
    }

    if (normalized.recommendations && typeof normalized.recommendations === 'object') {
        normalized._recommendationsDetailed = normalized.recommendations;
    }

    safeLog('debug', 'Normalized match analysis', {
        hasScoreBreakdown: !!normalized.scoreBreakdown,
        hasSummary: !!normalized.summary,
        strengthsCount: normalized.strengths?.length || 0,
        gapsCount: normalized.gaps?.length || 0,
        keywordMatchesCount: normalized.keywordMatches?.length || 0,
        missingKeywordsCount: normalized.missingKeywords?.length || 0
    });

    return normalized;
}

export function convertAdaptationToHtml(data) {
    const sections = [];

    if (data.professionalSummary) {
        sections.push(`<h2>Résumé professionnel</h2>\n<p>${data.professionalSummary}</p>`);
    }

    if (data.keySkills && data.keySkills.length > 0) {
        sections.push(`<h2>Compétences clés</h2>\n<ul>\n${data.keySkills.map((skill) => `  <li>${skill}</li>`).join('\n')}\n</ul>`);
    }

    if (data.toolsAndTechnologies && data.toolsAndTechnologies.length > 0) {
        sections.push(`<h2>Outils et technologies</h2>\n<p>${data.toolsAndTechnologies.join(', ')}</p>`);
    }

    if (data.professionalExperience && data.professionalExperience.length > 0) {
        const experienceHtml = data.professionalExperience.map((experience) => {
            const header = `<h3>${experience.jobTitle || ''}${experience.company ? ` - ${experience.company}` : ''}${experience.dates ? ` (${experience.dates})` : ''}</h3>`;
            const context = experience.context ? `<p><em>${experience.context}</em></p>` : '';
            const missions = experience.missions && experience.missions.length > 0
                ? `<ul>\n${experience.missions.map((mission) => `  <li>${mission}</li>`).join('\n')}\n</ul>`
                : '';
            const technologies = experience.technologies && experience.technologies.length > 0
                ? `<p><strong>Technologies:</strong> ${experience.technologies.join(', ')}</p>`
                : '';
            return `${header}\n${context}${missions}${technologies}`;
        }).join('\n\n');
        sections.push(`<h2>Expérience professionnelle</h2>\n${experienceHtml}`);
    }

    if (data.education && data.education.length > 0) {
        const educationItems = Array.isArray(data.education)
            ? data.education.map((entry) => typeof entry === 'string' ? entry : `${entry.degree || ''} - ${entry.institution || ''} ${entry.year || ''}`.trim()).join('</li>\n  <li>')
            : data.education;
        sections.push(`<h2>Formation</h2>\n<ul>\n  <li>${educationItems}</li>\n</ul>`);
    }

    if (data.certifications && data.certifications.length > 0) {
        sections.push(`<h2>Certifications</h2>\n<ul>\n${data.certifications.map((certification) => `  <li>${certification}</li>`).join('\n')}\n</ul>`);
    }

    if (data.languages && data.languages.length > 0) {
        sections.push(`<h2>Langues</h2>\n<ul>\n${data.languages.map((language) => `  <li>${language}</li>`).join('\n')}\n</ul>`);
    }

    return sections.join('\n\n');
}

export function buildAdaptationResult(parsed, content) {
    if (parsed.improvedText) {
        const adaptedTitle = parsed.summary?.title || parsed.summary?.targetRole || null;
        return {
            adaptedText: parsed.improvedText,
            adaptedTitle,
            structuredData: parsed,
            tracking: {
                structuredRuns: 1,
                outputChars: parsed.improvedText.length,
                metadata: { source: 'structured-json' }
            }
        };
    }

    if (parsed.targetedTitle !== undefined) {
        const adaptedText = convertAdaptationToHtml(parsed);
        return {
            adaptedText,
            adaptedTitle: parsed.targetedTitle || null,
            structuredData: parsed,
            tracking: {
                structuredRuns: 1,
                outputChars: adaptedText.length,
                metadata: { source: 'legacy-structured-json' }
            }
        };
    }

    if (parsed.adaptedText && parsed.adaptedTitle) {
        return {
            adaptedText: parsed.adaptedText,
            adaptedTitle: parsed.adaptedTitle,
            tracking: {
                structuredRuns: 1,
                outputChars: parsed.adaptedText.length,
                metadata: { source: 'legacy-json' }
            }
        };
    }

    safeLog('warn', 'adaptResumeToMission: Unknown JSON format, returning raw content');
    return {
        adaptedText: content,
        adaptedTitle: null,
        structuredData: parsed,
        tracking: {
            fallbackRuns: 1,
            outputChars: content.length,
            metadata: { source: 'unknown-json-format' }
        }
    };
}

import crypto from 'crypto';
import { getPromptContract, getPromptDefinition } from '../config/llmGovernance.js';

export const PROMPT_VERSION_FIELD_MAP = Object.freeze({
    'Analysis Prompt': Object.freeze({
        promptKey: 'DEFAULT_ANALYSIS_PROMPT',
        column: 'analysis_prompt'
    }),
    'Improvement Prompt': Object.freeze({
        promptKey: 'DEFAULT_IMPROVEMENT_PROMPT',
        column: 'improvement_prompt'
    }),
    'Match Analysis Prompt': Object.freeze({
        promptKey: 'DEFAULT_MATCH_ANALYSIS_PROMPT',
        column: 'match_analysis_prompt'
    }),
    'Adaptation Prompt': Object.freeze({
        promptKey: 'DEFAULT_ADAPTATION_PROMPT',
        column: 'adaptation_prompt'
    })
});

function normalizePromptText(value) {
    return String(value || '')
        .replace(/\r\n/g, '\n')
        .trim();
}

function computeTextHash(value) {
    return crypto.createHash('sha256').update(normalizePromptText(value)).digest('hex');
}

function getPromptDefaults(settingKey) {
    const promptKey = PROMPT_VERSION_FIELD_MAP[settingKey]?.promptKey;
    const prompt = getPromptDefinition(promptKey);
    const contract = getPromptContract(promptKey);

    return {
        settingKey,
        promptKey,
        promptId: prompt?.id || null,
        promptVersion: prompt?.version || null,
        promptDomain: prompt?.domain || null,
        promptOperation: prompt?.operation || null,
        contractId: contract?.id || null,
        contractVersion: contract?.version || null,
        sourceModule: prompt?.sourceModule || null,
        defaultText: prompt?.text || ''
    };
}

function createRevisionEntry({
    settingKey,
    revision,
    source,
    text,
    changedAt,
    changedBy = null,
    reason
}) {
    const defaults = getPromptDefaults(settingKey);

    return {
        revision,
        source,
        reason,
        text,
        textHash: computeTextHash(text),
        changedAt: changedAt || null,
        changedByUserId: changedBy?.id || null,
        changedByEmail: changedBy?.email || null,
        promptId: defaults.promptId,
        promptVersion: defaults.promptVersion,
        contractId: defaults.contractId,
        contractVersion: defaults.contractVersion
    };
}

function resolveRevisionReason(existingEntry, nextSource, nextText) {
    const nextHash = computeTextHash(nextText);
    const hasMatchingHistoricalRevision = (existingEntry.history || []).some((entry) => entry?.textHash === nextHash);

    if (nextSource === 'default') {
        return 'reverted_to_default';
    }

    if (hasMatchingHistoricalRevision) {
        return 'restored_revision';
    }

    return 'updated_custom';
}

function getStoredEntry(state = {}, settingKey) {
    const entry = state?.[settingKey];
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
        return null;
    }
    return entry;
}

function sanitizeResolvedEntry(settingKey, entry, activeText) {
    const defaults = getPromptDefaults(settingKey);
    const history = Array.isArray(entry.history) ? entry.history.filter((item) => item && typeof item === 'object') : [];
    const currentRevision = history.length > 0
        ? Math.max(...history.map((item) => Number(item.revision) || 0))
        : Number(entry.currentRevision) || 1;
    const activeTextHash = computeTextHash(activeText);
    const lastChangedAt = history.length > 0 ? history[history.length - 1].changedAt || null : null;
    const isModified = normalizePromptText(activeText) !== normalizePromptText(defaults.defaultText);

    return {
        currentRevision: Math.max(currentRevision, 1),
        activeSource: isModified ? 'custom' : 'default',
        activeTextHash,
        isModified,
        lastChangedAt,
        history
    };
}

function getCurrentPromptText(promptTexts = {}, settingKey) {
    if (Object.prototype.hasOwnProperty.call(promptTexts, settingKey)) {
        return promptTexts[settingKey] || '';
    }

    return getPromptDefaults(settingKey).defaultText;
}

function bootstrapPromptEntry(settingKey, storedEntry, promptTexts = {}, fallbackTimestamp = null) {
    const defaults = getPromptDefaults(settingKey);
    const effectiveText = getCurrentPromptText(promptTexts, settingKey);
    const normalizedEffectiveText = normalizePromptText(effectiveText);
    const normalizedDefaultText = normalizePromptText(defaults.defaultText);

    if (storedEntry) {
        return sanitizeResolvedEntry(settingKey, storedEntry, effectiveText);
    }

    const initialHistory = [
        createRevisionEntry({
            settingKey,
            revision: 1,
            source: 'default',
            text: defaults.defaultText,
            changedAt: fallbackTimestamp,
            changedBy: null,
            reason: 'initial_default'
        })
    ];

    if (normalizedEffectiveText !== normalizedDefaultText) {
        initialHistory.push(createRevisionEntry({
            settingKey,
            revision: 2,
            source: 'custom',
            text: effectiveText,
            changedAt: fallbackTimestamp,
            changedBy: null,
            reason: 'migrated_custom'
        }));
    }

    return sanitizeResolvedEntry(settingKey, { history: initialHistory }, effectiveText);
}

export function resolvePromptVersionState({ storedState = {}, promptTexts = {}, fallbackTimestamp = null } = {}) {
    return Object.fromEntries(
        Object.keys(PROMPT_VERSION_FIELD_MAP).map((settingKey) => [
            settingKey,
            bootstrapPromptEntry(settingKey, getStoredEntry(storedState, settingKey), promptTexts, fallbackTimestamp)
        ])
    );
}

export function computeUpdatedPromptVersionState({
    storedState = {},
    previousPromptTexts = {},
    nextPromptTexts = {},
    changedAt = null,
    changedBy = null
} = {}) {
    const resolvedState = resolvePromptVersionState({
        storedState,
        promptTexts: previousPromptTexts,
        fallbackTimestamp: changedAt
    });

    const nextState = {};

    for (const settingKey of Object.keys(PROMPT_VERSION_FIELD_MAP)) {
        const defaults = getPromptDefaults(settingKey);
        const previousText = getCurrentPromptText(previousPromptTexts, settingKey);
        const nextText = getCurrentPromptText(nextPromptTexts, settingKey);
        const previousNormalized = normalizePromptText(previousText);
        const nextNormalized = normalizePromptText(nextText);
        const defaultNormalized = normalizePromptText(defaults.defaultText);
        const existingEntry = resolvedState[settingKey];

        if (previousNormalized === nextNormalized) {
            nextState[settingKey] = sanitizeResolvedEntry(settingKey, existingEntry, nextText);
            continue;
        }

        const nextRevision = (existingEntry.currentRevision || 1) + 1;
        const nextSource = nextNormalized === defaultNormalized ? 'default' : 'custom';
        const nextReason = resolveRevisionReason(existingEntry, nextSource, nextText);
        const nextHistory = [
            ...(existingEntry.history || []),
            createRevisionEntry({
                settingKey,
                revision: nextRevision,
                source: nextSource,
                text: nextText,
                changedAt,
                changedBy,
                reason: nextReason
            })
        ];

        nextState[settingKey] = sanitizeResolvedEntry(settingKey, {
            ...existingEntry,
            currentRevision: nextRevision,
            history: nextHistory
        }, nextText);
    }

    return nextState;
}

export function extractPromptTextsFromSettingsRecord(record = {}) {
    return Object.fromEntries(
        Object.entries(PROMPT_VERSION_FIELD_MAP).map(([settingKey, config]) => [
            settingKey,
            record?.[config.column] ?? getPromptDefaults(settingKey).defaultText
        ])
    );
}

export function extractPromptTextsFromFrontendSettings(settings = {}) {
    return Object.fromEntries(
        Object.keys(PROMPT_VERSION_FIELD_MAP).map((settingKey) => [
            settingKey,
            settings?.[settingKey] ?? getPromptDefaults(settingKey).defaultText
        ])
    );
}

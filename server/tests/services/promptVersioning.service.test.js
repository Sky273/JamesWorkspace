import { describe, expect, it } from 'vitest';
import {
    computeUpdatedPromptVersionState,
    extractPromptTextsFromSettingsRecord,
    resolvePromptVersionState
} from '../../services/promptVersioning.service.js';

describe('promptVersioning.service', () => {
    it('bootstraps default revision state for each governed prompt', () => {
        const state = resolvePromptVersionState();

        expect(state['Pre Analysis Prompt']).toEqual(expect.objectContaining({
            currentRevision: 1,
            isModified: false,
            activeSource: 'default'
        }));
        expect(state['Pre Analysis Prompt'].history).toHaveLength(1);
        expect(state['Analysis Prompt']).toEqual(expect.objectContaining({
            currentRevision: 1,
            isModified: false,
            activeSource: 'default'
        }));
        expect(state['Analysis Prompt'].history).toHaveLength(1);
    });

    it('does not increment revision when a prompt text is saved unchanged', () => {
        const previousTexts = {
            'Analysis Prompt': 'Custom analysis prompt'
        };
        const storedState = resolvePromptVersionState({
            promptTexts: previousTexts,
            fallbackTimestamp: '2026-04-01T10:00:00.000Z'
        });

        const nextState = computeUpdatedPromptVersionState({
            storedState,
            previousPromptTexts: previousTexts,
            nextPromptTexts: previousTexts,
            changedAt: '2026-04-01T11:00:00.000Z',
            changedBy: { id: 'user-1', email: 'admin@example.com' }
        });

        expect(nextState['Analysis Prompt'].currentRevision).toBe(2);
        expect(nextState['Analysis Prompt'].history).toHaveLength(2);
        expect(nextState['Analysis Prompt'].lastChangedAt).toBe('2026-04-01T10:00:00.000Z');
    });

    it('increments revision only for the prompt that actually changed', () => {
        const previousTexts = {
            'Pre Analysis Prompt': 'Custom pre-analysis prompt',
            'Analysis Prompt': 'Custom analysis prompt',
            'Improvement Prompt': 'Custom improvement prompt'
        };
        const storedState = resolvePromptVersionState({
            promptTexts: previousTexts,
            fallbackTimestamp: '2026-04-01T10:00:00.000Z'
        });

        const nextState = computeUpdatedPromptVersionState({
            storedState,
            previousPromptTexts: previousTexts,
            nextPromptTexts: {
                ...previousTexts,
                'Pre Analysis Prompt': 'Updated pre-analysis prompt',
                'Improvement Prompt': 'Updated improvement prompt'
            },
            changedAt: '2026-04-01T11:00:00.000Z',
            changedBy: { id: 'user-1', email: 'admin@example.com' }
        });

        expect(nextState['Pre Analysis Prompt'].currentRevision).toBe(3);
        expect(nextState['Pre Analysis Prompt'].history.at(-1)).toEqual(expect.objectContaining({
            reason: 'updated_custom',
            changedByEmail: 'admin@example.com'
        }));
        expect(nextState['Analysis Prompt'].currentRevision).toBe(2);
        expect(nextState['Improvement Prompt'].currentRevision).toBe(3);
        expect(nextState['Improvement Prompt'].history.at(-1)).toEqual(expect.objectContaining({
            reason: 'updated_custom',
            changedByEmail: 'admin@example.com'
        }));
    });

    it('tracks revert and restore flows for pre-analysis prompt like other governed prompts', () => {
        const customState = computeUpdatedPromptVersionState({
            storedState: {},
            previousPromptTexts: {},
            nextPromptTexts: {
                'Pre Analysis Prompt': 'Custom pre-analysis prompt'
            },
            changedAt: '2026-03-31T10:00:00.000Z',
            changedBy: { id: 'user-1', email: 'admin@example.com' }
        });

        const revertedState = computeUpdatedPromptVersionState({
            storedState: customState,
            previousPromptTexts: {
                'Pre Analysis Prompt': 'Custom pre-analysis prompt'
            },
            nextPromptTexts: extractPromptTextsFromSettingsRecord({}),
            changedAt: '2026-03-31T11:00:00.000Z',
            changedBy: { id: 'user-1', email: 'admin@example.com' }
        });

        expect(revertedState['Pre Analysis Prompt']).toEqual(expect.objectContaining({
            currentRevision: 3,
            isModified: false,
            activeSource: 'default'
        }));
        expect(revertedState['Pre Analysis Prompt'].history.at(-1)).toEqual(expect.objectContaining({
            reason: 'reverted_to_default',
            source: 'default'
        }));

        const restoredState = computeUpdatedPromptVersionState({
            storedState: revertedState,
            previousPromptTexts: extractPromptTextsFromSettingsRecord({}),
            nextPromptTexts: {
                'Pre Analysis Prompt': 'Custom pre-analysis prompt'
            },
            changedAt: '2026-03-31T12:00:00.000Z',
            changedBy: { id: 'user-1', email: 'admin@example.com' }
        });

        expect(restoredState['Pre Analysis Prompt'].history.at(-1)).toEqual(expect.objectContaining({
            reason: 'restored_revision',
            text: 'Custom pre-analysis prompt'
        }));
    });

    it('tracks a revert to default without keeping the prompt marked as modified', () => {
        const previousTexts = {
            'Analysis Prompt': 'Custom analysis prompt'
        };
        const storedState = resolvePromptVersionState({
            promptTexts: previousTexts,
            fallbackTimestamp: '2026-04-01T10:00:00.000Z'
        });
        const defaultTexts = extractPromptTextsFromSettingsRecord({});

        const nextState = computeUpdatedPromptVersionState({
            storedState,
            previousPromptTexts: previousTexts,
            nextPromptTexts: {
                'Analysis Prompt': defaultTexts['Analysis Prompt']
            },
            changedAt: '2026-04-01T11:00:00.000Z',
            changedBy: { id: 'user-1', email: 'admin@example.com' }
        });

        expect(nextState['Analysis Prompt']).toEqual(expect.objectContaining({
            currentRevision: 3,
            isModified: false,
            activeSource: 'default',
            lastChangedAt: '2026-04-01T11:00:00.000Z'
        }));
        expect(nextState['Analysis Prompt'].history.at(-1)).toEqual(expect.objectContaining({
            reason: 'reverted_to_default',
            source: 'default'
        }));
    });

    it('marks a restored custom revision explicitly', () => {
        const revisionTwoState = computeUpdatedPromptVersionState({
            storedState: {},
            previousPromptTexts: {},
            nextPromptTexts: {
                'Improvement Prompt': 'Version two'
            },
            changedAt: '2026-03-31T10:00:00.000Z',
            changedBy: { id: 'user-1', email: 'admin@example.com' }
        });
        const storedState = computeUpdatedPromptVersionState({
            storedState: revisionTwoState,
            previousPromptTexts: {
                'Improvement Prompt': 'Version two'
            },
            nextPromptTexts: {
                'Improvement Prompt': 'Version three'
            },
            changedAt: '2026-04-01T10:00:00.000Z',
            changedBy: { id: 'user-1', email: 'admin@example.com' }
        });

        const nextState = computeUpdatedPromptVersionState({
            storedState,
            previousPromptTexts: {
                'Improvement Prompt': 'Version three'
            },
            nextPromptTexts: {
                'Improvement Prompt': 'Version two'
            },
            changedAt: '2026-04-01T11:00:00.000Z',
            changedBy: { id: 'user-1', email: 'admin@example.com' }
        });

        expect(nextState['Improvement Prompt'].history.at(-1)).toEqual(expect.objectContaining({
            reason: 'restored_revision',
            text: 'Version two'
        }));
    });
});

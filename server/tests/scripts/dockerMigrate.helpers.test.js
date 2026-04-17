import { describe, it, expect } from 'vitest';
import { extractAllowedLlmProvidersFromConstraint, hasExactSupportedProviders, sanitizeSqlForPgExecution } from '../../scripts/dockerMigrate.helpers.js';

describe('dockerMigrate.helpers', () => {
    it('extracts providers from the llm provider constraint definition', () => {
        const definition = "CHECK ((llm_provider)::text = ANY (ARRAY['openai'::text,'anthropic'::text,'huggingface'::text,'gemma'::text,'deepseek'::text,'glm'::text,'minimax'::text,'ollama'::text]))";

        expect(extractAllowedLlmProvidersFromConstraint(definition)).toEqual([
            'anthropic',
            'deepseek',
            'gemma',
            'glm',
            'huggingface',
            'minimax',
            'ollama',
            'openai'
        ]);
    });

    it('accepts only the exact supported provider set', () => {
        const definition = "CHECK ((llm_provider)::text = ANY (ARRAY['openai'::text,'anthropic'::text,'huggingface'::text,'gemma'::text,'deepseek'::text,'glm'::text,'minimax'::text,'ollama'::text]))";

        expect(hasExactSupportedProviders(definition, [
            'openai',
            'anthropic',
            'huggingface',
            'gemma',
            'deepseek',
            'glm',
            'minimax',
            'ollama'
        ])).toBe(true);
    });

    it('rejects outdated constraints that miss a supported provider', () => {
        const definition = "CHECK ((llm_provider)::text = ANY (ARRAY['openai'::text,'anthropic'::text,'huggingface'::text,'deepseek'::text,'glm'::text,'minimax'::text,'ollama'::text]))";

        expect(hasExactSupportedProviders(definition, [
            'openai',
            'anthropic',
            'huggingface',
            'gemma',
            'deepseek',
            'glm',
            'minimax',
            'ollama'
        ])).toBe(false);
    });

    it('removes psql meta-commands before execution through pg', () => {
        const sql = [
            '\\restrict some_token',
            'SET client_encoding = \'UTF8\';',
            'CREATE TABLE example (id integer);',
            '\\unrestrict some_token'
        ].join('\n');

        expect(sanitizeSqlForPgExecution(sql)).toBe([
            'SET client_encoding = \'UTF8\';',
            'CREATE TABLE example (id integer);'
        ].join('\n'));
    });
});

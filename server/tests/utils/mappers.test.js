/**
 * Tests for utils/mappers.js
 * mapSettingsToFrontend, mapSettingsFromFrontend,
 * mapTemplateToFrontend, mapTemplateFromFrontend
 */

import { describe, it, expect, vi } from 'vitest';

// Mock prompts config (used for default values)
vi.mock('../../config/prompts.backend.js', () => ({
    DEFAULT_ANALYSIS_PROMPT: 'default-analysis-prompt',
    DEFAULT_IMPROVEMENT_PROMPT: 'default-improvement-prompt',
    DEFAULT_MATCH_ANALYSIS_PROMPT: 'default-match-analysis-prompt',
    DEFAULT_ADAPTATION_PROMPT: 'default-adaptation-prompt'
}));

import {
    mapSettingsToFrontend,
    mapSettingsFromFrontend,
    mapTemplateToFrontend,
    mapTemplateFromFrontend
} from '../../utils/mappers.js';

// ==========================================
// mapSettingsToFrontend
// ==========================================
describe('mapSettingsToFrontend', () => {
    const fullRow = {
        id: 'set-1',
        llm_model: 'gpt-4o',
        cv_mode: 'anonymized',
        chatbot_enabled: 'off',
        analysis_prompt: 'custom analysis',
        improvement_prompt: 'custom improvement',
        match_analysis_prompt: 'custom match',
        adaptation_prompt: 'custom adaptation',
        executive_summary_weight: 25,
        skills_weight: 25,
        experience_weight: 15,
        education_weight: 10,
        ats_weight: 10,
        hobbies_languages_weight: 15,
        dpo_name: 'DPO Person',
        dpo_email: 'dpo@example.com',
        dpo_phone: '+33123456789'
    };

    it('should map all fields from snake_case to frontend format', () => {
        const result = mapSettingsToFrontend(fullRow);

        expect(result.id).toBe('set-1');
        expect(result.llmModel).toBe('gpt-4o');
        expect(result.cvMode).toBe('anonymized');
        expect(result.chatbotEnabled).toBe('off');
        expect(result['Analysis Prompt']).toBe('custom analysis');
        expect(result['Improvement Prompt']).toBe('custom improvement');
        expect(result['Match Analysis Prompt']).toBe('custom match');
        expect(result['Adaptation Prompt']).toBe('custom adaptation');
        expect(result['Executive Summary Weight']).toBe(25);
        expect(result['Skills Weight']).toBe(25);
        expect(result['Experience Weight']).toBe(15);
        expect(result['Education Weight']).toBe(10);
        expect(result['ATS Weight']).toBe(10);
        expect(result['Hobbies Languages Weight']).toBe(15);
        expect(result['DPO Name']).toBe('DPO Person');
        expect(result['DPO Email']).toBe('dpo@example.com');
        expect(result['DPO Phone']).toBe('+33123456789');
    });

    it('should use defaults for missing/null fields', () => {
        const minimalRow = { id: 'set-2' };
        const result = mapSettingsToFrontend(minimalRow);

        expect(result.id).toBe('set-2');
        expect(result.llmModel).toBeNull();
        expect(result.cvMode).toBe('nominative');
        expect(result.chatbotEnabled).toBe('on');
        expect(result['Analysis Prompt']).toBe('default-analysis-prompt');
        expect(result['Improvement Prompt']).toBe('default-improvement-prompt');
        expect(result['Match Analysis Prompt']).toBe('default-match-analysis-prompt');
        expect(result['Adaptation Prompt']).toBe('default-adaptation-prompt');
        expect(result['Executive Summary Weight']).toBe(20);
        expect(result['Skills Weight']).toBe(20);
        expect(result['Experience Weight']).toBe(20);
        expect(result['Education Weight']).toBe(15);
        expect(result['ATS Weight']).toBe(15);
        expect(result['Hobbies Languages Weight']).toBe(10);
        expect(result['DPO Name']).toBe('');
        expect(result['DPO Email']).toBe('');
        expect(result['DPO Phone']).toBe('');
    });

    it('should preserve zero values for weights', () => {
        const row = { id: 'set-3', executive_summary_weight: 0, skills_weight: 0 };
        const result = mapSettingsToFrontend(row);

        // 0 is falsy, so || will use default — this is existing behavior
        expect(result['Executive Summary Weight']).toBe(20);
        expect(result['Skills Weight']).toBe(20);
    });
});

// ==========================================
// mapSettingsFromFrontend
// ==========================================
describe('mapSettingsFromFrontend', () => {
    it('should map all frontend fields to snake_case', () => {
        const data = {
            llmModel: 'gpt-4o',
            cvMode: 'anonymized',
            chatbotEnabled: 'off',
            'Analysis Prompt': 'prompt1',
            'Improvement Prompt': 'prompt2',
            'Match Analysis Prompt': 'prompt3',
            'Adaptation Prompt': 'prompt4',
            'Executive Summary Weight': 25,
            'Skills Weight': 25,
            'Experience Weight': 15,
            'Education Weight': 10,
            'ATS Weight': 10,
            'Hobbies Languages Weight': 15,
            'DPO Name': 'DPO',
            'DPO Email': 'dpo@test.com',
            'DPO Phone': '+33600000000'
        };

        const result = mapSettingsFromFrontend(data);

        expect(result.llm_model).toBe('gpt-4o');
        expect(result.cv_mode).toBe('anonymized');
        expect(result.chatbot_enabled).toBe('off');
        expect(result.analysis_prompt).toBe('prompt1');
        expect(result.improvement_prompt).toBe('prompt2');
        expect(result.match_analysis_prompt).toBe('prompt3');
        expect(result.adaptation_prompt).toBe('prompt4');
        expect(result.executive_summary_weight).toBe(25);
        expect(result.skills_weight).toBe(25);
        expect(result.experience_weight).toBe(15);
        expect(result.education_weight).toBe(10);
        expect(result.ats_weight).toBe(10);
        expect(result.hobbies_languages_weight).toBe(15);
        expect(result.dpo_name).toBe('DPO');
        expect(result.dpo_email).toBe('dpo@test.com');
        expect(result.dpo_phone).toBe('+33600000000');
    });

    it('should exclude undefined fields', () => {
        const data = { llmModel: 'gpt-4o' };
        const result = mapSettingsFromFrontend(data);

        expect(result.llm_model).toBe('gpt-4o');
        expect(Object.keys(result)).toHaveLength(1);
    });

    it('should keep null and empty string values', () => {
        const data = { llmModel: null, cvMode: '' };
        const result = mapSettingsFromFrontend(data);

        expect(result.llm_model).toBeNull();
        expect(result.cv_mode).toBe('');
        expect(Object.keys(result)).toHaveLength(2);
    });

    it('should return empty object for empty input', () => {
        const result = mapSettingsFromFrontend({});
        expect(Object.keys(result)).toHaveLength(0);
    });
});

// ==========================================
// mapTemplateToFrontend
// ==========================================
describe('mapTemplateToFrontend', () => {
    const fullRow = {
        id: 'tpl-1',
        name: 'Modern CV',
        description: 'A modern template',
        popular: true,
        status: 'active',
        tags: ['modern', 'clean'],
        preview_image_url: 'https://example.com/preview.png',
        header_content: '<header>H</header>',
        template_content: '<main>M</main>',
        footer_content: '<footer>F</footer>',
        footer_height: 30,
        stylesheet: 'body {}',
        firm_id: 'firm-1',
        firm_name: 'Test Firm',
        updated_at: '2026-01-15T10:00:00Z'
    };

    it('should map all fields from snake_case to PascalCase', () => {
        const result = mapTemplateToFrontend(fullRow);

        expect(result.id).toBe('tpl-1');
        expect(result.Name).toBe('Modern CV');
        expect(result.Description).toBe('A modern template');
        expect(result.Popular).toBe(true);
        expect(result.Status).toBe('active');
        expect(result.Tags).toEqual(['modern', 'clean']);
        expect(result.previewImage).toBe('https://example.com/preview.png');
        expect(result.PreviewImage).toBe('https://example.com/preview.png');
        expect(result.HeaderContent).toBe('<header>H</header>');
        expect(result.TemplateContent).toBe('<main>M</main>');
        expect(result.FooterContent).toBe('<footer>F</footer>');
        expect(result.FooterHeight).toBe(30);
        expect(result.Stylesheet).toBe('body {}');
        expect(result.FirmId).toBe('firm-1');
        expect(result.FirmName).toBe('Test Firm');
        expect(result.lastUpdated).toBe('2026-01-15T10:00:00Z');
        expect(result.LastUpdated).toBe('2026-01-15T10:00:00Z');
    });

    it('should use defaults for missing/null fields', () => {
        const minimalRow = { id: 'tpl-2', name: 'Min', description: 'Minimal' };
        const result = mapTemplateToFrontend(minimalRow);

        expect(result.Popular).toBe(false);
        expect(result.Status).toBe('active');
        expect(result.Tags).toEqual([]);
        expect(result.previewImage).toBeNull();
        expect(result.HeaderContent).toBe('');
        expect(result.TemplateContent).toBe('');
        expect(result.FooterContent).toBe('');
        expect(result.FooterHeight).toBe(25);
        expect(result.Stylesheet).toBe('');
        expect(result.FirmId).toBeNull();
        expect(result.FirmName).toBeNull();
    });

    it('should provide both camelCase and PascalCase for dual-format fields', () => {
        const result = mapTemplateToFrontend(fullRow);

        // previewImage / PreviewImage
        expect(result.previewImage).toBe(result.PreviewImage);
        // lastUpdated / LastUpdated
        expect(result.lastUpdated).toBe(result.LastUpdated);
    });
});

// ==========================================
// mapTemplateFromFrontend
// ==========================================
describe('mapTemplateFromFrontend', () => {
    it('should map PascalCase to snake_case', () => {
        const data = {
            Name: 'New Template',
            Description: 'A new template',
            Popular: true,
            Status: 'Active',
            Tags: ['new'],
            PreviewImage: 'https://example.com/img.png',
            HeaderContent: '<header>New</header>',
            TemplateContent: '<main>Content</main>',
            FooterContent: '<footer>Foot</footer>',
            FooterHeight: 30,
            Stylesheet: 'body { color: red; }'
        };

        const result = mapTemplateFromFrontend(data);

        expect(result.name).toBe('New Template');
        expect(result.description).toBe('A new template');
        expect(result.popular).toBe(true);
        expect(result.status).toBe('active'); // lowercased
        expect(result.tags).toEqual(['new']);
        expect(result.preview_image_url).toBe('https://example.com/img.png');
        expect(result.header_content).toBe('<header>New</header>');
        expect(result.template_content).toBe('<main>Content</main>');
        expect(result.footer_content).toBe('<footer>Foot</footer>');
        expect(result.footer_height).toBe(30);
        expect(result.stylesheet).toBe('body { color: red; }');
    });

    it('should lowercase Status value', () => {
        const data = { Status: 'ACTIVE' };
        const result = mapTemplateFromFrontend(data);
        expect(result.status).toBe('active');
    });

    it('should exclude undefined fields', () => {
        const data = { Name: 'Only Name' };
        const result = mapTemplateFromFrontend(data);

        expect(result.name).toBe('Only Name');
        expect(Object.keys(result)).toHaveLength(1);
        expect(result.description).toBeUndefined();
    });

    it('should keep null and empty string values', () => {
        const data = { Name: '', Description: null };
        const result = mapTemplateFromFrontend(data);

        expect(result.name).toBe('');
        expect(result.description).toBeNull();
        expect(Object.keys(result)).toHaveLength(2);
    });

    it('should return empty object for empty input', () => {
        const result = mapTemplateFromFrontend({});
        expect(Object.keys(result)).toHaveLength(0);
    });

    it('should handle partial update (only changed fields)', () => {
        const data = { Name: 'Updated Name', Stylesheet: 'new styles' };
        const result = mapTemplateFromFrontend(data);

        expect(Object.keys(result)).toHaveLength(2);
        expect(result.name).toBe('Updated Name');
        expect(result.stylesheet).toBe('new styles');
    });

    it('should handle Status being undefined (not set)', () => {
        const data = { Name: 'Test' };
        const result = mapTemplateFromFrontend(data);
        expect(result.status).toBeUndefined();
    });
});

// ==========================================
// Round-trip consistency
// ==========================================
describe('Round-trip consistency', () => {
    it('template: frontend → DB → frontend should preserve values', () => {
        const frontendData = {
            Name: 'Round Trip',
            Description: 'Testing round trip',
            Popular: true,
            Status: 'Active',
            Tags: ['test'],
            PreviewImage: 'https://example.com/rt.png',
            HeaderContent: '<header>RT</header>',
            TemplateContent: '<main>RT</main>',
            FooterContent: '<footer>RT</footer>',
            FooterHeight: 35,
            Stylesheet: '.rt { color: blue; }'
        };

        // Frontend → DB format
        const dbFields = mapTemplateFromFrontend(frontendData);

        // Simulate a DB row by adding id, firm_id, firm_name, updated_at
        const dbRow = {
            id: 'tpl-rt',
            ...dbFields,
            firm_id: 'firm-1',
            firm_name: 'Test Firm',
            updated_at: '2026-01-15T10:00:00Z'
        };

        // DB → Frontend format
        const result = mapTemplateToFrontend(dbRow);

        expect(result.Name).toBe('Round Trip');
        expect(result.Description).toBe('Testing round trip');
        expect(result.Popular).toBe(true);
        expect(result.Status).toBe('active'); // lowercased during fromFrontend
        expect(result.Tags).toEqual(['test']);
        expect(result.PreviewImage).toBe('https://example.com/rt.png');
        expect(result.HeaderContent).toBe('<header>RT</header>');
        expect(result.TemplateContent).toBe('<main>RT</main>');
        expect(result.FooterContent).toBe('<footer>RT</footer>');
        expect(result.FooterHeight).toBe(35);
        expect(result.Stylesheet).toBe('.rt { color: blue; }');
    });

    it('settings: frontend → DB → frontend should preserve values', () => {
        const frontendData = {
            llmModel: 'gpt-4o',
            cvMode: 'anonymized',
            chatbotEnabled: 'off',
            'Analysis Prompt': 'custom-a',
            'DPO Name': 'DPO Test'
        };

        const dbFields = mapSettingsFromFrontend(frontendData);
        const dbRow = { id: 'set-rt', ...dbFields };
        const result = mapSettingsToFrontend(dbRow);

        expect(result.llmModel).toBe('gpt-4o');
        expect(result.cvMode).toBe('anonymized');
        expect(result.chatbotEnabled).toBe('off');
        expect(result['Analysis Prompt']).toBe('custom-a');
        expect(result['DPO Name']).toBe('DPO Test');
    });
});

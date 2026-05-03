import { describe, expect, it } from 'vitest';
import {
  createSavePayload,
  defaultFormData,
  getDefaultModelForProvider,
  getTotalWeight,
  toFormData,
} from './SettingsPage.hooks';
import { getDefaultPublicHomeEnabled } from '../app/publicHomeSetting';

describe('SettingsPage helpers', () => {
  it('derives the default model for each supported provider', () => {
    expect(getDefaultModelForProvider('anthropic')).toBe('claude-sonnet-4-20250514');
    expect(getDefaultModelForProvider('gemma')).toBe('gemma-4-31b-it');
    expect(getDefaultModelForProvider('deepseek')).toBe('deepseek-v4-flash');
    expect(getDefaultModelForProvider('glm')).toBe('glm-5.1');
    expect(getDefaultModelForProvider('minimax')).toBe('MiniMax-M2.7');
    expect(getDefaultModelForProvider('ollama')).toBe('');
    expect(getDefaultModelForProvider('openai')).toBe('gpt-4o');
  });

  it('maps partial api settings into complete form data', () => {
    expect(toFormData({
      llmProvider: 'anthropic',
      chatbotEnabled: 'off',
      publicHomeEnabled: getDefaultPublicHomeEnabled(),
      'Executive Summary Weight': 30,
    })).toEqual(expect.objectContaining({
      llmProvider: 'anthropic',
      llmModel: 'claude-sonnet-4-20250514',
      llmModelParametersJson: '{}',
      chatbotEnabled: 'off',
      'Executive Summary Weight': 30,
      'Skills Weight': 20,
    }));
  });

  it('preserves explicit off/zero settings instead of falling back to defaults', () => {
    expect(toFormData({
      chatbotEnabled: 'off',
      webglEnabled: 'off',
      preAnalysisEnabled: false,
      ollamaNumCtx: 0,
      'Executive Summary Weight': 0,
      'Skills Weight': 0,
    })).toEqual(expect.objectContaining({
      chatbotEnabled: 'off',
      webglEnabled: 'off',
      preAnalysisEnabled: false,
      ollamaNumCtx: 0,
      'Executive Summary Weight': 0,
      'Skills Weight': 0,
    }));
  });

  it('normalizes numeric values and chatbot status in the save payload', () => {
    const payload = createSavePayload({
      ...defaultFormData,
      chatbotEnabled: 'off',
      'Executive Summary Weight': '25' as never,
      'Skills Weight': '15' as never,
    });

    expect(payload).toEqual(expect.objectContaining({
      chatbotEnabled: 'off',
      publicHomeEnabled: getDefaultPublicHomeEnabled(),
      llmModelParameters: {},
      'Executive Summary Weight': 25,
      'Skills Weight': 15,
    }));
  });

  it('parses llm parameters json into the save payload', () => {
    const payload = createSavePayload({
      ...defaultFormData,
      llmModelParametersJson: '{\n  "openai": {\n    "gpt-4o": {\n      "temperature": 0,\n      "top_p": 1\n    }\n  }\n}',
    });

    expect(payload.llmModelParameters).toEqual({
      openai: {
        'gpt-4o': {
          temperature: 0,
          top_p: 1,
        },
      },
    });
  });

  it('keeps the selected remote llm model when provider is ollama', () => {
    const payload = createSavePayload({
      ...defaultFormData,
      llmProvider: 'ollama',
      llmModel: 'llama3.2',
    });

    expect(payload.llmModel).toBe('llama3.2');
  });

  it('omits empty ollama fields when saving non-ollama defaults', () => {
    const payload = createSavePayload({
      ...defaultFormData,
      llmProvider: 'openai',
      llmModel: 'gpt-4o',
      ollamaBaseUrl: '',
      ollamaVisionModel: '',
    });

    expect(payload.ollamaBaseUrl).toBeUndefined();
    expect(payload.ollamaVisionModel).toBeUndefined();
    expect(payload.ollamaKeepAlive).toBeUndefined();
    expect(payload.ollamaNumCtx).toBeUndefined();
  });

  it('computes the current total weight', () => {
    expect(getTotalWeight(defaultFormData)).toBe(100);
  });

  it('defaults the public home toggle from the vite flag', () => {
    expect(defaultFormData.publicHomeEnabled).toBe(getDefaultPublicHomeEnabled());
    expect(toFormData({})).toEqual(expect.objectContaining({
      publicHomeEnabled: getDefaultPublicHomeEnabled(),
    }));
  });
});

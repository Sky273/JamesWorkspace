import { describe, expect, it } from 'vitest';
import {
  createSavePayload,
  defaultFormData,
  getDefaultModelForProvider,
  getTotalWeight,
  toFormData,
} from './SettingsPage.hooks';

describe('SettingsPage helpers', () => {
  it('derives the default model for each supported provider', () => {
    expect(getDefaultModelForProvider('anthropic')).toBe('claude-sonnet-4-20250514');
    expect(getDefaultModelForProvider('deepseek')).toBe('deepseek-chat');
    expect(getDefaultModelForProvider('glm')).toBe('glm-5.1');
    expect(getDefaultModelForProvider('minimax')).toBe('MiniMax-M2.7');
    expect(getDefaultModelForProvider('openai')).toBe('gpt-4o');
  });

  it('maps partial api settings into complete form data', () => {
    expect(toFormData({
      llmProvider: 'anthropic',
      chatbotEnabled: 'off',
      'Executive Summary Weight': 30,
    })).toEqual(expect.objectContaining({
      llmProvider: 'anthropic',
      llmModel: 'claude-sonnet-4-20250514',
      chatbotEnabled: 'off',
      'Executive Summary Weight': 30,
      'Skills Weight': 20,
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
      'Executive Summary Weight': 25,
      'Skills Weight': 15,
    }));
  });

  it('clears the hosted llm model when provider is ollama', () => {
    const payload = createSavePayload({
      ...defaultFormData,
      llmProvider: 'ollama',
      llmModel: 'llama3.2',
    });

    expect(payload.llmModel).toBe('');
  });

  it('computes the current total weight', () => {
    expect(getTotalWeight(defaultFormData)).toBe(100);
  });
});

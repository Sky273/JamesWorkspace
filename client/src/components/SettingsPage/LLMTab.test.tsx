import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import LLMTab from './LLMTab';

describe('LLMTab', () => {
  it('formats valid json and marks it as valid', () => {
    const onInputChange = vi.fn();

    render(
      <LLMTab
        formData={{
          llmProvider: 'openai',
          llmModel: 'gpt-4o',
          llmModelParametersJson: '{"openai":{"gpt-4o":{"temperature":0}}}',
          cvMode: 'nominative',
          webglEnabled: 'on',
          ollamaBaseUrl: '',
        }}
        onInputChange={onInputChange}
        t={(key) => key}
        llmModelCatalog={{ openai: [{ value: 'gpt-4o', label: 'gpt-4o' }] }}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Afficher le JSON' }));
    fireEvent.click(screen.getByRole('button', { name: 'Formatter' }));

    expect(onInputChange).toHaveBeenCalledWith(
      'llmModelParametersJson',
      '{\n  "openai": {\n    "gpt-4o": {\n      "temperature": 0\n    }\n  }\n}'
    );
    expect(screen.getByText('JSON valide')).toBeInTheDocument();
  });

  it('flags invalid json during validation', () => {
    const onInputChange = vi.fn();

    render(
      <LLMTab
        formData={{
          llmProvider: 'openai',
          llmModel: 'gpt-4o',
          llmModelParametersJson: '{"openai":',
          cvMode: 'nominative',
          webglEnabled: 'on',
          ollamaBaseUrl: '',
        }}
        onInputChange={onInputChange}
        t={(key) => key}
        llmModelCatalog={{ openai: [{ value: 'gpt-4o', label: 'gpt-4o' }] }}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Afficher le JSON' }));
    fireEvent.click(screen.getByRole('button', { name: 'Valider' }));

    expect(screen.getByText('JSON invalide')).toBeInTheDocument();
    expect(onInputChange).not.toHaveBeenCalled();
  });

  it('injects an example payload for the current provider and model', () => {
    const onInputChange = vi.fn();

    render(
      <LLMTab
        formData={{
          llmProvider: 'openai',
          llmModel: 'gpt-4o',
          llmModelParametersJson: '{}',
          cvMode: 'nominative',
          webglEnabled: 'on',
          ollamaBaseUrl: '',
        }}
        onInputChange={onInputChange}
        t={(key) => key}
        llmModelCatalog={{ openai: [{ value: 'gpt-4o', label: 'gpt-4o' }] }}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Afficher le JSON' }));
    fireEvent.click(screen.getByRole('button', { name: 'Injecter un exemple' }));

    expect(onInputChange).toHaveBeenCalledWith(
      'llmModelParametersJson',
      '{\n  "openai": {\n    "gpt-4o": {\n      "temperature": 0,\n      "top_p": 1,\n      "max_tokens": 4096\n    }\n  }\n}'
    );
    expect(screen.getByText('JSON valide')).toBeInTheDocument();
  });

  it('resets json to an empty object', () => {
    const onInputChange = vi.fn();

    render(
      <LLMTab
        formData={{
          llmProvider: 'openai',
          llmModel: 'gpt-4o',
          llmModelParametersJson: '{\n  "openai": {}\n}',
          cvMode: 'nominative',
          webglEnabled: 'on',
          ollamaBaseUrl: '',
        }}
        onInputChange={onInputChange}
        t={(key) => key}
        llmModelCatalog={{ openai: [{ value: 'gpt-4o', label: 'gpt-4o' }] }}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Afficher le JSON' }));
    fireEvent.click(screen.getByRole('button', { name: 'Reinitialiser' }));

    expect(onInputChange).toHaveBeenCalledWith('llmModelParametersJson', '{}');
  });

  it('edits structured Ollama fields and syncs them back to JSON', () => {
    const onInputChange = vi.fn();

    render(
      <LLMTab
        formData={{
          llmProvider: 'ollama',
          llmModel: 'llama3.2:latest',
          llmModelParametersJson: '{}',
          cvMode: 'nominative',
          webglEnabled: 'on',
          ollamaBaseUrl: 'http://ollama.local:11434',
        }}
        onInputChange={onInputChange}
        t={(key) => key}
        llmModelCatalog={{ ollama: [{ value: 'llama3.2:latest', label: 'llama3.2:latest' }] }}
        llmParameterDefinitions={{
          ollama: {
            __global__: {
              keep_alive: { key: 'keep_alive', type: 'string', label: 'Keep alive' },
            },
            'llama3.2:latest': {
              num_ctx: { key: 'num_ctx', type: 'integer', label: 'Context window' },
            },
          },
        }}
      />
    );

    fireEvent.change(screen.getByLabelText('Keep alive'), { target: { value: '10m' } });

    expect(onInputChange).toHaveBeenCalledWith(
      'llmModelParametersJson',
      '{\n  "ollama": {\n    "__global__": {\n      "keep_alive": "10m"\n    }\n  }\n}'
    );

    fireEvent.change(screen.getByLabelText('Context window'), { target: { value: '16384' } });

    expect(onInputChange).toHaveBeenCalledWith(
      'llmModelParametersJson',
      '{\n  "ollama": {\n    "llama3.2:latest": {\n      "num_ctx": 16384\n    }\n  }\n}'
    );
  });
});

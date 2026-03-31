import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import HealthIndicator from './HealthIndicator';

const mockFetchWithAuth = vi.fn();
let mockUser: { role: string } | null = { role: 'admin' };

const healthPayload = {
  status: 'degraded',
  responseTime: '120ms',
  timestamp: '2026-03-25T10:00:00.000Z',
  checks: {
    server: { status: 'ok', uptime: '1d' },
    database: { status: 'error', error: 'Connexion échouée', latency: '42ms' },
    memory: { status: 'warning', heapPercent: '92%', heapUsed: '200 MB' },
    cache: { status: 'ok', backend: 'memory-fallback', settings: 1, templates: 2, firms: 3 },
    ocr: {
      status: 'ok',
      preferredEngine: 'tesseract-cli',
      tesseractCliAvailable: true,
      pdftoppmAvailable: true,
      pythonCommand: 'python3',
      advancedBackend: 'paddleocr',
      advancedBackendAvailable: true
    },
    openai: { status: 'configured', message: 'API key present' },
    anthropic: { status: 'configured', message: 'API key present' },
    deepseek: { status: 'configured', message: 'API key present' },
    glm: { status: 'configured', message: 'API key present' },
    minimax: { status: 'configured', message: 'API key present' },
    ollama: { status: 'error', message: 'Ollama unreachable' }
  }
};

const cachePayload = {
  cacheBackend: {
    backend: 'memory-fallback',
    connected: false,
    fallbackReason: 'redis_unavailable'
  }
};

const circuitBreakerPayload = {
  openai: { provider: 'openai', supported: true, state: 'CLOSED', failures: 0, lastFailureTime: null, configured: true },
  anthropic: { provider: 'anthropic', supported: true, state: 'CLOSED', failures: 0, lastFailureTime: null, configured: true },
  deepseek: { provider: 'deepseek', supported: true, state: 'HALF_OPEN', failures: 1, lastFailureTime: null, configured: true },
  glm: { provider: 'glm', supported: true, state: 'CLOSED', failures: 0, lastFailureTime: null, configured: true },
  minimax: { provider: 'minimax', supported: true, state: 'OPEN', failures: 3, lastFailureTime: null, configured: true },
  ollama: { provider: 'ollama', supported: false, state: 'NOT_APPLICABLE', failures: 0, lastFailureTime: null, configured: true }
};

vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({ user: mockUser })
}));

vi.mock('../utils/apiInterceptor', () => ({
  fetchWithAuth: (...args: unknown[]) => mockFetchWithAuth(...args),
  createAuthOptions: vi.fn(() => ({ method: 'GET' }))
}));

vi.mock('../utils/dateFormatter', () => ({
  formatDateTime: (value: string) => `formatted:${value}`
}));

describe('HealthIndicator', () => {
  beforeEach(() => {
    mockUser = { role: 'admin' };
    mockFetchWithAuth.mockReset();
    mockFetchWithAuth
      .mockResolvedValueOnce({ ok: true, json: async () => healthPayload })
      .mockResolvedValueOnce({ ok: true, json: async () => cachePayload })
      .mockResolvedValueOnce({ ok: true, json: async () => circuitBreakerPayload })
      .mockResolvedValueOnce({ ok: true, json: async () => healthPayload })
      .mockResolvedValueOnce({ ok: true, json: async () => cachePayload })
      .mockResolvedValueOnce({ ok: true, json: async () => circuitBreakerPayload });
  });

  it('renders nothing for non-admin users by default', () => {
    mockUser = { role: 'user' };
    const { container } = render(<HealthIndicator />);
    expect(container.firstChild).toBeNull();
  });

  it('renders the header health indicator and architecture-aligned details for admins', async () => {
    render(<HealthIndicator variant="header" />);

    expect(await screen.findByText('Problème')).toBeInTheDocument();
    expect(screen.getByText(/Mémoire: 200 MB/)).toBeInTheDocument();
    expect(screen.getByText('(3)')).toBeInTheDocument();

    fireEvent.mouseEnter(screen.getByText('Problème').closest('div') as HTMLElement);

    await waitFor(() => {
      expect(screen.getByText('État du système')).toBeInTheDocument();
    });

    expect(screen.getByText('Plateforme')).toBeInTheDocument();
    expect(screen.getByText('Cache')).toBeInTheDocument();
    expect(screen.getByText('OCR')).toBeInTheDocument();
    expect(screen.getByText('Familles LLM')).toBeInTheDocument();
    expect(screen.getByText(/fallback mémoire/i)).toBeInTheDocument();
    expect(screen.getByText(/tesseract-cli/i)).toBeInTheDocument();
    expect(screen.getByText(/paddleocr/i)).toBeInTheDocument();
    expect(screen.getByText(/CB OPEN/i)).toBeInTheDocument();
    expect(screen.getByText((content) => content.includes('formatted:2026-03-25T10:00:00.000Z'))).toBeInTheDocument();
    expect(mockFetchWithAuth).toHaveBeenCalledTimes(6);
  });

  it('shows an unhealthy state when the server cannot be reached', async () => {
    mockFetchWithAuth.mockReset();
    mockFetchWithAuth
      .mockRejectedValueOnce(new Error('network down'))
      .mockResolvedValueOnce({ ok: true, json: async () => cachePayload })
      .mockResolvedValueOnce({ ok: true, json: async () => circuitBreakerPayload })
      .mockRejectedValueOnce(new Error('network down'))
      .mockResolvedValueOnce({ ok: true, json: async () => cachePayload })
      .mockResolvedValueOnce({ ok: true, json: async () => circuitBreakerPayload });

    render(<HealthIndicator variant="header" showAlways />);

    expect(await screen.findByText('Problème')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Problème').closest('div') as HTMLElement);

    await waitFor(() => {
      expect(screen.getByText(/Impossible de contacter le serveur/)).toBeInTheDocument();
    });
  });

  it('applies the memory thresholds to the global status', async () => {
    mockFetchWithAuth.mockReset();
    const memoryOnlyPayload = {
      status: 'healthy',
      responseTime: '40ms',
      timestamp: '2026-03-25T10:00:00.000Z',
      checks: {
        server: { status: 'ok', uptime: '1d' },
        database: { status: 'ok', latency: '12ms' },
        memory: { status: 'ok', heapUsed: '500 MB', heapTotal: '2 GB' },
        cache: { status: 'ok', backend: 'redis', settings: 1, templates: 2, firms: 3 },
        ocr: { status: 'ok', preferredEngine: 'tesseract-cli', tesseractCliAvailable: true, pdftoppmAvailable: true, pythonCommand: 'python3', advancedBackend: 'paddleocr', advancedBackendAvailable: true },
        openai: { status: 'configured', message: 'API key present' },
        anthropic: { status: 'configured', message: 'API key present' },
        deepseek: { status: 'configured', message: 'API key present' },
        glm: { status: 'configured', message: 'API key present' },
        minimax: { status: 'configured', message: 'API key present' },
        ollama: { status: 'configured', message: 'API key present' }
      }
    };

    const healthyCachePayload = {
      cacheBackend: {
        backend: 'redis',
        connected: true,
        fallbackReason: null
      }
    };

    const closedBreakers = {
      openai: { provider: 'openai', supported: true, state: 'CLOSED', failures: 0, lastFailureTime: null, configured: true },
      anthropic: { provider: 'anthropic', supported: true, state: 'CLOSED', failures: 0, lastFailureTime: null, configured: true },
      deepseek: { provider: 'deepseek', supported: true, state: 'CLOSED', failures: 0, lastFailureTime: null, configured: true },
      glm: { provider: 'glm', supported: true, state: 'CLOSED', failures: 0, lastFailureTime: null, configured: true },
      minimax: { provider: 'minimax', supported: true, state: 'CLOSED', failures: 0, lastFailureTime: null, configured: true },
      ollama: { provider: 'ollama', supported: false, state: 'NOT_APPLICABLE', failures: 0, lastFailureTime: null, configured: true }
    };

    mockFetchWithAuth
      .mockResolvedValueOnce({ ok: true, json: async () => memoryOnlyPayload })
      .mockResolvedValueOnce({ ok: true, json: async () => healthyCachePayload })
      .mockResolvedValueOnce({ ok: true, json: async () => closedBreakers });

    const { unmount } = render(<HealthIndicator variant="header" showAlways />);
    expect(await screen.findByText('Dégradé')).toBeInTheDocument();
    expect(screen.getByText(/Mémoire: 500 MB \/ 2 GB/)).toBeInTheDocument();

    mockFetchWithAuth.mockReset();
    mockFetchWithAuth
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          ...memoryOnlyPayload,
          checks: {
            ...memoryOnlyPayload.checks,
            memory: { status: 'ok', heapUsed: '2 GB', heapTotal: '4 GB' }
          }
        })
      })
      .mockResolvedValueOnce({ ok: true, json: async () => healthyCachePayload })
      .mockResolvedValueOnce({ ok: true, json: async () => closedBreakers });

    unmount();
    render(<HealthIndicator variant="header" showAlways />);
    expect(await screen.findByText('Problème')).toBeInTheDocument();
  });

  it('does not degrade the global status when at least one LLM remains configured', async () => {
    mockFetchWithAuth.mockReset();
    const llmMixedPayload = {
      status: 'healthy',
      responseTime: '40ms',
      timestamp: '2026-03-25T10:00:00.000Z',
      checks: {
        server: { status: 'ok', uptime: '1d' },
        database: { status: 'ok', latency: '12ms' },
        memory: { status: 'ok', heapUsed: '200 MB', heapTotal: '2 GB' },
        cache: { status: 'ok', backend: 'redis', settings: 1, templates: 2, firms: 3 },
        ocr: { status: 'warning', preferredEngine: 'tesseract.js', tesseractCliAvailable: false, pdftoppmAvailable: false, pythonCommand: null, advancedBackend: null, advancedBackendAvailable: false },
        openai: { status: 'configured', message: 'API key present' },
        anthropic: { status: 'error', message: 'Anthropic unavailable' },
        deepseek: { status: 'error', message: 'DeepSeek unavailable' },
        glm: { status: 'error', message: 'GLM unavailable' },
        minimax: { status: 'error', message: 'MiniMax unavailable' },
        ollama: { status: 'error', message: 'Ollama unavailable' }
      }
    };

    const healthyCachePayload = {
      cacheBackend: {
        backend: 'redis',
        connected: true,
        fallbackReason: null
      }
    };

    const mixedBreakers = {
      openai: { provider: 'openai', supported: true, state: 'CLOSED', failures: 0, lastFailureTime: null, configured: true },
      anthropic: { provider: 'anthropic', supported: true, state: 'OPEN', failures: 2, lastFailureTime: null, configured: true },
      deepseek: { provider: 'deepseek', supported: true, state: 'OPEN', failures: 2, lastFailureTime: null, configured: true },
      glm: { provider: 'glm', supported: true, state: 'OPEN', failures: 2, lastFailureTime: null, configured: true },
      minimax: { provider: 'minimax', supported: true, state: 'OPEN', failures: 2, lastFailureTime: null, configured: true },
      ollama: { provider: 'ollama', supported: false, state: 'NOT_APPLICABLE', failures: 0, lastFailureTime: null, configured: true }
    };

    mockFetchWithAuth
      .mockResolvedValueOnce({ ok: true, json: async () => llmMixedPayload })
      .mockResolvedValueOnce({ ok: true, json: async () => healthyCachePayload })
      .mockResolvedValueOnce({ ok: true, json: async () => mixedBreakers });

    render(<HealthIndicator variant="header" showAlways />);
    expect(await screen.findByText('Système OK')).toBeInTheDocument();
  });

  it('does not degrade the global status when only backend latency marks the health as degraded', async () => {
    mockFetchWithAuth.mockReset();
    const latencyOnlyPayload = {
      status: 'degraded',
      responseTime: '1250ms',
      timestamp: '2026-03-25T10:00:00.000Z',
      checks: {
        server: { status: 'ok', uptime: '1d', latency: '1250ms' },
        database: { status: 'ok', latency: '12ms' },
        memory: { status: 'ok', heapUsed: '200 MB', heapTotal: '2 GB' },
        cache: { status: 'ok', backend: 'redis', settings: 1, templates: 2, firms: 3 },
        ocr: { status: 'warning', preferredEngine: 'tesseract.js', tesseractCliAvailable: false, pdftoppmAvailable: false, pythonCommand: null, advancedBackend: null, advancedBackendAvailable: false },
        openai: { status: 'configured', message: 'API key present' },
        anthropic: { status: 'configured', message: 'API key present' },
        deepseek: { status: 'configured', message: 'API key present' },
        glm: { status: 'configured', message: 'API key present' },
        minimax: { status: 'configured', message: 'API key present' },
        ollama: { status: 'configured', message: 'API key present' }
      }
    };

    const healthyCachePayload = {
      cacheBackend: {
        backend: 'redis',
        connected: true,
        fallbackReason: null
      }
    };

    const closedBreakers = {
      openai: { provider: 'openai', supported: true, state: 'CLOSED', failures: 0, lastFailureTime: null, configured: true },
      anthropic: { provider: 'anthropic', supported: true, state: 'CLOSED', failures: 0, lastFailureTime: null, configured: true },
      deepseek: { provider: 'deepseek', supported: true, state: 'CLOSED', failures: 0, lastFailureTime: null, configured: true },
      glm: { provider: 'glm', supported: true, state: 'CLOSED', failures: 0, lastFailureTime: null, configured: true },
      minimax: { provider: 'minimax', supported: true, state: 'CLOSED', failures: 0, lastFailureTime: null, configured: true },
      ollama: { provider: 'ollama', supported: false, state: 'NOT_APPLICABLE', failures: 0, lastFailureTime: null, configured: true }
    };

    mockFetchWithAuth
      .mockResolvedValueOnce({ ok: true, json: async () => latencyOnlyPayload })
      .mockResolvedValueOnce({ ok: true, json: async () => healthyCachePayload })
      .mockResolvedValueOnce({ ok: true, json: async () => closedBreakers });

    render(<HealthIndicator variant="header" showAlways />);
    expect(await screen.findByText('Système OK')).toBeInTheDocument();
    expect(screen.getByText(/Mémoire: 200 MB \/ 2 GB/)).toBeInTheDocument();
  });

  it('shows advanced OCR as optional when the CLI pipeline is already healthy', async () => {
    mockFetchWithAuth.mockReset();
    const optionalAdvancedOcrPayload = {
      status: 'healthy',
      responseTime: '40ms',
      timestamp: '2026-03-25T10:00:00.000Z',
      checks: {
        server: { status: 'ok', uptime: '1d' },
        database: { status: 'ok', latency: '12ms' },
        memory: { status: 'ok', heapUsed: '200 MB', heapTotal: '2 GB' },
        cache: { status: 'ok', backend: 'redis', settings: 1, templates: 2, firms: 3 },
        ocr: {
          status: 'ok',
          preferredEngine: 'tesseract-cli',
          tesseractCliAvailable: true,
          pdftoppmAvailable: true,
          pythonCommand: 'python3',
          advancedBackend: 'paddleocr',
          advancedBackendAvailable: false,
          advancedBackendStatus: 'not_applicable'
        },
        openai: { status: 'configured', message: 'API key present' },
        anthropic: { status: 'configured', message: 'API key present' },
        deepseek: { status: 'configured', message: 'API key present' },
        glm: { status: 'configured', message: 'API key present' },
        minimax: { status: 'configured', message: 'API key present' },
        ollama: { status: 'configured', message: 'API key present' }
      }
    };

    const healthyCachePayload = {
      cacheBackend: {
        backend: 'redis',
        connected: true,
        fallbackReason: null
      }
    };

    const closedBreakers = {
      openai: { provider: 'openai', supported: true, state: 'CLOSED', failures: 0, lastFailureTime: null, configured: true },
      anthropic: { provider: 'anthropic', supported: true, state: 'CLOSED', failures: 0, lastFailureTime: null, configured: true },
      deepseek: { provider: 'deepseek', supported: true, state: 'CLOSED', failures: 0, lastFailureTime: null, configured: true },
      glm: { provider: 'glm', supported: true, state: 'CLOSED', failures: 0, lastFailureTime: null, configured: true },
      minimax: { provider: 'minimax', supported: true, state: 'CLOSED', failures: 0, lastFailureTime: null, configured: true },
      ollama: { provider: 'ollama', supported: false, state: 'NOT_APPLICABLE', failures: 0, lastFailureTime: null, configured: true }
    };

    mockFetchWithAuth
      .mockResolvedValueOnce({ ok: true, json: async () => optionalAdvancedOcrPayload })
      .mockResolvedValueOnce({ ok: true, json: async () => healthyCachePayload })
      .mockResolvedValueOnce({ ok: true, json: async () => closedBreakers })
      .mockResolvedValueOnce({ ok: true, json: async () => optionalAdvancedOcrPayload })
      .mockResolvedValueOnce({ ok: true, json: async () => healthyCachePayload })
      .mockResolvedValueOnce({ ok: true, json: async () => closedBreakers });

    render(<HealthIndicator variant="header" showAlways />);
    expect(await screen.findByText('Système OK')).toBeInTheDocument();

    fireEvent.click(screen.getByText('Système OK').closest('div') as HTMLElement);

    await waitFor(() => {
      expect(screen.getByText(/optionnel indisponible/i)).toBeInTheDocument();
    });
  });
});

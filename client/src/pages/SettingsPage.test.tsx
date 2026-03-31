import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import SettingsPage from './SettingsPage';

const {
  authGetMock,
  authPostMock,
  authPutMock,
  setChatbotEnabledMock,
  toastSuccessMock,
  toastErrorMock,
} = vi.hoisted(() => ({
  authGetMock: vi.fn(),
  authPostMock: vi.fn(),
  authPutMock: vi.fn(),
  setChatbotEnabledMock: vi.fn(),
  toastSuccessMock: vi.fn(),
  toastErrorMock: vi.fn(),
}));

vi.mock('../hooks/useAuthFetch', () => ({
  useAuthFetch: () => ({
    authGet: authGetMock,
    authPost: authPostMock,
    authPut: authPutMock,
  }),
}));

vi.mock('../context/ChatbotContext', () => ({
  useChatbot: () => ({
    setChatbotEnabled: setChatbotEnabledMock,
  }),
}));

vi.mock('react-hot-toast', () => ({
  default: {
    success: toastSuccessMock,
    error: toastErrorMock,
  },
}));

vi.mock('../utils/logger.frontend', () => ({
  default: {
    log: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock('../components/SettingsPage', () => ({
  LLMTab: ({
    formData,
    onInputChange,
  }: {
    formData: { llmProvider: string; chatbotEnabled: string };
    onInputChange: (field: string, value: string | number | boolean) => void;
  }) => (
    <div data-testid="llm-tab">
      <span>{formData.llmProvider}</span>
      <button onClick={() => onInputChange('chatbotEnabled', 'off')}>disable-chatbot</button>
    </div>
  ),
  PromptsTab: () => <div data-testid="prompts-tab" />,
  WeightsTab: ({
    onInputChange,
    totalWeight,
  }: {
    onInputChange: (field: string, value: string | number | boolean) => void;
    totalWeight: number;
  }) => (
    <div data-testid="weights-tab">
      <span>{totalWeight}</span>
      <button onClick={() => onInputChange('Executive Summary Weight', 10)}>set-invalid-weight</button>
      <button onClick={() => onInputChange('Executive Summary Weight', 20)}>set-valid-weight</button>
    </div>
  ),
  ChatbotTab: () => <div data-testid="chatbot-tab" />,
  GdprTab: () => <div data-testid="gdpr-tab" />,
  DpoTab: () => <div data-testid="dpo-tab" />,
}));

vi.mock('../components/SettingsPage/SettingsHeader', () => ({
  default: () => <div data-testid="settings-header">settings-header</div>,
}));

vi.mock('../components/SettingsPage/SettingsTabsNav', () => ({
  default: ({
    tabs,
    onTabChange,
  }: {
    tabs: Array<{ id: string; name: string }>;
    onTabChange: (tabId: string) => void;
  }) => (
    <div data-testid="settings-tabs">
      {tabs.map((tab) => (
        <button key={tab.id} onClick={() => onTabChange(tab.id)}>
          {tab.name}
        </button>
      ))}
    </div>
  ),
}));

vi.mock('../components/SettingsPage/SettingsApiDocsPanel', () => ({
  default: () => <div data-testid="swagger-tab" />,
}));

describe('SettingsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('confirm', vi.fn(() => true));
    authGetMock.mockImplementation(async (url: string) => {
      if (url === '/api/settings') {
        return {
          ok: true,
          json: async () => ({
            id: 'settings-1',
            llmProvider: 'anthropic',
            llmModel: 'claude-sonnet-4-20250514',
            chatbotEnabled: 'on',
            webglEnabled: 'on',
            'Executive Summary Weight': 20,
            'Skills Weight': 20,
            'Experience Weight': 20,
            'Education Weight': 15,
            'ATS Weight': 15,
            'Hobbies Languages Weight': 10,
          }),
        };
      }

      if (url === '/api/settings/defaults') {
        return {
          ok: true,
          json: async () => ({
            llmProvider: 'openai',
            llmModel: 'gpt-4o',
            chatbotEnabled: 'off',
            webglEnabled: 'on',
            'Executive Summary Weight': 20,
            'Skills Weight': 20,
            'Experience Weight': 20,
            'Education Weight': 15,
            'ATS Weight': 15,
            'Hobbies Languages Weight': 10,
          }),
        };
      }

      throw new Error(`Unexpected authGet url: ${url}`);
    });
  });

  it('loads settings and renders the llm tab with fetched values', async () => {
    render(<SettingsPage />);

    expect(await screen.findByTestId('llm-tab')).toHaveTextContent('anthropic');
    expect(authGetMock).toHaveBeenCalledWith('/api/settings');
  });

  it('prevents saving when weights do not total 100', async () => {
    render(<SettingsPage />);

    await screen.findByTestId('llm-tab');
    fireEvent.click(screen.getByRole('button', { name: 'settings.tabs.weights' }));
    fireEvent.click(await screen.findByRole('button', { name: 'set-invalid-weight' }));
    fireEvent.click(screen.getByRole('button', { name: 'settings.save' }));

    expect(toastErrorMock).toHaveBeenCalledWith('settings.weights.totalMustEqualCurrent');
    expect(authPutMock).not.toHaveBeenCalled();
    expect(authPostMock).not.toHaveBeenCalled();
  });

  it('saves existing settings and updates chatbot state', async () => {
    authPutMock.mockResolvedValue({
      ok: true,
      json: async () => ({ id: 'settings-1' }),
    });

    render(<SettingsPage />);

    await screen.findByTestId('llm-tab');
    fireEvent.click(screen.getByRole('button', { name: 'disable-chatbot' }));
    fireEvent.click(screen.getByRole('button', { name: 'settings.save' }));

    await waitFor(() => {
      expect(authPutMock).toHaveBeenCalledWith(
        '/api/settings/settings-1',
        expect.objectContaining({
          chatbotEnabled: 'off',
          llmProvider: 'anthropic',
          llmModel: 'claude-sonnet-4-20250514',
        })
      );
    });
    expect(setChatbotEnabledMock).toHaveBeenCalledWith(false);
    expect(toastSuccessMock).toHaveBeenCalledWith('settings.saveSuccess');
  });

  it('reloads defaults after reset confirmation', async () => {
    render(<SettingsPage />);

    await screen.findByTestId('llm-tab');
    fireEvent.click(screen.getByRole('button', { name: 'settings.reset' }));

    await waitFor(() => {
      expect(authGetMock).toHaveBeenCalledWith('/api/settings/defaults');
    });
    expect(toastSuccessMock).toHaveBeenCalledWith('settings.resetSuccess');
  });
});

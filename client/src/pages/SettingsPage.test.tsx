import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

type SettingsHookValue = {
  settings: Record<string, unknown> | null;
  loading: boolean;
  saving: boolean;
  testingConnection: boolean;
  ollamaDiscoveryLoading: boolean;
  ollamaModelCatalog: unknown[];
  ollamaModelCapabilities: Record<string, unknown>;
  activeTab: string;
  setActiveTab: ReturnType<typeof vi.fn>;
  formData: Record<string, unknown>;
  tabs: Array<{ value: string; label: string; icon: () => null }>;
  totalWeight: number;
  handleSave: ReturnType<typeof vi.fn>;
  handleTestConnection: ReturnType<typeof vi.fn>;
  handleInputChange: ReturnType<typeof vi.fn>;
  resetToDefaults: ReturnType<typeof vi.fn>;
};

const hookState = vi.hoisted((): { value: SettingsHookValue } => ({
  value: {
    settings: {
      llmAvailability: {},
      llmModelCatalog: {},
      llmParameterDefinitions: {},
      promptGovernance: null,
      promptVersionState: null,
    },
    loading: false,
    saving: false,
    testingConnection: false,
    ollamaDiscoveryLoading: false,
    ollamaModelCatalog: [],
    ollamaModelCapabilities: {},
    activeTab: 'llm',
    setActiveTab: vi.fn(),
    formData: {},
    tabs: [
      { value: 'llm', label: 'LLM', icon: () => null },
      { value: 'credits', label: 'Credits', icon: () => null },
      { value: 'swagger', label: 'Swagger', icon: () => null },
    ],
    totalWeight: 100,
    handleSave: vi.fn(),
    handleTestConnection: vi.fn(),
    handleInputChange: vi.fn(),
    resetToDefaults: vi.fn(),
  },
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, fallback?: string) => fallback || key,
  }),
}));

const setSearchParamsMock = vi.fn();

vi.mock('react-router-dom', () => ({
  useSearchParams: () => [new URLSearchParams('tab=llm'), setSearchParamsMock],
}));

vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) => <div {...props}>{children}</div>,
  },
}));

vi.mock('./SettingsPage.hooks', () => ({
  useSettingsPage: () => hookState.value,
}));

vi.mock('../components/SettingsPage', () => ({
  LLMTab: () => <div>llm-tab</div>,
  PromptsTab: () => <div>prompts-tab</div>,
  WeightsTab: () => <div>weights-tab</div>,
  CreditsTab: () => <div>credits-tab</div>,
  ChatbotTab: () => <div>chatbot-tab</div>,
  GdprTab: () => <div>gdpr-tab</div>,
  DpoTab: () => <div>dpo-tab</div>,
}));

vi.mock('../components/SettingsPage/SettingsHeader', () => ({
  default: () => <div>settings-header</div>,
}));

vi.mock('../components/page/ResponsivePageTabs', () => ({
  default: ({ onChange }: { onChange: (tab: string) => void }) => (
    <div>
      <button onClick={() => onChange('llm')}>open-llm</button>
      <button onClick={() => onChange('swagger')}>open-swagger</button>
    </div>
  ),
}));

vi.mock('../components/SettingsPage/SettingsApiDocsPanel', () => ({
  default: () => <div>api-docs-panel</div>,
}));

vi.mock('../components/SettingsPage/SettingsActionsFooter', () => ({
  default: ({ onSave, onReset }: { onSave: () => void; onReset: () => void }) => (
    <div>
      <button onClick={onSave}>save-settings</button>
      <button onClick={onReset}>reset-settings</button>
    </div>
  ),
}));

import SettingsPage from './SettingsPage';

describe('SettingsPage', () => {
  beforeEach(() => {
    hookState.value = {
      settings: {
        llmAvailability: {},
        llmModelCatalog: {},
        llmParameterDefinitions: {},
        promptGovernance: null,
        promptVersionState: null,
      },
      loading: false,
      saving: false,
      testingConnection: false,
      ollamaDiscoveryLoading: false,
      ollamaModelCatalog: [],
      ollamaModelCapabilities: {},
      activeTab: 'llm',
      setActiveTab: vi.fn(),
      formData: {},
      tabs: [
        { value: 'llm', label: 'LLM', icon: () => null },
        { value: 'credits', label: 'Credits', icon: () => null },
        { value: 'swagger', label: 'Swagger', icon: () => null },
      ],
      totalWeight: 100,
      handleSave: vi.fn(),
      handleTestConnection: vi.fn(),
      handleInputChange: vi.fn(),
      resetToDefaults: vi.fn(),
    };
  });

  it('shows the loading state while settings are loading', () => {
    hookState.value = { ...hookState.value, loading: true };

    render(<SettingsPage />);

    expect(screen.getByText('settings.loading')).toBeInTheDocument();
  });

  it('shows the reload fallback when settings cannot be loaded', () => {
    const reloadSpy = vi.fn();
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: { reload: reloadSpy },
    });
    hookState.value = { ...hookState.value, settings: null };

    render(<SettingsPage />);

    fireEvent.click(screen.getByRole('button', { name: 'Reload page' }));
    expect(reloadSpy).toHaveBeenCalled();
  });

  it('renders the active settings tab and forwards actions', () => {
    render(<SettingsPage />);

    expect(screen.getByText('settings-header')).toBeInTheDocument();
    expect(screen.getByText('llm-tab')).toBeInTheDocument();

    fireEvent.click(screen.getByText('open-swagger'));
    fireEvent.click(screen.getByText('save-settings'));
    fireEvent.click(screen.getByText('reset-settings'));

    expect(setSearchParamsMock).toHaveBeenCalled();
    expect(hookState.value.handleSave).toHaveBeenCalled();
    expect(hookState.value.resetToDefaults).toHaveBeenCalled();
  });
});

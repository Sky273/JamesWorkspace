import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import NewTemplatePage from './NewTemplatePage';

const {
  navigateMock,
  createTemplateMock,
  updateTemplateMock,
  getTemplateByIdMock,
  useParamsMock,
  useAuthMock,
  markTemplatesViewDirtyMock,
} = vi.hoisted(() => ({
  navigateMock: vi.fn(),
  createTemplateMock: vi.fn(),
  updateTemplateMock: vi.fn(),
  getTemplateByIdMock: vi.fn(),
  useParamsMock: vi.fn(),
  useAuthMock: vi.fn(),
  markTemplatesViewDirtyMock: vi.fn(),
}));

vi.mock('react-router-dom', () => ({
  useNavigate: () => navigateMock,
  useParams: () => useParamsMock(),
}));

vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  },
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock('react-hot-toast', () => ({
  default: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock('../utils/logger.frontend', () => ({
  default: {
    error: vi.fn(),
    warn: vi.fn(),
  },
}));

vi.mock('../utils/viewRefreshScopes', () => ({
  markTemplatesViewDirty: (...args: unknown[]) => markTemplatesViewDirtyMock(...args),
}));

vi.mock('../utils/templateService', () => ({
  templateService: {
    createTemplate: (...args: unknown[]) => createTemplateMock(...args),
    updateTemplate: (...args: unknown[]) => updateTemplateMock(...args),
    getTemplateById: (...args: unknown[]) => getTemplateByIdMock(...args),
  },
}));

vi.mock('../context/AuthContext', () => ({
  useAuth: () => useAuthMock(),
}));

vi.mock('../components/AdminFirmSelector', () => ({
  default: () => null,
}));

describe('NewTemplatePage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useParamsMock.mockReturnValue({});
    useAuthMock.mockReturnValue({
      user: { firmId: 'firm-current', firm_id: 'firm-current', role: 'admin' },
      loading: false,
    });
    createTemplateMock.mockResolvedValue({
      id: 'tpl-new',
      Name: 'Nouveau modele',
      Status: 'active',
    });
  });

  it('redirects to administration templates tab after creating a template', async () => {
    render(<NewTemplatePage />);

    fireEvent.change(screen.getByLabelText('templates.editor.name.label'), {
      target: { value: 'Nouveau modele' },
    });
    fireEvent.change(screen.getByLabelText('templates.editor.statusField.label'), {
      target: { value: 'Active' },
    });
    fireEvent.change(screen.getByLabelText('templates.editor.description.label'), {
      target: { value: 'Description modele' },
    });

    fireEvent.change(screen.getByLabelText('templates.editor.content.label'), {
      target: { value: '<p>Contenu</p>' },
    });

    fireEvent.click(screen.getByRole('button', { name: 'common.save' }));

    await waitFor(() => {
      expect(createTemplateMock).toHaveBeenCalled();
    });

    expect(markTemplatesViewDirtyMock).toHaveBeenCalledTimes(1);

    expect(navigateMock).toHaveBeenCalledWith('/admin?tab=templates', {
      state: {
        createdTemplate: expect.objectContaining({ id: 'tpl-new' }),
      },
    });
  });

  it('assigns the current user firm to templates loaded from extraction', async () => {
    sessionStorage.setItem('extractedTemplate', JSON.stringify({
      name: 'Template extrait',
      description: 'Description extraite',
      headerContent: '<div>Header</div>',
      templateContent: '<p>Body</p>',
      footerContent: '<div>Footer</div>',
      stylesheet: 'body { color: #111; }',
      tags: ['cv'],
    }));

    render(<NewTemplatePage />);

    await waitFor(() => {
      expect(screen.getByLabelText('templates.editor.name.label')).toHaveValue('Template extrait');
    });

    fireEvent.click(screen.getByRole('button', { name: 'common.save' }));

    await waitFor(() => {
      expect(createTemplateMock).toHaveBeenCalledWith(expect.objectContaining({
        firm_id: 'firm-current',
        name: 'Template extrait',
      }));
    });

    expect(sessionStorage.getItem('extractedTemplate')).toBeNull();
  });

  it('preserves extracted HTML fragments in plain textareas instead of reparsing them', async () => {
    sessionStorage.setItem('extractedTemplate', JSON.stringify({
      name: 'Template extrait',
      description: 'Description extraite',
      headerContent: '<div class="template-region-header"><img src="data:image/png;base64,abc"></div>',
      templateContent: '<section class="template-region-body"><div>-content-</div></section>',
      footerContent: '<div class="template-region-footer">Footer</div>',
      stylesheet: '.template-region-header { color: red; }',
      tags: ['cv'],
    }));

    render(<NewTemplatePage />);

    await waitFor(() => {
      expect(screen.getByDisplayValue('<div class="template-region-header"><img src="data:image/png;base64,abc"></div>')).toBeInTheDocument();
    });

    expect(screen.getByDisplayValue('<section class="template-region-body"><div>-content-</div></section>')).toBeInTheDocument();
    expect(screen.getByDisplayValue('<div class="template-region-footer">Footer</div>')).toBeInTheDocument();
  });
});

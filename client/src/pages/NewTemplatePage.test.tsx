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

vi.mock('../components/TiptapEditor/DeferredTiptapEditor', () => ({
  default: ({
    content = '',
    onChange,
    placeholder,
  }: {
    content?: string;
    onChange?: (html: string) => void;
    placeholder?: string;
  }) => (
    <textarea
      aria-label={placeholder || 'tiptap-editor'}
      value={content}
      onChange={(event) => onChange?.(event.target.value)}
    />
  ),
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

    expect(createTemplateMock).toHaveBeenCalledWith(expect.objectContaining({
      firm_id: 'firm-current',
      templateContent: '<p>Contenu</p>',
    }));

    expect(markTemplatesViewDirtyMock).toHaveBeenCalledTimes(1);

    expect(navigateMock).toHaveBeenCalledWith('/admin?tab=templates', {
      state: {
        createdTemplate: expect.objectContaining({ id: 'tpl-new' }),
      },
    });
  });

  it('allows saving a template without a description', async () => {
    render(<NewTemplatePage />);

    const descriptionField = screen.getByLabelText('templates.editor.description.label');
    expect(descriptionField).not.toBeRequired();

    fireEvent.change(screen.getByLabelText('templates.editor.name.label'), {
      target: { value: 'Modele sans description' },
    });
    fireEvent.change(screen.getByLabelText('templates.editor.content.label'), {
      target: { value: '<main>Contenu</main>' },
    });

    fireEvent.click(screen.getByRole('button', { name: 'common.save' }));

    await waitFor(() => {
      expect(createTemplateMock).toHaveBeenCalledWith(expect.objectContaining({
        name: 'Modele sans description',
        description: '',
        templateContent: '<main>Contenu</main>',
      }));
    });
  });

  it('loads an existing template into the editor when editing', async () => {
    useParamsMock.mockReturnValue({ id: 'tpl-edit' });
    getTemplateByIdMock.mockResolvedValue({
      id: 'tpl-edit',
      Name: 'Modele charge',
      Description: 'Description chargee',
      HeaderContent: '<html><body><header><div>Entete</div></header></body></html>',
      TemplateContent: '<main><p>Corps</p></main>',
      FooterContent: '<html><body><footer><div>Pied</div></footer></body></html>',
      FooterHeight: 42,
      Stylesheet: '<style>body { color: red; }</style>',
      Status: 'active',
      Popular: true,
      Tags: ['demo'],
      FirmId: 'firm-edit',
    });

    render(<NewTemplatePage />);

    await waitFor(() => {
      expect(getTemplateByIdMock).toHaveBeenCalledWith('tpl-edit');
    });

    expect(screen.getByDisplayValue('Modele charge')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Description chargee')).toBeInTheDocument();
    expect(screen.getByLabelText('templates.editor.content.label')).toHaveValue('<main><p>Corps</p></main>');
    expect(screen.getByDisplayValue('<header><div>Entete</div></header>')).toBeInTheDocument();
    expect(screen.getByDisplayValue('<footer><div>Pied</div></footer>')).toBeInTheDocument();
    expect(screen.getByDisplayValue('body { color: red; }')).toBeInTheDocument();
    expect(screen.getByDisplayValue('42')).toBeInTheDocument();
  });

});

import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import EmailTemplatesPage from './EmailTemplatesPage';

const useAuthMock = vi.fn();
const getTemplatesMock = vi.fn();
const getKeywordsMock = vi.fn();

vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  },
}));

vi.mock('react-hot-toast', () => ({
  default: {
    error: vi.fn(),
    success: vi.fn(),
  },
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock('../../context/AuthContext', () => ({
  useAuth: () => useAuthMock(),
}));

vi.mock('../../services/emailTemplateService', () => ({
  default: {
    getTemplates: (...args: unknown[]) => getTemplatesMock(...args),
    getKeywords: (...args: unknown[]) => getKeywordsMock(...args),
    getTemplate: vi.fn(),
    previewTemplate: vi.fn(),
    duplicateTemplate: vi.fn(),
    deleteTemplate: vi.fn(),
    createTemplate: vi.fn(),
    updateTemplate: vi.fn(),
    compileMjml: vi.fn(),
  },
}));

vi.mock('../../utils/userService', () => ({
  default: {
    getCustomersPaginated: vi.fn(),
  },
}));

vi.mock('../../components/EmailTemplates', () => ({
  EmailTemplateEditor: () => null,
  EmailTemplatePreview: () => null,
}));

describe('EmailTemplatesPage', () => {
  beforeEach(() => {
    useAuthMock.mockReturnValue({ user: { role: 'admin' } });
    getKeywordsMock.mockResolvedValue(null);
    getTemplatesMock.mockResolvedValue(
      Array.from({ length: 10 }).map((_, index) => ({
        id: `tpl-${index + 1}`,
        name: `Template ${index + 1}`,
        description: `Description ${index + 1}`,
        subject_template: `Sujet ${index + 1}`,
        firm_name: 'Cabinet Alpha',
        is_system: false,
        is_default: index === 0,
      })),
    );
  });

  it('shows pagination when templates exceed a page', async () => {
    render(<EmailTemplatesPage embedded />);

    await waitFor(() => {
      expect(screen.getByText('Template 1')).toBeInTheDocument();
    });

    expect(screen.getAllByText(/common\.page 1 \/ 2/i)).toHaveLength(2);
    expect(screen.queryByText('Template 10')).not.toBeInTheDocument();
  });
});

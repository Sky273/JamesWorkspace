import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  authPutMock,
  fetchWithAuthMock,
} = vi.hoisted(() => ({
  authPutMock: vi.fn(),
  fetchWithAuthMock: vi.fn(),
}));

vi.mock('./apiInterceptor', () => ({
  authDelete: vi.fn(),
  authPost: vi.fn(),
  authPut: (...args: unknown[]) => authPutMock(...args),
  createAuthOptions: vi.fn((options = {}) => options),
  fetchWithAuth: (...args: unknown[]) => fetchWithAuthMock(...args),
}));

vi.mock('./logger.frontend', () => ({
  default: {
    error: vi.fn(),
  },
}));

import { templateService } from './templateService';

describe('templateService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authPutMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        id: 'tpl-1',
        Name: 'Template',
        TemplateContent: '<main>Body</main>',
        Status: 'active',
      }),
    });
    fetchWithAuthMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        id: 'tpl-1',
        Name: 'Template',
        TemplateContent: '<main>Body</main>',
        Status: 'active',
      }),
    });
  });

  it('preserves raw HTML and CSS whitespace when updating a template', async () => {
    const rawHeader = '\n<header>  -name-  </header>\n';
    const rawBody = '\n<main>\n  -content-\n</main>\n';
    const rawFooter = '\n<footer> Page </footer>\n';
    const rawStylesheet = '\n<style>\n  .page { margin: 0; }\n</style>\n';

    await templateService.updateTemplate('tpl-1', {
      name: 'Template',
      headerContent: rawHeader,
      templateContent: rawBody,
      footerContent: rawFooter,
      stylesheet: rawStylesheet,
    });

    expect(authPutMock).toHaveBeenCalledWith('/api/templates/tpl-1', expect.objectContaining({
      HeaderContent: rawHeader,
      TemplateContent: rawBody,
      FooterContent: rawFooter,
      Stylesheet: rawStylesheet,
    }));
  });

  it('adds refresh=1 when fetching a template detail with forceRefresh', async () => {
    await templateService.getTemplateById('tpl-1', { forceRefresh: true });

    expect(fetchWithAuthMock).toHaveBeenCalledWith('/api/templates/tpl-1?refresh=1', expect.anything());
  });
});

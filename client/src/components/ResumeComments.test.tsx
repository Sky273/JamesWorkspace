import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import ResumeComments from './ResumeComments';

const fetchWithAuthMock = vi.fn();
const fetchWithCsrfRetryMock = vi.fn();
const createAuthOptionsWithCsrfMock = vi.fn();

vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({
    user: {
      id: 'user-1',
      role: 'user',
    },
  }),
}));

vi.mock('../utils/apiInterceptor', () => ({
  fetchWithAuth: (...args: unknown[]) => fetchWithAuthMock(...args),
  fetchWithCsrfRetry: (...args: unknown[]) => fetchWithCsrfRetryMock(...args),
  createAuthOptionsWithCsrf: (...args: unknown[]) => createAuthOptionsWithCsrfMock(...args),
}));

describe('ResumeComments', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    fetchWithAuthMock.mockResolvedValue({
      json: async () => ({
        success: true,
        comments: [],
      }),
    });

    createAuthOptionsWithCsrfMock.mockResolvedValue({
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-Token': 'csrf-token',
      },
    });

    fetchWithCsrfRetryMock.mockResolvedValue({
      json: async () => ({
        success: true,
        comment: {
          id: 'comment-1',
          resume_id: 'resume-123',
          user_id: 'user-1',
          user_name: 'Alice',
          content: 'Nouveau commentaire',
          is_private: false,
          created_at: '2026-04-14T10:00:00.000Z',
          updated_at: '2026-04-14T10:00:00.000Z',
        },
      }),
    });
  });

  it('uses the CSRF retry helper when posting a comment', async () => {
    render(<ResumeComments resumeId="resume-123" />);

    await waitFor(() => {
      expect(fetchWithAuthMock).toHaveBeenCalledWith('/api/resumes/resume-123/comments');
    });

    fireEvent.change(screen.getByPlaceholderText('comments.placeholder'), {
      target: { value: 'Nouveau commentaire' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'comments.post' }));

    await waitFor(() => {
      expect(createAuthOptionsWithCsrfMock).toHaveBeenCalled();
      expect(fetchWithCsrfRetryMock).toHaveBeenCalledWith(
        '/api/resumes/resume-123/comments',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({
            content: 'Nouveau commentaire',
            isPrivate: false,
          }),
        })
      );
    });

    expect(
      fetchWithAuthMock.mock.calls.some(
        ([url, options]) =>
          url === '/api/resumes/resume-123/comments' &&
          typeof options === 'object' &&
          options !== null &&
          'method' in (options as Record<string, unknown>) &&
          (options as Record<string, unknown>).method === 'POST'
      )
    ).toBe(false);
  });
});

import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import OriginalSourcePreview from './OriginalSourcePreview';

describe('OriginalSourcePreview', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('<html><body>preview</body></html>', { status: 200 }))
    );
  });

  it('renders preview and download endpoints from the resume id', () => {
    render(
      <OriginalSourcePreview
        resume={{
          id: 'resume-123',
          'File Name': 'candidate.pdf',
          'Resume File': [
            {
              filename: 'candidate.pdf',
              type: 'application/pdf',
              url: '/api/resumes/resume-123/download',
            },
          ],
        }}
      />
    );

    expect(screen.getByText('candidate.pdf')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Télécharger l’original/i })).toHaveAttribute(
      'href',
      '/api/resumes/resume-123/download'
    );
    expect(screen.getByTitle('Prévisualisation du document source candidate.pdf')).toHaveAttribute(
      'src',
      '/api/resumes/resume-123/preview'
    );
  });
});

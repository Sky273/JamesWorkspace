import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { useState } from 'react';
import ExtractTemplateModal from './ExtractTemplateModal';

const navigateMock = vi.fn();
const toastSuccessMock = vi.fn();
const toastErrorMock = vi.fn();
const extractFromCVMock = vi.fn();

vi.mock('react-router-dom', () => ({
  useNavigate: () => navigateMock,
}));

vi.mock('react-hot-toast', () => ({
  default: {
    success: (...args: unknown[]) => toastSuccessMock(...args),
    error: (...args: unknown[]) => toastErrorMock(...args),
  },
}));

vi.mock('react-dropzone', () => ({
  useDropzone: ({ onDrop }: { onDrop: (files: File[]) => void }) => ({
    getRootProps: () => ({
      onClick: () => onDrop([new File(['content'], 'template.pdf', { type: 'application/pdf' })]),
    }),
    getInputProps: () => ({}),
    isDragActive: false,
  }),
}));

vi.mock('../utils/templateService', () => ({
  templateService: {
    extractFromCV: (...args: unknown[]) => extractFromCVMock(...args),
  },
}));

vi.mock('./TemplatePreviewFrame', () => ({
  default: () => <div data-testid="template-preview-frame" />,
}));

describe('ExtractTemplateModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.sessionStorage.clear();
    extractFromCVMock.mockResolvedValue({
      success: true,
      model: 'gpt-test',
      extractionMethod: 'pdf-vision',
      template: {
        name: 'Modele CV',
        description: 'Description',
        headerContent: '<div>Header</div>',
        templateContent: '<div>Body</div>',
        footerContent: '<div>Footer</div>',
        stylesheet: '',
        footerHeight: 25,
        tags: ['cv'],
      },
    });
  });

  it('resets transient state when the modal is closed externally and reopened', async () => {
    const Wrapper = (): JSX.Element => {
      const [open, setOpen] = useState(true);
      return (
        <>
          <button type="button" onClick={() => setOpen(false)}>close-modal</button>
          <button type="button" onClick={() => setOpen(true)}>open-modal</button>
          <ExtractTemplateModal isOpen={open} onClose={() => setOpen(false)} />
        </>
      );
    };

    render(<Wrapper />);

    fireEvent.click(screen.getByText('templates.extract.dragDrop'));
    fireEvent.click(screen.getByRole('button', { name: 'templates.extract.extractButton' }));

    await waitFor(() => {
      expect(screen.getByText('Modele CV')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'close-modal' }));
    fireEvent.click(screen.getByRole('button', { name: 'open-modal' }));

    expect(screen.queryByText('Modele CV')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'templates.extract.createTemplate' })).not.toBeInTheDocument();
  });

  it('preserves session storage when creating a template', async () => {
    const onClose = vi.fn();
    render(<ExtractTemplateModal isOpen={true} onClose={onClose} />);

    fireEvent.click(screen.getByText('templates.extract.dragDrop'));
    fireEvent.click(screen.getByRole('button', { name: 'templates.extract.extractButton' }));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'templates.extract.createTemplate' })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'templates.extract.createTemplate' }));

    expect(window.sessionStorage.getItem('extractedTemplate')).toContain('Modele CV');
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(navigateMock).toHaveBeenCalledWith('/templates/new?fromExtraction=true');
  });
});

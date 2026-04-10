import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import ExtractTemplateModal from './ExtractTemplateModal';

const mockNavigate = vi.fn();
const mockToastError = vi.fn();
const mockToastSuccess = vi.fn();
const mockExtractFromCV = vi.fn();

let capturedOnDrop: ((files: File[]) => void) | null = null;

vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
}));

vi.mock('react-dropzone', () => ({
  useDropzone: ({ onDrop }: { onDrop: (files: File[]) => void }) => {
    capturedOnDrop = onDrop;
    return {
      getRootProps: () => ({ onClick: vi.fn() }),
      getInputProps: () => ({}),
      isDragActive: false,
    };
  },
}));

vi.mock('react-hot-toast', () => ({
  default: {
    error: (...args: unknown[]) => mockToastError(...args),
    success: (...args: unknown[]) => mockToastSuccess(...args),
  },
}));

vi.mock('../utils/templateService', () => ({
  templateService: {
    extractFromCV: (...args: unknown[]) => mockExtractFromCV(...args),
  },
}));

vi.mock('./TemplatePreviewFrame', () => ({
  default: ({ title }: { title: string }) => <div>preview-frame:{title}</div>,
}));

vi.mock('../utils/logger.frontend', () => ({
  default: {
    error: vi.fn(),
  },
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, fallback?: string) => {
      const map: Record<string, string> = {
        'templates.extract.title': 'Extraction de template',
        'templates.extract.subtitle': 'Sous-titre extraction',
        'templates.extract.dragDrop': 'Dépose le fichier',
        'templates.extract.supportedFormats': 'PDF ou DOCX',
        'templates.extract.clickToChange': 'Cliquer pour changer',
        'templates.extract.extractButton': 'Extraire',
        'templates.extract.success': 'Extraction réussie',
        'templates.extract.error': 'Erreur extraction',
        'templates.extract.extractionComplete': 'Extraction terminée',
        'templates.extract.preview': 'Aperçu',
        'templates.extract.reviewNote': 'Relis avant création',
        'templates.extract.createTemplate': 'Créer le template',
        'templates.extract.errorTitle': 'Extraction impossible',
        'templates.extract.tryAgain': 'Réessayer',
        'templates.editor.name.label': 'Nom',
        'templates.editor.description.label': 'Description',
        'common.cancel': 'Annuler',
        'common.close': 'Fermer',
      };
      return map[key] ?? fallback ?? key;
    },
  }),
}));

describe('ExtractTemplateModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    capturedOnDrop = null;
    sessionStorage.clear();
  });

  it('extrait un template puis navigue vers la création', async () => {
    mockExtractFromCV.mockResolvedValue({
      success: true,
      model: 'gpt-test',
      extractionMethod: 'docx-html',
      template: {
        name: 'Template CV',
        description: 'Description template',
        tags: ['cv', 'moderne'],
        stylesheet: '.page { color: black; }',
        headerContent: '<div>Header</div>',
        templateContent: '<div>Body</div>',
        footerContent: '<div>Footer</div>',
        extractedColors: ['#000000'],
        extractedFonts: ['Inter'],
      },
    });

    render(<ExtractTemplateModal isOpen={true} onClose={vi.fn()} />);

    const file = new File(['docx'], 'modele.docx', {
      type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    });
    await act(async () => {
      capturedOnDrop?.([file]);
    });

    expect(await screen.findByText('modele.docx')).toBeInTheDocument();

    fireEvent.click(screen.getByText('Extraire'));

    expect(await screen.findByText('Extraction terminée')).toBeInTheDocument();
    expect(screen.getByText('Template CV')).toBeInTheDocument();
    expect(await screen.findByText('preview-frame:Template CV')).toBeInTheDocument();
    expect(mockToastSuccess).toHaveBeenCalledWith('Extraction réussie');

    fireEvent.click(screen.getByText('Créer le template'));

    expect(JSON.parse(sessionStorage.getItem('extractedTemplate') || '{}')).toMatchObject({
      name: 'Template CV',
    });
    expect(mockNavigate).toHaveBeenCalledWith('/templates/new?fromExtraction=true');
  });

  it('affiche une erreur d’extraction et permet de revenir à l’upload', async () => {
    mockExtractFromCV.mockRejectedValue(new Error('Extraction KO'));

    render(<ExtractTemplateModal isOpen={true} onClose={vi.fn()} />);

    const file = new File(['pdf'], 'modele.pdf', { type: 'application/pdf' });
    await act(async () => {
      capturedOnDrop?.([file]);
    });

    fireEvent.click(await screen.findByText('Extraire'));

    expect(await screen.findByText('Extraction impossible')).toBeInTheDocument();
    expect(screen.getByText('Extraction KO')).toBeInTheDocument();
    expect(mockToastError).toHaveBeenCalledWith('Erreur extraction');

    fireEvent.click(screen.getByText('Réessayer'));

    await waitFor(() => {
      expect(screen.getByText('modele.pdf')).toBeInTheDocument();
      expect(screen.getByText('Extraire')).toBeInTheDocument();
    });
  });
  it('resets the modal state and clears extractedTemplate from sessionStorage on close', async () => {
    const onClose = vi.fn();
    sessionStorage.setItem('extractedTemplate', JSON.stringify({ name: 'old' }));

    render(<ExtractTemplateModal isOpen={true} onClose={onClose} />);

    const file = new File(['docx'], 'modele.docx', {
      type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    });
    await act(async () => {
      capturedOnDrop?.([file]);
    });

    expect(await screen.findByText('modele.docx')).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText('Fermer'));

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(sessionStorage.getItem('extractedTemplate')).toBeNull();
  });
});

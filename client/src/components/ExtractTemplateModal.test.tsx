import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import ExtractTemplateModal from './ExtractTemplateModal';

const mockNavigate = vi.fn();
const mockToastError = vi.fn();
const mockToastSuccess = vi.fn();
const mockExtractFromCV = vi.fn();
const mockMarkTemplatesViewDirty = vi.fn();

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

vi.mock('../utils/viewRefreshScopes', () => ({
  markTemplatesViewDirty: (...args: unknown[]) => mockMarkTemplatesViewDirty(...args),
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
        'templates.extract.dragDrop': 'Depose le fichier',
        'templates.extract.supportedFormats': 'PDF ou DOCX',
        'templates.extract.clickToChange': 'Cliquer pour changer',
        'templates.extract.extractButton': 'Extraire',
        'templates.extract.success': 'Extraction reussie',
        'templates.extract.error': 'Erreur extraction',
        'templates.extract.extractionComplete': 'Extraction terminee',
        'templates.extract.preview': 'Apercu',
        'templates.extract.reviewNote': 'Relis avant creation',
        'templates.extract.createTemplate': 'Creer le template',
        'templates.extract.errorTitle': 'Extraction impossible',
        'templates.extract.tryAgain': 'Reessayer',
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

  it('extracts a template, allows manual correction, then navigates to creation', async () => {
    mockExtractFromCV.mockResolvedValue({
      success: true,
      model: 'gpt-test',
      extractionMethod: 'office-pdf-layout-html',
      template: {
        name: 'Template CV',
        description: 'Description template',
        tags: ['cv', 'moderne'],
        stylesheet: '.page { color: black; }',
        headerContent: '<div>Header final</div>',
        templateContent: '<div>Body</div>',
        footerContent: '<div>Footer</div>',
        extractedColors: ['#336699'],
        extractedFonts: ['Inter'],
        extractionConfidence: {
          score: 0.84,
          level: 'high',
        },
        extractionReview: {
          extractionMethod: 'office-pdf-layout-html',
          textLength: 320,
          imageCount: 1,
          layoutMetrics: {
            totalLines: 12,
            visualBlockCount: 2,
            imageBlockCount: 1,
          },
          headerHtml: '<div>Header fragment</div>',
          contentHtml: '<div>Content fragment</div>',
          footerHtml: '<div>Footer fragment</div>',
          visualBlocks: [{ type: 'fill-rect', left: 0, top: 0, width: 100, height: 40, region: 'header' }],
          imageRegions: [{ left: 300, top: 20, width: 80, height: 80, region: 'header' }],
        },
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

    expect(await screen.findByText('Extraction terminee')).toBeInTheDocument();
    expect(await screen.findByText('preview-frame:Template CV')).toBeInTheDocument();
    expect(screen.getByText(/Confiance élevée 84%/)).toBeInTheDocument();
    expect(screen.getByText("Fragments détectés")).toBeInTheDocument();
    expect(screen.getByText('Blocs visuels')).toBeInTheDocument();
    expect(mockToastSuccess).toHaveBeenCalledWith('Extraction reussie');
    expect(mockMarkTemplatesViewDirty).toHaveBeenCalledTimes(1);

    fireEvent.change(screen.getByLabelText('Contenu final'), {
      target: { value: '<div>Body corrected</div>' },
    });
    fireEvent.click(screen.getByText('Utiliser le header détecté'));
    fireEvent.click(screen.getByText('Creer le template'));

    expect(JSON.parse(sessionStorage.getItem('extractedTemplate') || '{}')).toMatchObject({
      name: 'Template CV',
      headerContent: '<div>Header fragment</div>',
      templateContent: '<div>Body corrected</div>',
    });
    expect(mockMarkTemplatesViewDirty).toHaveBeenCalledTimes(2);
    expect(mockNavigate).toHaveBeenCalledWith('/admin/templates/new?fromExtraction=true');
  });

  it('shows extraction error and allows returning to upload', async () => {
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

    fireEvent.click(screen.getByText('Reessayer'));

    await waitFor(() => {
      expect(screen.getByText('modele.pdf')).toBeInTheDocument();
      expect(screen.getByText('Extraire')).toBeInTheDocument();
    });
  });

  it('resets state and clears extractedTemplate from sessionStorage on close', async () => {
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

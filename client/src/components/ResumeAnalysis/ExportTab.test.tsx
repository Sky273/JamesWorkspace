import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import ExportTab from './ExportTab';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, fallback?: string) => fallback ?? key,
  }),
}));

vi.mock('../../utils/sanitizer.frontend', () => ({
  createSafeHtml: (html: string) => ({ __html: html }),
}));

describe('ExportTab', () => {
  it('updates template and format, and enables email send when a template is selected', () => {
    const onTemplateChange = vi.fn();
    const onFormatChange = vi.fn();
    const onExport = vi.fn();
    const onSendEmail = vi.fn();

    render(
      <ExportTab
        resume={{ 'Improved Text': '<p>Texte amélioré</p>' }}
        templates={[{ id: 'tpl-1', Name: 'Template A' }]}
        selectedTemplate="tpl-1"
        onTemplateChange={onTemplateChange}
        loadingTemplates={false}
        exportLoading={false}
        onExport={onExport}
        onSendEmail={onSendEmail}
        selectedFormat="pdf"
        onFormatChange={onFormatChange}
      />
    );

    fireEvent.change(screen.getByLabelText('resume.analysis.exportOptions.template'), {
      target: { value: 'tpl-1' },
    });
    fireEvent.change(screen.getByLabelText('Format'), {
      target: { value: 'docx' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Exporter' }));
    fireEvent.click(screen.getByRole('button', { name: 'resume.analysis.exportOptions.sendEmail' }));

    expect(onTemplateChange).toHaveBeenCalledWith('tpl-1');
    expect(onFormatChange).toHaveBeenCalledWith('docx');
    expect(onExport).toHaveBeenCalledTimes(1);
    expect(onSendEmail).toHaveBeenCalledTimes(1);
    expect(screen.getByText('Texte amélioré')).toBeInTheDocument();
  });

  it('disables export actions when no template is selected', () => {
    render(
      <ExportTab
        resume={{ 'Original Text': 'Texte original' }}
        templates={[]}
        selectedTemplate=""
        onTemplateChange={vi.fn()}
        loadingTemplates={false}
        exportLoading={false}
        onExport={vi.fn()}
        onSendEmail={vi.fn()}
      />
    );

    expect(screen.getByRole('button', { name: 'Exporter' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'resume.analysis.exportOptions.sendEmail' })).toBeDisabled();
  });

  it('shows loading states for templates and export progress', () => {
    render(
      <ExportTab
        resume={{ 'Original Text': 'Texte original' }}
        templates={[]}
        selectedTemplate="tpl-1"
        onTemplateChange={vi.fn()}
        loadingTemplates={true}
        exportLoading={true}
        onExport={vi.fn()}
      />
    );

    expect(screen.getByText('resume.analysis.exportOptions.loadingTemplates')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'resume.analysis.exportOptions.exporting' })).toBeDisabled();
  });
});

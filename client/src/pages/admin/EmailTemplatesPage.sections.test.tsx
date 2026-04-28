import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import {
  EmailTemplatesDuplicateModal,
  EmailTemplatesEditModal,
  EmailTemplatesHeader,
  EmailTemplatesList,
  EmailTemplatesPreviewModal,
} from './EmailTemplatesPage.sections';

vi.mock('../../components/EmailTemplates', () => ({
  EmailTemplateEditor: ({
    initialMjml,
    subjectTemplate,
    onSubjectChange,
    onMjmlChange,
  }: {
    initialMjml: string;
    subjectTemplate: string;
    onSubjectChange: (value: string) => void;
    onMjmlChange: (value: string) => void;
  }) => (
    <div>
      <div>editor-mjml:{initialMjml}</div>
      <div>editor-subject:{subjectTemplate}</div>
      <button onClick={() => onSubjectChange('Sujet mis à jour')}>change-subject</button>
      <button onClick={() => onMjmlChange('<mjml>updated</mjml>')}>change-mjml</button>
    </div>
  ),
  EmailTemplatePreview: ({
    html,
    subject,
    loading,
  }: {
    html: string;
    subject: string;
    loading: boolean;
  }) => <div>{loading ? 'preview-loading' : `preview:${subject}:${html}`}</div>,
}));

const template = {
  id: 'tpl-1',
  name: 'Relance client',
  description: 'Description relance',
  subject_template: 'Sujet relance',
  firm_name: 'Cabinet Alpha',
  is_system: false,
  is_default: true,
} as const;

describe('EmailTemplatesPage sections', () => {
  it('affiche le header avec les statistiques et le bouton de création', () => {
    const onCreate = vi.fn();
    const onRefresh = vi.fn();

    render(
      <EmailTemplatesHeader
        createLabel="Créer"
        defaultTemplatesCount={2}
        onCreate={onCreate}
        onRefresh={onRefresh}
        systemTemplatesCount={1}
        totalTemplates={5}
        introLabel="Intro"
        hintLabel="Astuce"
        totalLabel="Total"
        defaultLabel="Défaut"
        systemLabel="Système"
      />
    );

    expect(screen.getByText('5')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
    expect(screen.getByText('1')).toBeInTheDocument();

    fireEvent.click(screen.getByText('Créer'));
    expect(onCreate).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole('button', { name: /actualiser/i }));
    expect(onRefresh).toHaveBeenCalledTimes(1);
  });

  it('affiche la liste et déclenche les actions sur un template', () => {
    const onPreview = vi.fn();
    const onEdit = vi.fn();
    const onDuplicate = vi.fn();
    const onDelete = vi.fn();

    render(
      <EmailTemplatesList
        canDuplicate={true}
        firmLabel="Cabinet"
        globalFirmLabel="Global"
        templates={[template as never]}
        loading={false}
        noTemplatesLabel="Aucun template"
        systemTemplateLabel="Système"
        defaultTemplateLabel="Défaut"
        subjectLabel="Sujet"
        previewLabel="Aperçu"
        editLabel="Modifier"
        duplicateLabel="Dupliquer"
        deleteLabel="Supprimer"
        onPreview={onPreview}
        onEdit={onEdit}
        onDuplicate={onDuplicate}
        onDelete={onDelete}
      />
    );

    expect(screen.getByText('Relance client')).toBeInTheDocument();
    expect(screen.getByText('Description relance')).toBeInTheDocument();
    expect(screen.getByText('Cabinet: Cabinet Alpha')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Aperçu' }));
    fireEvent.click(screen.getByRole('button', { name: 'Modifier' }));
    fireEvent.click(screen.getByRole('button', { name: 'Dupliquer' }));
    fireEvent.click(screen.getByRole('button', { name: 'Supprimer' }));

    expect(onPreview).toHaveBeenCalledWith(template);
    expect(onEdit).toHaveBeenCalledWith(template);
    expect(onDuplicate).toHaveBeenCalledWith(template);
    expect(onDelete).toHaveBeenCalledWith(template);
  });

  it('masque l’action de duplication quand elle n’est pas autorisée', () => {
    render(
      <EmailTemplatesList
        canDuplicate={false}
        firmLabel="Cabinet"
        globalFirmLabel="Global"
        templates={[template as never]}
        loading={false}
        noTemplatesLabel="Aucun template"
        systemTemplateLabel="Système"
        defaultTemplateLabel="Défaut"
        subjectLabel="Sujet"
        previewLabel="Aperçu"
        editLabel="Modifier"
        duplicateLabel="Dupliquer"
        deleteLabel="Supprimer"
        onPreview={vi.fn()}
        onEdit={vi.fn()}
        onDuplicate={vi.fn()}
        onDelete={vi.fn()}
      />
    );

    expect(screen.queryByRole('button', { name: 'Dupliquer' })).not.toBeInTheDocument();
  });

  it('affiche le badge global quand aucun cabinet n’est défini', () => {
    render(
      <EmailTemplatesList
        canDuplicate={false}
        firmLabel="Cabinet"
        globalFirmLabel="Global"
        templates={[{ ...template, id: 'tpl-2', firm_name: undefined } as never]}
        loading={false}
        noTemplatesLabel="Aucun template"
        systemTemplateLabel="Système"
        defaultTemplateLabel="Défaut"
        subjectLabel="Sujet"
        previewLabel="Aperçu"
        editLabel="Modifier"
        duplicateLabel="Dupliquer"
        deleteLabel="Supprimer"
        onPreview={vi.fn()}
        onEdit={vi.fn()}
        onDuplicate={vi.fn()}
        onDelete={vi.fn()}
      />
    );

    expect(screen.getByText('Cabinet: Global')).toBeInTheDocument();
  });

  it('affiche la modal de duplication avec la liste des cabinets', () => {
    const onClose = vi.fn();
    const onConfirm = vi.fn();
    const onFirmChange = vi.fn();
    const t = (key: string, options?: Record<string, unknown>) => {
      const map: Record<string, string> = {
        'emailTemplates.duplicateTitle': 'Dupliquer le template',
        'emailTemplates.duplicateMessage': `Copier ${options?.name ?? ''}`,
        'emailTemplates.targetFirmLabel': 'Cabinet cible',
        'emailTemplates.selectTargetFirm': 'Choisir un cabinet',
        'emailTemplates.duplicate': 'Dupliquer',
        'common.cancel': 'Annuler',
        'common.saving': 'Enregistrement',
      };
      return map[key] ?? key;
    };

    render(
      <EmailTemplatesDuplicateModal
        firms={[{ id: 'firm-2', name: 'Cabinet B' }]}
        isOpen
        isSubmitting={false}
        onClose={onClose}
        onConfirm={onConfirm}
        onFirmChange={onFirmChange}
        selectedFirmId=""
        template={template as never}
        t={t}
      />
    );

    expect(screen.getByText('Dupliquer le template')).toBeInTheDocument();
    expect(screen.getByText('Dupliquer le template').closest('.fixed')).toHaveClass('z-[10000]', 'isolate');
    fireEvent.change(screen.getByDisplayValue('Choisir un cabinet'), { target: { value: 'firm-2' } });
    expect(onFirmChange).toHaveBeenCalledWith('firm-2');
    fireEvent.click(screen.getByText('Annuler'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('gère la modal d’édition avec preview et sauvegarde', () => {
    const onClose = vi.fn();
    const onPreview = vi.fn();
    const onSave = vi.fn();
    const onChange = vi.fn();
    const t = (key: string) => {
      const map: Record<string, string> = {
        'emailTemplates.createNew': 'Créer un template',
        'emailTemplates.editTemplate': 'Éditer le template',
        'emailTemplates.headerIntro': 'Intro édition',
        'emailTemplates.subjectLabel': 'Sujet',
        'emailTemplates.nameLabel': 'Nom',
        'emailTemplates.namePlaceholder': 'Nom placeholder',
        'emailTemplates.descriptionLabel': 'Description',
        'emailTemplates.descriptionPlaceholder': 'Description placeholder',
        'emailTemplates.setAsDefault': 'Définir par défaut',
        'emailTemplates.preview': 'Aperçu',
        'emailTemplates.refreshPreview': 'Rafraîchir',
        'common.cancel': 'Annuler',
        'common.save': 'Enregistrer',
        'common.saving': 'Enregistrement',
      };
      return map[key] ?? key;
    };

    render(
      <EmailTemplatesEditModal
        mode="edit"
        form={{
          name: 'Template A',
          description: 'Desc',
          subject: 'Sujet A',
          mjml: '<mjml>A</mjml>',
          isDefault: false,
        }}
        keywords={null}
        previewHtml="<p>preview</p>"
        previewSubject="Sujet aperçu"
        previewLoading={false}
        saving={false}
        onClose={onClose}
        onPreview={onPreview}
        onSave={onSave}
        onChange={onChange}
        t={t}
      />
    );

    fireEvent.change(screen.getByDisplayValue('Template A'), { target: { value: 'Template B' } });
    fireEvent.change(screen.getByDisplayValue('Desc'), { target: { value: 'Nouvelle description' } });
    fireEvent.click(screen.getByLabelText('Définir par défaut'));
    fireEvent.click(screen.getByText('change-subject'));
    fireEvent.click(screen.getByText('change-mjml'));
    fireEvent.click(screen.getByText('Rafraîchir'));
    fireEvent.click(screen.getByText('Enregistrer'));

    expect(onChange).toHaveBeenCalledWith('name', 'Template B');
    expect(onChange).toHaveBeenCalledWith('description', 'Nouvelle description');
    expect(onChange).toHaveBeenCalledWith('isDefault', true);
    expect(onChange).toHaveBeenCalledWith('subject', 'Sujet mis à jour');
    expect(onChange).toHaveBeenCalledWith('mjml', '<mjml>updated</mjml>');
    expect(onPreview).toHaveBeenCalledTimes(1);
    expect(onSave).toHaveBeenCalledTimes(1);
    expect(screen.getByText('Intro édition').closest('.fixed')).toHaveClass('z-[10000]', 'isolate');
    expect(screen.getByText('preview:Sujet aperçu:<p>preview</p>')).toBeInTheDocument();

    fireEvent.click(screen.getByText('Annuler'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('affiche la modal de preview', () => {
    const onClose = vi.fn();

    render(
      <EmailTemplatesPreviewModal
        template={template as never}
        previewHtml="<p>mail</p>"
        previewSubject="Sujet aperçu"
        previewLoading={false}
        onClose={onClose}
      />
    );

    expect(screen.getByText('Relance client')).toBeInTheDocument();
    expect(screen.getByText('Relance client').closest('.fixed')).toHaveClass('z-[10000]', 'isolate');
    expect(screen.getByText('preview:Sujet aperçu:<p>mail</p>')).toBeInTheDocument();

    fireEvent.click(screen.getAllByRole('button')[0]);
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

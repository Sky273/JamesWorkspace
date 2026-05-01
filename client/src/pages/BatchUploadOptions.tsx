/**
 * BatchUploadOptions - Processing options form for batch upload
 * Extracted from BatchUploadPage.tsx
 */

import { useTranslation } from 'react-i18next';
import {
  XMarkIcon,
  SparklesIcon,
  ArrowDownTrayIcon
} from '@heroicons/react/24/outline';
import AdminFirmSelector from '../components/AdminFirmSelector';
import Switch from '../components/ui/Switch';
import type { Template } from '../utils/templateService';
import type { ExportFormats } from './batchUpload.utils';

interface BatchUploadOptionsProps {
  improveOption: boolean;
  setImproveOption: (v: boolean) => void;
  exportOption: boolean;
  setExportOption: (v: boolean) => void;
  deleteAfterExport: boolean;
  setDeleteAfterExport: (v: boolean) => void;
  templates: Template[];
  selectedTemplate: string;
  setSelectedTemplate: (v: string) => void;
  exportFormats: ExportFormats;
  setExportFormats: (v: ExportFormats) => void;
  isProcessing: boolean;
  isAdmin: boolean;
  selectedFirmId: string;
  setSelectedFirmId: (v: string) => void;
}

export default function BatchUploadOptions({
  improveOption,
  setImproveOption,
  exportOption,
  setExportOption,
  deleteAfterExport,
  setDeleteAfterExport,
  templates,
  selectedTemplate,
  setSelectedTemplate,
  exportFormats,
  setExportFormats,
  isProcessing,
  isAdmin,
  selectedFirmId,
  setSelectedFirmId
}: BatchUploadOptionsProps) {
  const { t } = useTranslation();
  const toggleExportFormat = (format: ExportFormats[number], checked: boolean): void => {
    if (checked) {
      setExportFormats(exportFormats.includes(format) ? exportFormats : [...exportFormats, format]);
      return;
    }

    setExportFormats(exportFormats.filter((currentFormat) => currentFormat !== format));
  };

  return (
    <div className="space-y-4">
      {/* Improve option */}
      <div className="flex items-center gap-3">
        <Switch
          checked={improveOption}
          onChange={setImproveOption}
          label={t('batchUpload.improveOption', 'Améliorer les CVs automatiquement')}
          disabled={isProcessing}
        />
        <div className="flex items-center gap-2">
          <SparklesIcon className="w-5 h-5 text-yellow-500" />
          <span className="text-gray-700 dark:text-gray-300">
            {t('batchUpload.improveOption', 'Améliorer les CVs automatiquement')}
          </span>
        </div>
      </div>
      
      {improveOption && (
        <p className="text-sm text-amber-600 dark:text-amber-400 ml-8">
          ⚠️ {t('batchUpload.improveWarning', 'L\'amélioration prend plus de temps (environ 30-60 secondes par CV)')}
        </p>
      )}

      {/* Export option */}
      <div className="flex items-center gap-3">
        <Switch
          checked={exportOption}
          onChange={setExportOption}
          label={t('batchUpload.exportOption', 'Exporter les CVs après traitement (ZIP)')}
          disabled={isProcessing}
        />
        <div className="flex items-center gap-2">
          <ArrowDownTrayIcon className="w-5 h-5 text-green-500" />
          <span className="text-gray-700 dark:text-gray-300">
            {t('batchUpload.exportOption', 'Exporter les CVs après traitement (ZIP)')}
          </span>
        </div>
      </div>

      {/* Export options - template and format selection */}
      {exportOption && (
        <div className="ml-8 space-y-3 p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              {t('batchUpload.exportTemplate', 'Modèle d\'export')}
            </label>
            <select
              value={selectedTemplate}
              onChange={(e) => setSelectedTemplate(e.target.value)}
              disabled={isProcessing || templates.length === 0}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-indigo-500"
            >
              {templates.length === 0 ? (
                <option value="">{t('batchUpload.loadingTemplates', 'Chargement des modèles...')}</option>
              ) : (
                templates.map(template => (
                  <option key={template.id} value={template.id}>
                    {template.Name}
                  </option>
                ))
              )}
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              {t('batchUpload.exportFormats', 'Formats d\'export (sélection multiple)')}
            </label>
            <div className="flex gap-4">
              <div className="flex items-center gap-2">
                <Switch
                  checked={exportFormats.includes('pdf')}
                  onChange={(checked) => toggleExportFormat('pdf', checked)}
                  label="PDF"
                  disabled={isProcessing}
                />
                <span className="text-gray-700 dark:text-gray-300">PDF</span>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  checked={exportFormats.includes('docx')}
                  onChange={(checked) => toggleExportFormat('docx', checked)}
                  label="DOCX"
                  disabled={isProcessing}
                />
                <span className="text-gray-700 dark:text-gray-300">DOCX</span>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  checked={exportFormats.includes('doc')}
                  onChange={(checked) => toggleExportFormat('doc', checked)}
                  label="DOC"
                  disabled={isProcessing}
                />
                <span className="text-gray-700 dark:text-gray-300">DOC</span>
              </div>
            </div>
            {exportFormats.length === 0 && (
              <p className="text-xs text-red-500 mt-1">
                {t('batchUpload.selectAtLeastOneFormat', 'Sélectionnez au moins un format')}
              </p>
            )}
          </div>
          
          <p className="text-sm text-blue-600 dark:text-blue-400">
            ℹ️ {t('batchUpload.zipInfo', 'Un fichier ZIP contenant tous les CVs exportés sera téléchargé à la fin du traitement')}
          </p>
        </div>
      )}

      {/* Delete after processing option */}
      <div className="flex items-center gap-3">
        <Switch
          checked={deleteAfterExport}
          onChange={setDeleteAfterExport}
          label={t('batchUpload.deleteAfterOption', 'Supprimer les CVs après traitement')}
          disabled={isProcessing}
        />
        <div className="flex items-center gap-2">
          <XMarkIcon className="w-5 h-5 text-red-500" />
          <span className="text-gray-700 dark:text-gray-300">
            {t('batchUpload.deleteAfterOption', 'Supprimer les CVs après traitement')}
          </span>
        </div>
      </div>

      {deleteAfterExport && (
        <p className="text-sm text-red-600 dark:text-red-400 ml-8">
          ⚠️ {t('batchUpload.deleteWarning', `Les CVs seront supprimés de la base de données après ${exportOption ? 'l\'export' : 'le traitement'}. Cette action est irréversible.`)}
        </p>
      )}
      
      {/* Admin firm selector */}
      {isAdmin && (
        <div className="mt-4">
          <AdminFirmSelector
            selectedFirmId={selectedFirmId}
            onFirmChange={setSelectedFirmId}
            disabled={isProcessing}
            t={t}
          />
        </div>
      )}
    </div>
  );
}

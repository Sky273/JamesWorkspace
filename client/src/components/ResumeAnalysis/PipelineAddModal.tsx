/**
 * PipelineAddModal - Add resume to pipeline modal
 * Extracted from PipelineTab.tsx
 */

import { useTranslation } from 'react-i18next';

interface Mission {
  id: string;
  title: string;
  client: string;
}

interface Client {
  id: string;
  name: string;
  type?: string;
}

interface NewPipelineForm {
  missionId: string;
  clientId: string;
  notes: string;
}

interface PipelineAddModalProps {
  missions: Mission[];
  clients: Client[];
  newPipeline: NewPipelineForm;
  setNewPipeline: (v: NewPipelineForm) => void;
  onAdd: () => void;
  onClose: () => void;
}

export default function PipelineAddModal({
  missions,
  clients,
  newPipeline,
  setNewPipeline,
  onAdd,
  onClose
}: PipelineAddModalProps) {
  const { t } = useTranslation();

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-md mx-4">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
          {t('pipeline.addToProcessTitle')}
        </h3>

        <div className="space-y-4">
          {/* Mission selector */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              {t('pipeline.selectMission')}
            </label>
            <select
              value={newPipeline.missionId}
              onChange={(e) => setNewPipeline({ ...newPipeline, missionId: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
            >
              <option value="">{t('pipeline.noMission')}</option>
              {missions.map((mission) => (
                <option key={mission.id} value={mission.id}>
                  {mission.title} - {mission.client}
                </option>
              ))}
            </select>
          </div>

          {/* Client selector */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              {t('pipeline.selectClient')}
            </label>
            <select
              value={newPipeline.clientId}
              onChange={(e) => setNewPipeline({ ...newPipeline, clientId: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
            >
              <option value="">{t('pipeline.noClient')}</option>
              {clients.map((client) => (
                <option key={client.id} value={client.id}>
                  {client.name} {client.type ? `(${client.type})` : ''}
                </option>
              ))}
            </select>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              {t('pipeline.notes')}
            </label>
            <textarea
              value={newPipeline.notes}
              onChange={(e) => setNewPipeline({ ...newPipeline, notes: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
              rows={3}
              placeholder={t('pipeline.notesPlaceholder')}
            />
          </div>
        </div>

        <div className="flex justify-end gap-3 mt-6">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
          >
            {t('common.cancel')}
          </button>
          <button
            onClick={onAdd}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            {t('pipeline.add')}
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * Mission Selector Component
 * TypeScript version
 */

import { useState, useEffect, useCallback, ChangeEvent } from 'react';
import { motion } from 'framer-motion';
import { MagnifyingGlassIcon, BriefcaseIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { useAuthFetch } from '../hooks/useAuthFetch';
import toast from 'react-hot-toast';
import logger from '../utils/logger.frontend';

interface Mission {
  id: string;
  Title?: string;
  Content?: string;
  Customer?: string;
}

interface MissionSelectorProps {
  onSelect: (mission: Mission) => void;
  onClose: () => void;
  selectedMissionId?: string | null;
}

const MissionSelector = ({ onSelect, onClose, selectedMissionId = null }: MissionSelectorProps): JSX.Element => {
  const { authGet } = useAuthFetch();
  const [missions, setMissions] = useState<Mission[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [selectedMission, setSelectedMission] = useState<Mission | null>(null);

  const fetchMissions = useCallback(async (): Promise<void> => {
    try {
      setLoading(true);
      const response = await authGet('/api/missions');
      if (!response.ok) throw new Error('Failed to fetch missions');
      const data = await response.json();
      // API returns { data: missions[], pagination: {...} }
      setMissions(Array.isArray(data) ? data : (data.data || []));
    } catch (error) {
      logger.error('Error fetching missions:', error);
      toast.error('Erreur lors du chargement des missions');
    } finally {
      setLoading(false);
    }
  }, [authGet]);

  useEffect(() => { fetchMissions(); }, [fetchMissions]);

  const filteredMissions = missions.filter(mission => {
    const searchLower = searchTerm.toLowerCase();
    return mission.Title?.toLowerCase().includes(searchLower) || mission.Content?.toLowerCase().includes(searchLower);
  });

  const handleSelectMission = (mission: Mission): void => setSelectedMission(mission);

  const handleConfirm = (): void => {
    if (selectedMission) onSelect(selectedMission);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-3xl w-full mx-4 max-h-[80vh] flex flex-col">
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Sélectionner une Mission</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"><XMarkIcon className="w-6 h-6" /></button>
        </div>

        <div className="p-6 border-b border-gray-200 dark:border-gray-700">
          <div className="relative">
            <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input type="text" placeholder="Rechercher une mission..." value={searchTerm} onChange={(e: ChangeEvent<HTMLInputElement>) => setSearchTerm(e.target.value)} className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500" />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="flex items-center justify-center py-12"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div></div>
          ) : filteredMissions.length === 0 ? (
            <div className="text-center py-12">
              <BriefcaseIcon className="w-16 h-16 mx-auto text-gray-400 mb-4" />
              <p className="text-gray-500 dark:text-gray-400">{searchTerm ? 'Aucune mission trouvée' : 'Aucune mission disponible'}</p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredMissions.map((mission) => (
                <motion.div key={mission.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className={`p-4 border-2 rounded-lg cursor-pointer transition-all ${selectedMission?.id === mission.id ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20' : 'border-gray-200 dark:border-gray-700 hover:border-blue-300 dark:hover:border-blue-700'}`} onClick={() => handleSelectMission(mission)}>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h3 className="font-semibold text-gray-900 dark:text-white mb-1">{mission.Title || 'Sans titre'}</h3>
                      <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-2">{mission.Content || 'Pas de description'}</p>
                      {mission.Customer && <p className="text-xs text-gray-500 dark:text-gray-500 mt-2">Client: {mission.Customer}</p>}
                    </div>
                    {selectedMission?.id === mission.id && (
                      <div className="ml-4">
                        <div className="w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center">
                          <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>
                        </div>
                      </div>
                    )}
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-3 p-6 border-t border-gray-200 dark:border-gray-700">
          <button onClick={onClose} className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors">Annuler</button>
          <button onClick={handleConfirm} disabled={!selectedMission} className={`px-6 py-2 rounded-lg font-medium transition-colors ${selectedMission ? 'bg-blue-500 hover:bg-blue-600 text-white' : 'bg-gray-300 dark:bg-gray-700 text-gray-500 dark:text-gray-500 cursor-not-allowed'}`}>Continuer</button>
        </div>
      </motion.div>
    </div>
  );
};

export default MissionSelector;

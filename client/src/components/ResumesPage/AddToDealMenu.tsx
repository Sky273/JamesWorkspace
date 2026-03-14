/**
 * Manage Resume Deals Modal Component
 * Modal to manage deals associated with a resume (add/remove)
 */

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  FolderIcon, 
  XMarkIcon, 
  PlusIcon, 
  TrashIcon,
  BuildingOfficeIcon,
  UserIcon,
  MagnifyingGlassIcon
} from '@heroicons/react/24/outline';
import { fetchWithAuth, createAuthOptionsWithCsrf } from '../../utils/apiInterceptor';
import logger from '../../utils/logger.frontend';
import toast from 'react-hot-toast';

interface Deal {
  id: string;
  title: string;
  client_name?: string;
  client_type?: string;
  contact_name?: string;
  status: string;
  priority: string;
  resumes_count: number;
}

interface ResumeDeal {
  deal_id: string;
  deal_title: string;
  client_name?: string;
  contact_name?: string;
  status: string;
  added_at: string;
}

interface ManageResumeDealsModalProps {
  resumeId: string;
  onSuccess?: () => void;
}

const STATUS_LABELS: Record<string, string> = {
  open: 'En cours',
  won: 'Gagnée',
  lost: 'Perdue',
  on_hold: 'En attente'
};

const ManageResumeDealsModal = ({ resumeId, onSuccess }: ManageResumeDealsModalProps): JSX.Element => {
  const [isOpen, setIsOpen] = useState(false);
  const [allDeals, setAllDeals] = useState<Deal[]>([]);
  const [resumeDeals, setResumeDeals] = useState<ResumeDeal[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [showAddSection, setShowAddSection] = useState(false);

  // Fetch data when modal opens
  const fetchData = useCallback(async () => {
    if (!isOpen) return;
    
    try {
      setLoading(true);
      const options = await createAuthOptionsWithCsrf({ method: 'GET' });
      
      // Fetch all deals (for adding)
      const dealsResponse = await fetchWithAuth('/api/deals?limit=100', options);
      if (dealsResponse.ok) {
        const data = await dealsResponse.json();
        setAllDeals(data.data || []);
      }

      // Fetch deals this resume is already in
      const resumeDealsResponse = await fetchWithAuth(`/api/deals/by-resume/${resumeId}`, options);
      if (resumeDealsResponse.ok) {
        const data = await resumeDealsResponse.json();
        setResumeDeals(data.data || []);
      }
    } catch (error) {
      logger.error('Error fetching deals:', error);
      toast.error('Erreur lors du chargement des affaires');
    } finally {
      setLoading(false);
    }
  }, [isOpen, resumeId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Filter available deals (not already associated)
  const availableDeals = allDeals.filter(deal => 
    !resumeDeals.some(rd => rd.deal_id === deal.id) &&
    (searchTerm === '' || 
      deal.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      deal.client_name?.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const addToDeal = async (dealId: string) => {
    setSaving(true);
    try {
      const options = await createAuthOptionsWithCsrf({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resumeId })
      });
      const response = await fetchWithAuth(`/api/deals/${dealId}/resumes`, options);
      
      if (response.ok) {
        toast.success('CV ajouté à l\'affaire');
        await fetchData();
        setShowAddSection(false);
        setSearchTerm('');
        onSuccess?.();
      } else {
        const error = await response.json();
        throw new Error(error.error || 'Failed to add');
      }
    } catch (error) {
      logger.error('Error adding to deal:', error);
      toast.error('Erreur lors de l\'ajout');
    } finally {
      setSaving(false);
    }
  };

  const removeFromDeal = async (dealId: string) => {
    setSaving(true);
    try {
      const options = await createAuthOptionsWithCsrf({ method: 'DELETE' });
      const response = await fetchWithAuth(`/api/deals/${dealId}/resumes/${resumeId}`, options);
      
      if (response.ok) {
        toast.success('CV retiré de l\'affaire');
        setResumeDeals(prev => prev.filter(rd => rd.deal_id !== dealId));
        onSuccess?.();
      } else {
        throw new Error('Failed to remove');
      }
    } catch (error) {
      logger.error('Error removing from deal:', error);
      toast.error('Erreur lors de la suppression');
    } finally {
      setSaving(false);
    }
  };

  const openModal = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsOpen(true);
    setShowAddSection(false);
    setSearchTerm('');
  };

  const closeModal = () => {
    setIsOpen(false);
  };

  return (
    <>
      {/* Trigger Button */}
      <button
        onClick={openModal}
        className="p-2 text-gray-500 hover:text-purple-600 dark:text-gray-400 dark:hover:text-purple-400 transition-colors rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
        title="Gérer les affaires"
      >
        <FolderIcon className="w-5 h-5" />
      </button>

      {/* Modal */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
            onClick={closeModal}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-lg w-full max-h-[80vh] flex flex-col"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
                <div>
                  <h2 className="text-lg font-bold text-gray-900 dark:text-white">
                    Affaires du CV
                  </h2>
                  <p className="text-sm text-gray-500 dark:text-gray-400 font-mono">
                    ID: {resumeId}
                  </p>
                </div>
                <button
                  onClick={closeModal}
                  className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
                >
                  <XMarkIcon className="w-5 h-5" />
                </button>
              </div>

              {/* Content */}
              <div className="flex-1 overflow-y-auto p-4">
                {loading ? (
                  <div className="flex items-center justify-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500"></div>
                  </div>
                ) : (
                  <>
                    {/* Current deals */}
                    <div className="mb-6">
                      <div className="flex items-center justify-between mb-3">
                        <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">
                          Affaires associées ({resumeDeals.length})
                        </h3>
                        {!showAddSection && (
                          <button
                            onClick={() => setShowAddSection(true)}
                            className="flex items-center gap-1 px-3 py-1.5 text-sm bg-purple-500 text-white rounded-lg hover:bg-purple-600 transition-colors"
                          >
                            <PlusIcon className="w-4 h-4" />
                            Ajouter
                          </button>
                        )}
                      </div>

                      {resumeDeals.length === 0 ? (
                        <div className="text-center py-6 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                          <FolderIcon className="w-10 h-10 mx-auto text-gray-400 mb-2" />
                          <p className="text-sm text-gray-500 dark:text-gray-400">
                            Ce CV n'est associé à aucune affaire
                          </p>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {resumeDeals.map(deal => (
                            <div
                              key={deal.deal_id}
                              className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg"
                            >
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <span className="font-medium text-gray-900 dark:text-white truncate">
                                    {deal.deal_title}
                                  </span>
                                  <span className={`px-2 py-0.5 text-xs rounded-full ${
                                    deal.status === 'open' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' :
                                    deal.status === 'won' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300' :
                                    deal.status === 'lost' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300' :
                                    'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300'
                                  }`}>
                                    {STATUS_LABELS[deal.status] || deal.status}
                                  </span>
                                </div>
                                <div className="flex items-center gap-3 mt-1 text-xs text-gray-500 dark:text-gray-400">
                                  {deal.client_name && (
                                    <span className="flex items-center gap-1">
                                      <BuildingOfficeIcon className="w-3 h-3" />
                                      {deal.client_name}
                                    </span>
                                  )}
                                  {deal.contact_name && (
                                    <span className="flex items-center gap-1">
                                      <UserIcon className="w-3 h-3" />
                                      {deal.contact_name}
                                    </span>
                                  )}
                                </div>
                              </div>
                              <button
                                onClick={() => removeFromDeal(deal.deal_id)}
                                disabled={saving}
                                className="p-2 text-red-500 hover:text-red-700 hover:bg-red-100 dark:hover:bg-red-900/30 rounded-lg transition-colors disabled:opacity-50"
                                title="Retirer de cette affaire"
                              >
                                <TrashIcon className="w-4 h-4" />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Add to deal section */}
                    <AnimatePresence>
                      {showAddSection && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                          className="border-t border-gray-200 dark:border-gray-700 pt-4"
                        >
                          <div className="flex items-center justify-between mb-3">
                            <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">
                              Ajouter à une affaire
                            </h3>
                            <button
                              onClick={() => {
                                setShowAddSection(false);
                                setSearchTerm('');
                              }}
                              className="text-sm text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
                            >
                              Annuler
                            </button>
                          </div>

                          {/* Search */}
                          <div className="relative mb-3">
                            <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                            <input
                              type="text"
                              value={searchTerm}
                              onChange={(e) => setSearchTerm(e.target.value)}
                              placeholder="Rechercher une affaire..."
                              className="w-full pl-9 pr-4 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                            />
                          </div>

                          {/* Available deals list */}
                          <div className="max-h-48 overflow-y-auto space-y-1">
                            {availableDeals.length === 0 ? (
                              <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-4">
                                {searchTerm ? 'Aucune affaire trouvée' : 'Toutes les affaires sont déjà associées'}
                              </p>
                            ) : (
                              availableDeals.map(deal => (
                                <button
                                  key={deal.id}
                                  onClick={() => addToDeal(deal.id)}
                                  disabled={saving}
                                  className="w-full flex items-center justify-between p-2 text-left hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors disabled:opacity-50"
                                >
                                  <div className="flex-1 min-w-0">
                                    <div className="font-medium text-sm text-gray-900 dark:text-white truncate">
                                      {deal.title}
                                    </div>
                                    {deal.client_name && (
                                      <div className="text-xs text-gray-500 dark:text-gray-400 truncate">
                                        {deal.client_name}
                                      </div>
                                    )}
                                  </div>
                                  <PlusIcon className="w-4 h-4 text-purple-500 flex-shrink-0 ml-2" />
                                </button>
                              ))
                            )}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </>
                )}
              </div>

              {/* Footer */}
              <div className="p-4 border-t border-gray-200 dark:border-gray-700">
                <button
                  onClick={closeModal}
                  className="w-full px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                >
                  Fermer
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

export default ManageResumeDealsModal;

/**
 * Client Detail Modal Component
 */

import { useState } from 'react';
import Modal from './Modal';
import { Client, ClientContact, ResumeSubmission } from '../../types/entities';
import {
  BuildingOfficeIcon,
  UserGroupIcon,
  PencilSquareIcon,
  TrashIcon,
  PlusIcon,
  EnvelopeIcon,
  PhoneIcon,
  GlobeAltIcon,
  MapPinIcon,
  PaperAirplaneIcon,
  DocumentTextIcon,
  FolderIcon
} from '@heroicons/react/24/outline';
import { useNavigate } from 'react-router-dom';
import { StarIcon as StarIconSolid } from '@heroicons/react/24/solid';

interface ClientWithDetails extends Client {
  contacts?: ClientContact[];
  recentSubmissions?: ResumeSubmission[];
}

interface ClientDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  client: ClientWithDetails | null;
  onEditClient: () => void;
  onAddContact: () => void;
  onEditContact: (contact: ClientContact) => void;
  onDeleteContact: (contact: ClientContact) => void;
  t: (key: string) => string;
}

const ClientDetailModal = ({ 
  isOpen, 
  onClose, 
  client, 
  onEditClient, 
  onAddContact, 
  onEditContact, 
  onDeleteContact,
  t 
}: ClientDetailModalProps): JSX.Element => {
  const [activeTab, setActiveTab] = useState<'contacts' | 'submissions'>('contacts');
  const navigate = useNavigate();

  if (!client) return <></>;

  const getTypeColor = (type: string): string => {
    return type === 'client' 
      ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
      : 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300';
  };

  const getStatusColor = (status: string): string => {
    switch (status) {
      case 'accepted': return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300';
      case 'rejected': return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300';
      case 'viewed': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300';
      case 'sent': return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300';
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300';
    }
  };

  return (
    <Modal 
      isOpen={isOpen} 
      onClose={onClose} 
      title={client.name}
      size="xl"
    >
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-gray-100 dark:bg-gray-700 rounded-lg">
              <BuildingOfficeIcon className="w-8 h-8 text-gray-600 dark:text-gray-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">{client.name}</h2>
                <span className={`px-2 py-1 text-xs font-medium rounded-full ${getTypeColor(client.type)}`}>
                  {t(`clients.types.${client.type}`)}
                </span>
              </div>
              {client.industry && (
                <p className="text-gray-500 dark:text-gray-400">{client.industry}</p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                onClose();
                navigate(`/clients?tab=deals&clientId=${client.id}`);
              }}
              className="btn btn-primary flex items-center gap-2 px-3 py-2 text-sm"
            >
              <FolderIcon className="w-4 h-4" />
              Affaires
            </button>
            <button
              onClick={onEditClient}
              className="btn btn-secondary flex items-center gap-2 px-3 py-2 text-sm"
            >
              <PencilSquareIcon className="w-4 h-4" />
              {t('common.edit')}
            </button>
          </div>
        </div>

        {/* Info */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
          {client.website && (
            <div className="flex items-center gap-2 text-sm">
              <GlobeAltIcon className="w-5 h-5 text-gray-400" />
              <a href={client.website} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline">
                {client.website}
              </a>
            </div>
          )}
          {client.address && (
            <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
              <MapPinIcon className="w-5 h-5 text-gray-400" />
              <span>{client.address}</span>
            </div>
          )}
        </div>

        {client.notes && (
          <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
            <p className="text-sm text-gray-700 dark:text-gray-300">{client.notes}</p>
          </div>
        )}

        {/* Tabs */}
        <div className="border-b border-gray-200 dark:border-gray-700">
          <div className="flex gap-4">
            <button
              onClick={() => setActiveTab('contacts')}
              className={`pb-3 px-1 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'contacts'
                  ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400'
              }`}
            >
              <div className="flex items-center gap-2">
                <UserGroupIcon className="w-5 h-5" />
                {t('clients.tabs.contacts')} ({client.contacts?.length || 0})
              </div>
            </button>
            <button
              onClick={() => setActiveTab('submissions')}
              className={`pb-3 px-1 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'submissions'
                  ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400'
              }`}
            >
              <div className="flex items-center gap-2">
                <PaperAirplaneIcon className="w-5 h-5" />
                {t('clients.tabs.submissions')} ({client.recentSubmissions?.length || 0})
              </div>
            </button>
          </div>
        </div>

        {/* Contacts Tab */}
        {activeTab === 'contacts' && (
          <div>
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">
                {t('clients.contactsTitle')}
              </h3>
              <button
                onClick={onAddContact}
                className="btn btn-secondary flex items-center gap-2 px-3 py-2 text-sm"
              >
                <PlusIcon className="w-4 h-4" />
                {t('clients.addContact')}
              </button>
            </div>

            {client.contacts && client.contacts.length > 0 ? (
              <div className="space-y-3">
                {client.contacts.map((contact) => (
                  <div 
                    key={contact.id} 
                    className="flex items-center justify-between p-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700"
                  >
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-gray-100 dark:bg-gray-700 rounded-full">
                        <UserGroupIcon className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-gray-900 dark:text-gray-100">{contact.name}</span>
                          {contact.is_primary && (
                            <StarIconSolid className="w-4 h-4 text-yellow-500" title={t('clients.primaryContact')} />
                          )}
                        </div>
                        {contact.role && (
                          <p className="text-sm text-gray-500 dark:text-gray-400">{contact.role}</p>
                        )}
                        <div className="flex items-center gap-4 mt-1">
                          {contact.email && (
                            <a href={`mailto:${contact.email}`} className="flex items-center gap-1 text-sm text-blue-500 hover:underline">
                              <EnvelopeIcon className="w-4 h-4" />
                              {contact.email}
                            </a>
                          )}
                          {contact.phone && (
                            <a href={`tel:${contact.phone}`} className="flex items-center gap-1 text-sm text-gray-600 dark:text-gray-400">
                              <PhoneIcon className="w-4 h-4" />
                              {contact.phone}
                            </a>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => onEditContact(contact)}
                        className="p-2 text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                      >
                        <PencilSquareIcon className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => onDeleteContact(contact)}
                        className="p-2 text-red-600 hover:bg-red-100 dark:hover:bg-red-900/30 rounded-lg transition-colors"
                      >
                        <TrashIcon className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                <UserGroupIcon className="w-12 h-12 mx-auto mb-2 opacity-50" />
                <p>{t('clients.noContacts')}</p>
              </div>
            )}
          </div>
        )}

        {/* Submissions Tab */}
        {activeTab === 'submissions' && (
          <div>
            <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-4">
              {t('clients.submissionsTitle')}
            </h3>

            {client.recentSubmissions && client.recentSubmissions.length > 0 ? (
              <div className="space-y-3">
                {client.recentSubmissions.map((submission) => (
                  <div 
                    key={submission.id} 
                    className="flex items-center justify-between p-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700"
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-gray-900 dark:text-gray-100">
                          {submission.resume_name}
                        </span>
                        <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${getStatusColor(submission.status)}`}>
                          {t(`clients.submissionStatus.${submission.status}`)}
                        </span>
                        {submission.version_number && (
                          <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300">
                            v{submission.version_number}
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        {t('clients.sentTo')}: {submission.contact_name}
                        {submission.mission_title && ` • ${submission.mission_title}`}
                      </p>
                      <p className="text-xs text-gray-400 dark:text-gray-500">
                        {new Date(submission.sent_at).toLocaleDateString()} {t('clients.by')} {submission.sent_by_name}
                      </p>
                    </div>
                    {submission.version_number && (
                      <a
                        href={`/resumes/${submission.resume_id}?version=${submission.version_number}`}
                        className="flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-purple-600 hover:text-purple-700 dark:text-purple-400 dark:hover:text-purple-300 bg-purple-50 hover:bg-purple-100 dark:bg-purple-900/20 dark:hover:bg-purple-900/30 rounded-lg transition-colors"
                        title={t('clients.viewVersion')}
                      >
                        <DocumentTextIcon className="w-4 h-4" />
                        {t('clients.viewVersion')}
                      </a>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                <PaperAirplaneIcon className="w-12 h-12 mx-auto mb-2 opacity-50" />
                <p>{t('clients.noSubmissions')}</p>
              </div>
            )}
          </div>
        )}
      </div>
    </Modal>
  );
};

export default ClientDetailModal;

/**
 * CRMPage - Manage clients, prospects and deals
 */

import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';

import { DealsTab } from '../components/CRM';
import {
  ClientDetailModal,
  ClientFormModal,
  ConfirmDeleteModal,
  ContactFormModal,
} from '../components/ClientsPage';
import type { ClientContact } from '../types/entities';
import {
  ClientsPagination,
  ClientsResults,
  ClientsToolbar,
  CRMHeader,
  CRMMainTabs,
  CRMStatsCards,
} from './ClientsPage.components';
import { useClientsDashboard } from './ClientsPage.hooks';

const CRMPage = (): JSX.Element => {
  const { t } = useTranslation();
  const dashboard = useClientsDashboard();

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="cv-surface app-page-shell">
      <CRMHeader />

      <CRMMainTabs crmTab={dashboard.crmTab} onClientsClick={dashboard.goToClientsTab} onDealsClick={dashboard.goToDealsTab} />

      {dashboard.crmTab === 'deals' && <DealsTab preFilterClientId={dashboard.searchParams.get('clientId') || undefined} />}

      {dashboard.crmTab === 'clients' && (
        <>
          <CRMStatsCards stats={dashboard.stats} />

          <ClientsToolbar
            activeTab={dashboard.activeTab}
            onCreateClient={() => {
              dashboard.setSelectedClient(null);
              dashboard.setClientModalOpen(true);
            }}
            onRefresh={() => {
              void dashboard.fetchData();
            }}
            onSearchTermChange={dashboard.setSearchTerm}
            onSetActiveTab={(value) => {
              dashboard.setActiveTab(value);
              dashboard.setPage(1);
            }}
            searchTerm={dashboard.searchTerm}
          />

          <ClientsPagination
            currentPage={dashboard.page}
            loading={dashboard.loading}
            onPageChange={dashboard.goToPage}
            totalCount={dashboard.totalCount}
            totalPages={dashboard.totalPages}
          />

          <ClientsResults
            clients={dashboard.clients}
            loading={dashboard.loading}
            onDeleteClient={(client) => {
              dashboard.setDeleteTarget({ id: client.id, name: client.name, type: 'client' });
              dashboard.setDeleteModalOpen(true);
            }}
            onEditClient={(client) => {
              dashboard.setSelectedClient(client);
              dashboard.setClientModalOpen(true);
            }}
            onOpenClientDetail={dashboard.openClientDetail}
          />

          <ClientsPagination
            currentPage={dashboard.page}
            loading={dashboard.loading}
            onPageChange={dashboard.goToPage}
            totalCount={dashboard.totalCount}
            totalPages={dashboard.totalPages}
          />
        </>
      )}

      <ClientFormModal
        isOpen={dashboard.clientModalOpen}
        onClose={() => {
          dashboard.setClientModalOpen(false);
          dashboard.setSelectedClient(null);
        }}
        onSubmit={dashboard.handleClientSubmit}
        client={dashboard.selectedClient}
        t={t}
      />

      <ContactFormModal
        isOpen={dashboard.contactModalOpen}
        onClose={() => {
          dashboard.setContactModalOpen(false);
          dashboard.setSelectedContact(null);
        }}
        onSubmit={dashboard.handleContactSubmit}
        contact={dashboard.selectedContact}
        t={t}
      />

      <ClientDetailModal
        isOpen={dashboard.detailModalOpen}
        onClose={() => {
          dashboard.setDetailModalOpen(false);
          dashboard.setSelectedClient(null);
        }}
        client={dashboard.selectedClient}
        onEditClient={() => {
          dashboard.setDetailModalOpen(false);
          dashboard.setClientModalOpen(true);
        }}
        onAddContact={() => {
          dashboard.setDetailModalOpen(false);
          dashboard.setSelectedContact(null);
          dashboard.setContactModalOpen(true);
        }}
        onEditContact={(contact: ClientContact) => {
          dashboard.setDetailModalOpen(false);
          dashboard.setSelectedContact(contact);
          dashboard.setContactModalOpen(true);
        }}
        onDeleteContact={(contact: ClientContact) => {
          dashboard.setDeleteTarget({ id: contact.id, name: contact.name, type: 'contact', clientId: dashboard.selectedClient?.id });
          dashboard.setDeleteModalOpen(true);
        }}
        t={t}
      />

      <ConfirmDeleteModal
        isOpen={dashboard.deleteModalOpen}
        onClose={() => {
          dashboard.setDeleteModalOpen(false);
          dashboard.setDeleteTarget(null);
        }}
        onConfirm={dashboard.handleDelete}
        message={dashboard.deleteTarget?.type === 'client' ? t('clients.messages.confirmDeleteClient', { name: dashboard.deleteTarget?.name }) : t('clients.messages.confirmDeleteContact', { name: dashboard.deleteTarget?.name })}
        t={t}
      />
    </motion.div>
  );
};

export default CRMPage;
export { CRMPage as ClientsPage };

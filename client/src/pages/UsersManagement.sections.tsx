import {
  BuildingOfficeIcon,
  KeyIcon,
  PencilSquareIcon,
  ShieldCheckIcon,
  TrashIcon,
  UserIcon,
  UsersIcon,
} from '@heroicons/react/24/outline';
import { useTranslation } from 'react-i18next';

import AnimatedCard from '../components/page/AnimatedCard';
import CardActionButton from '../components/page/CardActionButton';
import EmptyStateCard from '../components/page/EmptyStateCard';
import type { Firm, User } from './UsersManagement.hooks';

function UserRoleBadge({ role }: { role: string | undefined }) {
  const { t } = useTranslation();
  const isSuperAdmin = role === 'admin';
  const isLocalAdmin = role === 'localAdmin';
  const isAdminRole = isSuperAdmin || isLocalAdmin;

  const badgeClassName = isSuperAdmin
    ? 'users-management-role-badge--admin bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300'
    : isLocalAdmin
      ? 'users-management-role-badge--local-admin bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300'
      : 'users-management-role-badge--user bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300';

  const roleLabel = isSuperAdmin
    ? t('users.management.roles.admin')
    : isLocalAdmin
      ? t('users.management.roles.localAdmin')
      : t('users.management.roles.user');

  return (
    <span
      className={`users-management-role-badge inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-full ${badgeClassName}`}
    >
      {isAdminRole ? <ShieldCheckIcon className="w-3 h-3" /> : <UserIcon className="w-3 h-3" />}
      {roleLabel}
    </span>
  );
}

function UserStatusBadge({ status }: { status: string | undefined }) {
  const { t } = useTranslation();
  const colors: Record<string, string> = {
    active: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
    inactive: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300',
    pending: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
  };

  return (
    <span className={`px-2 py-1 text-xs font-medium rounded-full ${colors[status || ''] || colors.pending}`}>
      {t(`users.management.status.${status}`) || status}
    </span>
  );
}

export function UsersResultsGrid({
  users,
  onDelete,
  onEdit,
  onPassword,
}: {
  users: User[];
  onDelete: (user: User) => void;
  onEdit: (user: User) => void;
  onPassword: (user: User) => void;
}) {
  const { t } = useTranslation();

  if (users.length === 0) {
    return (
      <div className="col-span-full">
        <EmptyStateCard icon={UsersIcon} description={t('users.management.noUsers')} />
      </div>
    );
  }

  return (
    <>
      {users.map((user, index) => (
        <AnimatedCard key={user.id} index={index} className="shadow">
          <div className="p-4">
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center">
                  <span className="text-blue-600 dark:text-blue-400 font-semibold">
                    {user.name?.charAt(0)?.toUpperCase() || '?'}
                  </span>
                </div>
                <div>
                  <h2 className="font-semibold text-gray-900 dark:text-gray-100">{user.name}</h2>
                  <p className="text-sm text-gray-500 dark:text-gray-400">{user.email}</p>
                </div>
              </div>
              <UserStatusBadge status={user.status} />
            </div>

            <div className="flex items-center gap-2 mb-3">
              <UserRoleBadge role={user.role} />
              {(user.firmName || user.firm) ? (
                <span className="px-2 py-1 text-xs font-medium rounded-full bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300">
                  {user.firmName || user.firm}
                </span>
              ) : null}
            </div>

            <div className="flex items-center gap-2 pt-3 border-t border-gray-200 dark:border-gray-700">
              <CardActionButton
                icon={PencilSquareIcon}
                label={t('users.management.actions.edit')}
                onClick={() => onEdit(user)}
                className="app-primary-action flex-1 px-3 py-2"
                tone="primary"
              />
              <CardActionButton
                icon={KeyIcon}
                onClick={() => onPassword(user)}
                title={t('users.management.actions.forcePasswordReset')}
                tone="info"
              />
              <CardActionButton
                icon={TrashIcon}
                onClick={() => onDelete(user)}
                title={t('users.management.actions.delete')}
                tone="danger"
              />
            </div>
          </div>
        </AnimatedCard>
      ))}
    </>
  );
}

export function FirmsResultsGrid({
  firms,
  users,
  onDelete,
  onEdit,
}: {
  firms: Firm[];
  users: User[];
  onDelete: (firm: Firm) => void;
  onEdit: (firm: Firm) => void;
}) {
  const { t } = useTranslation();

  if (firms.length === 0) {
    return (
      <div className="col-span-full">
        <EmptyStateCard icon={BuildingOfficeIcon} description={t('users.management.noFirms')} />
      </div>
    );
  }

  return (
    <>
      {firms.map((firm, index) => {
        const associatedUsers = users.filter((user) => user.firmId === firm.id);

        return (
          <AnimatedCard key={firm.id} index={index} className="shadow">
            <div className="p-4">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center">
                    <BuildingOfficeIcon className="w-5 h-5 text-green-600 dark:text-green-400" />
                  </div>
                  <div>
                    <h2 className="font-semibold text-gray-900 dark:text-gray-100">{firm.name}</h2>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      {associatedUsers.length} {t('users.management.tabs.users').toLowerCase()}
                    </p>
                  </div>
                </div>
              </div>

              {associatedUsers.length > 0 ? (
                <div className="mb-3">
                  <div className="flex flex-wrap gap-1">
                    {associatedUsers.slice(0, 3).map((user) => (
                      <span
                        key={user.id}
                        className="px-2 py-1 text-xs bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 rounded"
                      >
                        {user.name}
                      </span>
                    ))}
                    {associatedUsers.length > 3 ? (
                      <span className="px-2 py-1 text-xs bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 rounded">
                        +{associatedUsers.length - 3}
                      </span>
                    ) : null}
                  </div>
                </div>
              ) : null}

              <div className="flex items-center gap-2 pt-3 border-t border-gray-200 dark:border-gray-700">
                <CardActionButton
                  icon={PencilSquareIcon}
                  label={t('users.management.actions.edit')}
                  onClick={() => onEdit(firm)}
                  className="app-primary-action flex-1 px-3 py-2"
                  tone="primary"
                />
                <CardActionButton
                  icon={TrashIcon}
                  onClick={() => onDelete(firm)}
                  tone={associatedUsers.length > 0 ? 'secondary' : 'danger'}
                  className={
                    associatedUsers.length > 0
                      ? 'text-gray-400 cursor-not-allowed hover:bg-transparent dark:hover:bg-transparent'
                      : ''
                  }
                  title={t('users.management.actions.delete')}
                />
              </div>
            </div>
          </AnimatedCard>
        );
      })}
    </>
  );
}

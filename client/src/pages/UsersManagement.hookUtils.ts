import type {
  DeleteTarget,
  Firm,
  User,
  UsersManagementStats,
} from './UsersManagement.hooks';

export function getTotalPages(totalCount: number, pageSize: number): number {
  return Math.max(1, Math.ceil(totalCount / pageSize)) || 1;
}

export function buildUsersManagementStats(
  users: User[],
  usersTotalCount: number,
  firmsTotalCount: number,
): UsersManagementStats {
  return {
    totalUsers: usersTotalCount,
    totalFirms: firmsTotalCount,
    activeUsers: users.filter((user) => user.status === 'active').length,
    admins: users.filter((user) => user.role === 'admin' || user.role === 'localAdmin').length,
  };
}

export function createDeleteTarget(item: User | Firm, type: DeleteTarget['type']): DeleteTarget {
  return {
    ...item,
    type,
  };
}

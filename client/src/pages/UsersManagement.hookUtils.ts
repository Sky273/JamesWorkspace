import type {
  DeleteTarget,
  Firm,
  User,
  UsersManagementStats,
} from './UsersManagement.hooks';

type EntityWithId = {
  id: string;
};

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

export function buildVisibleRecordsPage<T extends EntityWithId>(
  records: T[],
  options: {
    deletedIds: Set<string>;
    pageSize: number;
    preservedRecord?: T | null;
    shouldIncludePreservedRecord?: boolean;
  },
): {
  visibleRecords: T[];
  nextRecords: T[];
  responseIncludesPreservedRecord: boolean;
} {
  const visibleRecords = records.filter((record) => !options.deletedIds.has(record.id));
  const responseIncludesPreservedRecord = Boolean(
    options.preservedRecord && visibleRecords.some((record) => record.id === options.preservedRecord?.id),
  );

  if (!options.preservedRecord || !options.shouldIncludePreservedRecord || responseIncludesPreservedRecord) {
    return {
      visibleRecords,
      nextRecords: visibleRecords,
      responseIncludesPreservedRecord,
    };
  }

  return {
    visibleRecords,
    nextRecords: [options.preservedRecord, ...visibleRecords].slice(0, options.pageSize),
    responseIncludesPreservedRecord,
  };
}

export function computeAdjustedTotalCount<T extends EntityWithId>(
  records: T[],
  deletedIds: Set<string>,
  reportedTotalCount: number | undefined,
  fallbackCount: number,
): number {
  if (typeof reportedTotalCount !== 'number') {
    return fallbackCount;
  }

  const deletedRecordsInResponse = [...deletedIds].filter((id) => records.some((record) => record.id === id)).length;
  return Math.max(0, reportedTotalCount - deletedRecordsInResponse);
}

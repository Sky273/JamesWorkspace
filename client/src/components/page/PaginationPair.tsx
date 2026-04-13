import type { ReactNode } from 'react';

import Pagination from '../Pagination';

interface PaginationPairProps {
  children?: ReactNode;
  currentPage: number;
  itemName: string;
  loading: boolean;
  onPageChange: (page: number) => void;
  pageSize: number;
  totalCount: number;
  totalPages: number;
}

export default function PaginationPair({
  children,
  currentPage,
  itemName,
  loading,
  onPageChange,
  pageSize,
  totalCount,
  totalPages,
}: PaginationPairProps) {
  if (loading) {
    return null;
  }

  if (totalCount === 0) {
    return children ? <>{children}</> : null;
  }

  return (
    <div className="space-y-6">
      <Pagination
        currentPage={currentPage}
        totalPages={totalPages}
        totalCount={totalCount}
        pageSize={pageSize}
        onPageChange={onPageChange}
        loading={loading}
        itemName={itemName}
      />
      {children}
      <Pagination
        currentPage={currentPage}
        totalPages={totalPages}
        totalCount={totalCount}
        pageSize={pageSize}
        onPageChange={onPageChange}
        loading={loading}
        itemName={itemName}
      />
    </div>
  );
}

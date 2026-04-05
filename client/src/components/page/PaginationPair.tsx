import Pagination from '../Pagination';

interface PaginationPairProps {
  currentPage: number;
  itemName: string;
  loading: boolean;
  onPageChange: (page: number) => void;
  pageSize: number;
  totalCount: number;
  totalPages: number;
}

export default function PaginationPair({
  currentPage,
  itemName,
  loading,
  onPageChange,
  pageSize,
  totalCount,
  totalPages,
}: PaginationPairProps) {
  if (loading || totalCount === 0) {
    return null;
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

/**
 * usePagination Hook
 * Provides common pagination logic for server-side paginated data
 */

import { useState, useCallback, useMemo } from 'react';

export interface PaginationState {
  page: number;
  pageSize: number;
  totalCount: number;
}

export interface PaginationResponse<T> {
  data: T[];
  pagination: {
    page: number;
    pageSize: number;
    totalCount: number;
    hasMore: boolean;
    nextOffset?: number;
  };
}

export interface UsePaginationOptions {
  initialPage?: number;
  initialPageSize?: number;
}

export interface UsePaginationReturn {
  page: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
  setPage: (page: number) => void;
  setTotalCount: (count: number) => void;
  resetPage: () => void;
  goToPage: (page: number) => void;
  nextPage: () => void;
  prevPage: () => void;
  firstPage: () => void;
  lastPage: () => void;
  updateFromResponse: <T>(response: PaginationResponse<T>) => T[];
}

export function usePagination(options: UsePaginationOptions = {}): UsePaginationReturn {
  const { initialPage = 1, initialPageSize = 12 } = options;

  const [page, setPageState] = useState(initialPage);
  const [pageSize] = useState(initialPageSize);
  const [totalCount, setTotalCount] = useState(0);

  const totalPages = useMemo(() => 
    Math.max(1, Math.ceil(totalCount / pageSize)),
    [totalCount, pageSize]
  );

  const setPage = useCallback((newPage: number) => {
    setPageState(Math.max(1, Math.min(newPage, totalPages || 1)));
  }, [totalPages]);

  const resetPage = useCallback(() => {
    setPageState(1);
  }, []);

  const goToPage = useCallback((targetPage: number) => {
    if (targetPage >= 1 && targetPage <= totalPages) {
      setPageState(targetPage);
    }
  }, [totalPages]);

  const nextPage = useCallback(() => {
    if (page < totalPages) {
      setPageState(page + 1);
    }
  }, [page, totalPages]);

  const prevPage = useCallback(() => {
    if (page > 1) {
      setPageState(page - 1);
    }
  }, [page]);

  const firstPage = useCallback(() => {
    setPageState(1);
  }, []);

  const lastPage = useCallback(() => {
    setPageState(totalPages);
  }, [totalPages]);

  const updateFromResponse = useCallback(<T,>(response: PaginationResponse<T>): T[] => {
    if (response.pagination) {
      setTotalCount(response.pagination.totalCount);
    }
    return response.data || [];
  }, []);

  return {
    page,
    pageSize,
    totalCount,
    totalPages,
    setPage,
    setTotalCount,
    resetPage,
    goToPage,
    nextPage,
    prevPage,
    firstPage,
    lastPage,
    updateFromResponse
  };
}

export default usePagination;

/**
 * useDebouncedSearch Hook
 * Provides debounced search functionality with automatic page reset
 */

import { useState, useEffect, useCallback } from 'react';

export interface UseDebouncedSearchOptions {
  delay?: number;
  onSearchChange?: (value: string) => void;
}

export interface UseDebouncedSearchReturn {
  searchTerm: string;
  debouncedSearchTerm: string;
  setSearchTerm: (value: string) => void;
  clearSearch: () => void;
}

export function useDebouncedSearch(
  options: UseDebouncedSearchOptions = {}
): UseDebouncedSearchReturn {
  const { delay = 300, onSearchChange } = options;

  const [searchTerm, setSearchTermState] = useState('');
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
      if (onSearchChange) {
        onSearchChange(searchTerm);
      }
    }, delay);

    return () => clearTimeout(timer);
  }, [searchTerm, delay, onSearchChange]);

  const setSearchTerm = useCallback((value: string) => {
    setSearchTermState(value);
  }, []);

  const clearSearch = useCallback(() => {
    setSearchTermState('');
    setDebouncedSearchTerm('');
  }, []);

  return {
    searchTerm,
    debouncedSearchTerm,
    setSearchTerm,
    clearSearch
  };
}

export default useDebouncedSearch;

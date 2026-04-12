/**
 * useDealDragDrop - Custom hook for drag & drop between deals
 * Extracted from DealsGroupedView.tsx
 */

import { useState, useRef, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { fetchWithAuth, createAuthOptionsWithCsrf } from '../../utils/apiInterceptor';
import toast from 'react-hot-toast';
import logger from '../../utils/logger.frontend';
import { markResumeDealRelationsDirty } from '../../utils/viewRefreshScopes';
import type { DealGroup, GroupedData } from './dealsGrouped.types';

interface UseDealDragDropOptions {
  data: GroupedData | null;
  fetchGroupedData: () => Promise<void>;
}

interface DragState {
  resumeId: string;
  sourceDealId: string | null;
}

export function useDealDragDrop({ data, fetchGroupedData }: UseDealDragDropOptions) {
  const { t } = useTranslation();
  const [draggedResume, setDraggedResume] = useState<DragState | null>(null);
  const [dragOverDealId, setDragOverDealId] = useState<string | null>(null);
  const [dropping, setDropping] = useState(false);
  const dragCounterRef = useRef<Record<string, number>>({});

  const handleDragStart = useCallback((e: React.DragEvent, resumeId: string, sourceDealId: string | null) => {
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', resumeId);
    setDraggedResume({ resumeId, sourceDealId });
    // Capture the element reference before the async callback (React pools synthetic events)
    const el = e.currentTarget as HTMLElement;
    requestAnimationFrame(() => {
      if (el) el.style.opacity = '0.4';
    });
  }, []);

  const handleDragEnd = useCallback((e: React.DragEvent) => {
    const el = e.currentTarget as HTMLElement;
    if (el) el.style.opacity = '1';
    setDraggedResume(null);
    setDragOverDealId(null);
    dragCounterRef.current = {};
  }, []);

  const handleDragEnterDeal = useCallback((e: React.DragEvent, dealId: string) => {
    e.preventDefault();
    e.stopPropagation();
    if (!dragCounterRef.current[dealId]) dragCounterRef.current[dealId] = 0;
    dragCounterRef.current[dealId]++;
    // Don't highlight the source deal
    setDragOverDealId(prev => {
      // Need to check current draggedResume via closure - use functional approach
      return prev !== dealId ? dealId : prev;
    });
  }, []);

  const handleDragLeaveDeal = useCallback((e: React.DragEvent, dealId: string) => {
    e.preventDefault();
    e.stopPropagation();
    if (!dragCounterRef.current[dealId]) dragCounterRef.current[dealId] = 0;
    dragCounterRef.current[dealId]--;
    if (dragCounterRef.current[dealId] <= 0) {
      dragCounterRef.current[dealId] = 0;
      setDragOverDealId(prev => prev === dealId ? null : prev);
    }
  }, []);

  const handleDragOverDeal = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  }, []);

  const handleDropOnDeal = useCallback(async (e: React.DragEvent, targetDealId: string) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOverDealId(null);
    dragCounterRef.current = {};

    if (!draggedResume || dropping) return;
    const { resumeId, sourceDealId } = draggedResume;
    
    // Don't drop on the same deal
    if (sourceDealId === targetDealId) {
      setDraggedResume(null);
      return;
    }

    setDropping(true);
    const toastId = toast.loading(t('resumes.groupedView.moving', 'Déplacement du CV...'));

    try {
      // 1. Add to target deal
      const addOptions = await createAuthOptionsWithCsrf({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resumeId })
      });
      const addResponse = await fetchWithAuth(`/api/deals/${targetDealId}/resumes`, addOptions);
      
      if (!addResponse.ok) {
        const error = await addResponse.json();
        throw new Error(error.error || 'Failed to add resume to deal');
      }

      // 2. Remove from source deal (if it was in one)
      if (sourceDealId) {
        const removeOptions = await createAuthOptionsWithCsrf({ method: 'DELETE' });
        const removeResponse = await fetchWithAuth(`/api/deals/${sourceDealId}/resumes/${resumeId}`, removeOptions);
        if (!removeResponse.ok) {
          logger.warn('Failed to remove resume from source deal, but it was added to target');
        }
      }

      // Find target deal name for toast
      const targetDeal = data?.deals.find((d: DealGroup) => d.id === targetDealId);
      toast.success(
        sourceDealId 
          ? t('resumes.groupedView.moved', 'CV déplacé vers « {{deal}} »').replace('{{deal}}', targetDeal?.title || '')
          : t('resumes.groupedView.added', 'CV ajouté à « {{deal}} »').replace('{{deal}}', targetDeal?.title || ''),
        { id: toastId }
      );
      markResumeDealRelationsDirty();

      // Refresh data
      await fetchGroupedData();
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Erreur';
      logger.error('Drag & drop error:', error);
      toast.error(t('resumes.groupedView.dropError', 'Erreur lors du déplacement') + ': ' + msg, { id: toastId });
    } finally {
      setDropping(false);
      setDraggedResume(null);
    }
  }, [draggedResume, dropping, data, fetchGroupedData, t]);

  return {
    draggedResume,
    dragOverDealId,
    dropping,
    handleDragStart,
    handleDragEnd,
    handleDragEnterDeal,
    handleDragLeaveDeal,
    handleDragOverDeal,
    handleDropOnDeal
  };
}

/**
 * useKeyboardShortcuts Hook
 * Manages keyboard shortcuts for common actions
 */

import { useEffect, useCallback } from 'react';

type KeyModifier = 'ctrl' | 'alt' | 'shift' | 'meta';

interface ShortcutConfig {
  key: string;
  modifiers?: KeyModifier[];
  action: () => void;
  description: string;
  enabled?: boolean;
}

interface UseKeyboardShortcutsOptions {
  enabled?: boolean;
  preventDefault?: boolean;
}

/**
 * Hook to register keyboard shortcuts
 */
export function useKeyboardShortcuts(
  shortcuts: ShortcutConfig[],
  options: UseKeyboardShortcutsOptions = {}
): void {
  const { enabled = true, preventDefault = true } = options;

  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    if (!enabled) return;

    // Don't trigger shortcuts when typing in inputs
    const target = event.target as HTMLElement;
    if (
      target.tagName === 'INPUT' ||
      target.tagName === 'TEXTAREA' ||
      target.isContentEditable
    ) {
      return;
    }

    for (const shortcut of shortcuts) {
      if (shortcut.enabled === false) continue;

      const keyMatch = event.key.toLowerCase() === shortcut.key.toLowerCase();
      const modifiers = shortcut.modifiers || [];

      const ctrlMatch = modifiers.includes('ctrl') === (event.ctrlKey || event.metaKey);
      const altMatch = modifiers.includes('alt') === event.altKey;
      const shiftMatch = modifiers.includes('shift') === event.shiftKey;

      if (keyMatch && ctrlMatch && altMatch && shiftMatch) {
        if (preventDefault) {
          event.preventDefault();
        }
        shortcut.action();
        return;
      }
    }
  }, [shortcuts, enabled, preventDefault]);

  useEffect(() => {
    if (enabled) {
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    }
  }, [handleKeyDown, enabled]);
}

/**
 * Common shortcuts configuration
 */
export const createCommonShortcuts = (actions: {
  onSave?: () => void;
  onNew?: () => void;
  onSearch?: () => void;
  onRefresh?: () => void;
  onEscape?: () => void;
  onHelp?: () => void;
}): ShortcutConfig[] => {
  const shortcuts: ShortcutConfig[] = [];

  if (actions.onSave) {
    shortcuts.push({
      key: 's',
      modifiers: ['ctrl'],
      action: actions.onSave,
      description: 'Sauvegarder'
    });
  }

  if (actions.onNew) {
    shortcuts.push({
      key: 'n',
      modifiers: ['ctrl'],
      action: actions.onNew,
      description: 'Nouveau'
    });
  }

  if (actions.onSearch) {
    shortcuts.push({
      key: 'k',
      modifiers: ['ctrl'],
      action: actions.onSearch,
      description: 'Rechercher'
    });
  }

  if (actions.onRefresh) {
    shortcuts.push({
      key: 'r',
      modifiers: ['ctrl', 'shift'],
      action: actions.onRefresh,
      description: 'Actualiser'
    });
  }

  if (actions.onEscape) {
    shortcuts.push({
      key: 'Escape',
      action: actions.onEscape,
      description: 'Fermer / Annuler'
    });
  }

  if (actions.onHelp) {
    shortcuts.push({
      key: '?',
      modifiers: ['shift'],
      action: actions.onHelp,
      description: 'Aide'
    });
  }

  return shortcuts;
};

/**
 * Format shortcut for display
 */
export const formatShortcut = (shortcut: ShortcutConfig): string => {
  const parts: string[] = [];
  const modifiers = shortcut.modifiers || [];

  if (modifiers.includes('ctrl') || modifiers.includes('meta')) {
    parts.push('Ctrl');
  }
  if (modifiers.includes('alt')) {
    parts.push('Alt');
  }
  if (modifiers.includes('shift')) {
    parts.push('Shift');
  }

  // Format special keys
  let keyDisplay = shortcut.key;
  if (shortcut.key === 'Escape') keyDisplay = 'Esc';
  if (shortcut.key === ' ') keyDisplay = 'Space';
  if (shortcut.key.length === 1) keyDisplay = shortcut.key.toUpperCase();

  parts.push(keyDisplay);

  return parts.join(' + ');
};

export default useKeyboardShortcuts;

import type { Editor } from '@tiptap/react';

export const HEADING_LEVELS = [1, 2, 3, 4, 5] as const;

export const HEADING_LABELS: Record<number, string> = {
  1: 'Titre 1',
  2: 'Titre 2',
  3: 'Titre 3',
  4: 'Titre 4',
  5: 'Titre 5',
};

export const HEADING_SIZES: Record<number, string> = {
  1: '1.4em',
  2: '1.2em',
  3: '1.05em',
  4: '0.95em',
  5: '0.85em',
};

export const COLORS = [
  '#000000', '#434343', '#666666', '#999999', '#b7b7b7', '#cccccc', '#d9d9d9', '#efefef', '#f3f3f3', '#ffffff',
  '#980000', '#ff0000', '#ff9900', '#ffff00', '#00ff00', '#00ffff', '#4a86e8', '#0000ff', '#9900ff', '#ff00ff',
  '#e6b8af', '#f4cccc', '#fce5cd', '#fff2cc', '#d9ead3', '#d0e0e3', '#c9daf8', '#cfe2f3', '#d9d2e9', '#ead1dc',
  '#dd7e6b', '#ea9999', '#f9cb9c', '#ffe599', '#b6d7a8', '#a2c4c9', '#a4c2f4', '#9fc5e8', '#b4a7d6', '#d5a6bd',
] as const;

export const TABLE_GRID_SIZE = 8;

export const TABLE_SIZE_PRESETS = [
  [2, 2],
  [3, 3],
  [4, 4],
  [5, 5],
] as const;

export const TABLE_TABS = [
  ['structure', 'Structure'],
  ['cell', 'Cellule'],
  ['table', 'Tableau'],
] as const;

export const CELL_BG_COLORS = [
  '#ffffff', '#f9fafb', '#f3f4f6', '#e5e7eb',
  '#dbeafe', '#bfdbfe', '#93c5fd',
  '#dcfce7', '#bbf7d0', '#86efac',
  '#fef9c3', '#fde68a', '#fcd34d',
  '#fee2e2', '#fecaca', '#fca5a5',
  '#f3e8ff', '#e9d5ff', '#d8b4fe',
  '#e0e7ff', '#c7d2fe', '#a5b4fc',
  '#ccfbf1', '#99f6e4', '#5eead4',
] as const;

export const CELL_BORDER_COLORS = [
  '#d1d5db',
  '#9ca3af',
  '#6b7280',
  '#374151',
  '#111827',
  '#3b82f6',
  '#ef4444',
  '#10b981',
] as const;

export const CELL_PADDING_PRESETS = [
  '2px 4px',
  '6px 10px',
  '10px 14px',
  '14px 20px',
] as const;

export const BORDER_WIDTH_PRESETS = ['1px', '2px', '3px'] as const;

export const TABLE_BORDER_WIDTH_PRESETS = [null, '1px', '2px', '3px', '4px'] as const;

export const VALIGN_OPTIONS = [
  { value: 'top', label: 'Haut', icon: 'â†‘' },
  { value: 'middle', label: 'Milieu', icon: 'â†•' },
  { value: 'bottom', label: 'Bas', icon: 'â†“' },
] as const;

export const TEXTALIGN_OPTIONS = [
  { value: 'left', label: 'Gauche' },
  { value: 'center', label: 'Centre' },
  { value: 'right', label: 'Droite' },
] as const;

export const TABLE_WIDTH_PRESETS = [
  { value: null, label: 'Auto' },
  { value: '50%', label: '50%' },
  { value: '75%', label: '75%' },
  { value: '100%', label: '100%' },
] as const;

export const BORDER_STYLE_OPTIONS = [
  { value: null, label: 'DÃ©faut' },
  { value: 'solid', label: 'Plein' },
  { value: 'dashed', label: 'Tirets' },
  { value: 'dotted', label: 'Points' },
  { value: 'double', label: 'Double' },
  { value: 'none', label: 'Aucune' },
] as const;

export const RESET_SWATCH_STYLE = {
  background: 'linear-gradient(135deg, #fff 45%, #ef4444 50%, #fff 55%)',
  width: 18,
  height: 18,
  border: '1px solid #d1d5db',
} as const;

export function getTableNode(editor: Editor) {
  const { $from } = editor.state.selection;
  for (let depth = $from.depth; depth > 0; depth--) {
    if ($from.node(depth).type.name === 'table') return $from.node(depth);
  }
  return null;
}

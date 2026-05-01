/**
 * TableToolbar - Contextual toolbar shown below the main toolbar when cursor is inside a table.
 * Mirrors the ImageToolbar pattern: rendered outside the overflow container for reliable display.
 * Consolidates structure actions, cell properties, and table-level properties.
 */

import type { Editor } from '@tiptap/react';
import { useState, useCallback, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
type TableAttributeCommands = {
  setTableAttribute: (attr: string, value: unknown) => boolean;
};

interface TableToolbarProps {
  editor: Editor;
}

type TablePanel = 'quick' | 'cell' | 'table';

// ============================================
// CONSTANTS
// ============================================

const CELL_BG_COLORS = [
  '#ffffff', '#f9fafb', '#f3f4f6', '#e5e7eb',
  '#dbeafe', '#bfdbfe', '#93c5fd',
  '#dcfce7', '#bbf7d0', '#86efac',
  '#fef9c3', '#fde68a', '#fcd34d',
  '#fee2e2', '#fecaca', '#fca5a5',
  '#f3e8ff', '#e9d5ff', '#d8b4fe',
  '#e0e7ff', '#c7d2fe', '#a5b4fc',
  '#ccfbf1', '#99f6e4', '#5eead4',
];

const CELL_BORDER_COLORS = [
  '#d1d5db', '#9ca3af', '#6b7280', '#374151', '#111827',
  '#3b82f6', '#ef4444', '#10b981',
];

const VALIGN_OPTIONS = [
  { value: 'top', label: 'Haut', icon: '↑' },
  { value: 'middle', label: 'Milieu', icon: '↕' },
  { value: 'bottom', label: 'Bas', icon: '↓' },
] as const;

const TEXTALIGN_OPTIONS = [
  { value: 'left', label: 'Gauche', icon: '⫷' },
  { value: 'center', label: 'Centre', icon: '⫼' },
  { value: 'right', label: 'Droite', icon: '⫸' },
] as const;

const TABLE_WIDTH_PRESETS = [
  { value: null, label: 'Auto' },
  { value: '50%', label: '50%' },
  { value: '75%', label: '75%' },
  { value: '100%', label: '100%' },
] as const;

const BORDER_STYLE_OPTIONS = [
  { value: null, label: 'Défaut' },
  { value: 'solid', label: 'Plein' },
  { value: 'dashed', label: 'Tirets' },
  { value: 'dotted', label: 'Points' },
  { value: 'double', label: 'Double' },
  { value: 'none', label: 'Aucune' },
] as const;

// ============================================
// HELPERS
// ============================================

const getTableNode = (editor: Editor) => {
  const { $from } = editor.state.selection;
  for (let d = $from.depth; d > 0; d--) {
    if ($from.node(d).type.name === 'table') return $from.node(d);
  }
  return null;
};

const TB = ({ onClick, isActive, title, children, className = '' }: {
  onClick: () => void;
  isActive?: boolean;
  title: string;
  children: React.ReactNode;
  className?: string;
}) => (
  <button
    type="button"
    onClick={onClick}
    title={title}
    className={`tiptap-toolbar-btn ${isActive ? 'is-active' : ''} ${className}`}
  >
    {children}
  </button>
);

// ============================================
// COMPONENT
// ============================================

export const TableToolbar = ({ editor }: TableToolbarProps) => {
  const { t } = useTranslation();
  const [isInTable, setIsInTable] = useState(false);
  const [panel, setPanel] = useState<TablePanel>('quick');

  // Track table presence
  useEffect(() => {
    const check = () => {
      const inTable = editor.isActive('table');
      setIsInTable(inTable);
      if (!inTable) setPanel('quick');
    };

    editor.on('selectionUpdate', check);
    check();

    return () => {
      editor.off('selectionUpdate', check);
    };
  }, [editor]);

  const setTableAttr = useCallback((attr: string, value: unknown) => {
    editor
      .chain()
      .focus()
      .command(({ commands }) => (
        commands as typeof commands & TableAttributeCommands
      ).setTableAttribute(attr, value))
      .run();
  }, [editor]);

  const setCellAttr = useCallback((attr: string, value: unknown) => {
    editor.chain().focus().setCellAttribute(attr, value).run();
  }, [editor]);

  if (!isInTable) return null;

  const tableNode = getTableNode(editor);

  return (
    <div className="tiptap-table-toolbar">
      {/* ---- Tab switcher ---- */}
      <div className="tiptap-table-toolbar-tabs">
        {([['quick', 'Structure'], ['cell', 'Cellule'], ['table', 'Tableau']] as const).map(([key, label]) => (
          <button
            key={key}
            type="button"
            className={`tiptap-table-toolbar-tab ${panel === key ? 'is-active' : ''}`}
            aria-pressed={panel === key}
            onClick={() => setPanel(key as TablePanel)}
          >
            {label}
          </button>
        ))}

        {/* Delete table always visible on the right */}
        <div style={{ marginLeft: 'auto' }}>
          <TB onClick={() => editor.chain().focus().deleteTable().run()} title={t('tiptap.table.deleteTable')} className="tiptap-image-toolbar-danger">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
          </TB>
        </div>
      </div>

      {/* ================================================================
          STRUCTURE TAB
          ================================================================ */}
      {panel === 'quick' && (
        <div className="tiptap-table-toolbar-row">
          {/* Rows */}
          <span className="tiptap-image-toolbar-label">Lignes</span>
          <TB onClick={() => editor.chain().focus().addRowBefore().run()} title={t('tiptap.table.addRowBefore')}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="12" y1="3" x2="12" y2="12"/><line x1="12" y1="6" x2="12" y2="9"/><line x1="10.5" y1="7.5" x2="13.5" y2="7.5"/></svg>
          </TB>
          <TB onClick={() => editor.chain().focus().addRowAfter().run()} title={t('tiptap.table.addRowAfter')}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="12" y1="12" x2="12" y2="21"/><line x1="12" y1="15" x2="12" y2="18"/><line x1="10.5" y1="16.5" x2="13.5" y2="16.5"/></svg>
          </TB>
          <TB onClick={() => editor.chain().focus().deleteRow().run()} title={t('tiptap.table.deleteRow')} className="tiptap-image-toolbar-danger">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="9" y1="7.5" x2="15" y2="7.5"/></svg>
          </TB>

          <div className="tiptap-toolbar-divider" />

          {/* Columns */}
          <span className="tiptap-image-toolbar-label">Colonnes</span>
          <TB onClick={() => editor.chain().focus().addColumnBefore().run()} title={t('tiptap.table.addColumnBefore')}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="12" y1="3" x2="12" y2="21"/><line x1="3" y1="12" x2="12" y2="12"/><line x1="6" y1="12" x2="9" y2="12"/><line x1="7.5" y1="10.5" x2="7.5" y2="13.5"/></svg>
          </TB>
          <TB onClick={() => editor.chain().focus().addColumnAfter().run()} title={t('tiptap.table.addColumnAfter')}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="12" y1="3" x2="12" y2="21"/><line x1="12" y1="12" x2="21" y2="12"/><line x1="15" y1="12" x2="18" y2="12"/><line x1="16.5" y1="10.5" x2="16.5" y2="13.5"/></svg>
          </TB>
          <TB onClick={() => editor.chain().focus().deleteColumn().run()} title={t('tiptap.table.deleteColumn')} className="tiptap-image-toolbar-danger">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="12" y1="3" x2="12" y2="21"/><line x1="16.5" y1="9" x2="16.5" y2="15"/></svg>
          </TB>

          <div className="tiptap-toolbar-divider" />

          {/* Cells / Headers */}
          <span className="tiptap-image-toolbar-label">Cellules</span>
          <TB onClick={() => editor.chain().focus().mergeCells().run()} title="Fusionner">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M9 3v18"/><path d="M15 3v18"/><path d="M9 12h6"/><path d="M12 9l3 3-3 3"/></svg>
          </TB>
          <TB onClick={() => editor.chain().focus().splitCell().run()} title="Diviser">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M12 3v18"/><path d="M9 9l-3 3 3 3"/><path d="M15 9l3 3-3 3"/></svg>
          </TB>
          <TB onClick={() => editor.chain().focus().toggleHeaderRow().run()} title="Basculer ligne d'en-tête">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/><rect x="4" y="4" width="16" height="4" rx="0.5" fill="currentColor" opacity="0.25"/></svg>
          </TB>
          <TB onClick={() => editor.chain().focus().toggleHeaderColumn().run()} title="Basculer colonne d'en-tête">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="9" y1="3" x2="9" y2="21"/><rect x="4" y="4" width="4" height="16" rx="0.5" fill="currentColor" opacity="0.25"/></svg>
          </TB>
        </div>
      )}

      {/* ================================================================
          CELL PROPERTIES TAB
          ================================================================ */}
      {panel === 'cell' && (
        <div className="tiptap-table-toolbar-props">
          {/* Background color */}
          <div className="tiptap-table-toolbar-prop-group">
            <span className="tiptap-image-toolbar-label">Fond</span>
            <div className="tiptap-table-toolbar-colors">
              {CELL_BG_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  className="tiptap-table-toolbar-swatch"
                  style={{ background: c }}
                  title={c}
                  onClick={() => setCellAttr('backgroundColor', c)}
                />
              ))}
              <button
                type="button"
                className="tiptap-table-toolbar-swatch tiptap-table-toolbar-swatch-reset"
                title={t('common.delete')}
                onClick={() => setCellAttr('backgroundColor', null)}
              />
            </div>
          </div>

          <div className="tiptap-toolbar-divider" />

          {/* Vertical align */}
          <div className="tiptap-table-toolbar-prop-group">
            <span className="tiptap-image-toolbar-label">V-Align</span>
            <div className="tiptap-image-toolbar-btn-row">
              {VALIGN_OPTIONS.map((opt) => (
                <button key={opt.value} type="button" className="tiptap-props-btn" title={opt.label}
                  onClick={() => setCellAttr('verticalAlign', opt.value)}>
                  {opt.icon}
                </button>
              ))}
            </div>
          </div>

          <div className="tiptap-toolbar-divider" />

          {/* Text align */}
          <div className="tiptap-table-toolbar-prop-group">
            <span className="tiptap-image-toolbar-label">Texte</span>
            <div className="tiptap-image-toolbar-btn-row">
              {TEXTALIGN_OPTIONS.map((opt) => (
                <button key={opt.value} type="button" className="tiptap-props-btn" title={opt.label}
                  onClick={() => setCellAttr('textAlign', opt.value)}>
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <div className="tiptap-toolbar-divider" />

          {/* Padding */}
          <div className="tiptap-table-toolbar-prop-group">
            <span className="tiptap-image-toolbar-label">Padding</span>
            <div className="tiptap-image-toolbar-btn-row">
              {[['2px 4px', '2px'], ['6px 10px', '6px'], ['10px 14px', '10px'], ['14px 20px', '14px']].map(([v, l]) => (
                <button key={v} type="button" className="tiptap-props-btn"
                  onClick={() => setCellAttr('cellPadding', v)}>{l}</button>
              ))}
              <button type="button" className="tiptap-props-btn" style={{ color: '#9ca3af' }}
                onClick={() => setCellAttr('cellPadding', null)}>×</button>
            </div>
          </div>

          <div className="tiptap-toolbar-divider" />

          {/* Cell border */}
          <div className="tiptap-table-toolbar-prop-group">
            <span className="tiptap-image-toolbar-label">Bordure</span>
            <div className="tiptap-table-toolbar-colors">
              {CELL_BORDER_COLORS.map((c) => (
                <button key={c} type="button" className="tiptap-table-toolbar-swatch" style={{ background: c }} title={c}
                  onClick={() => setCellAttr('borderColor', c)} />
              ))}
              <button type="button" className="tiptap-table-toolbar-swatch tiptap-table-toolbar-swatch-reset" title="Réinitialiser"
                onClick={() => setCellAttr('borderColor', null)} />
            </div>
            <div className="tiptap-image-toolbar-btn-row" style={{ marginTop: 2 }}>
              {['1px', '2px', '3px'].map((w) => (
                <button key={w} type="button" className="tiptap-props-btn"
                  onClick={() => setCellAttr('borderWidth', w)}>{w}</button>
              ))}
              <button type="button" className="tiptap-props-btn" style={{ color: '#9ca3af' }}
                onClick={() => setCellAttr('borderWidth', null)}>×</button>
            </div>
          </div>
        </div>
      )}

      {/* ================================================================
          TABLE PROPERTIES TAB
          ================================================================ */}
      {panel === 'table' && (
        <div className="tiptap-table-toolbar-props">
          {/* Width */}
          <div className="tiptap-table-toolbar-prop-group">
            <span className="tiptap-image-toolbar-label">Largeur</span>
            <div className="tiptap-image-toolbar-btn-row">
              {TABLE_WIDTH_PRESETS.map((opt) => (
                <button key={opt.label} type="button"
                  className={`tiptap-props-btn ${tableNode?.attrs.tableWidth === opt.value ? 'is-active' : ''}`}
                  onClick={() => setTableAttr('tableWidth', opt.value)}>
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <div className="tiptap-toolbar-divider" />

          {/* Border style */}
          <div className="tiptap-table-toolbar-prop-group">
            <span className="tiptap-image-toolbar-label">Bordure</span>
            <div className="tiptap-image-toolbar-btn-row">
              {BORDER_STYLE_OPTIONS.map((opt) => (
                <button key={opt.label} type="button"
                  className={`tiptap-props-btn ${tableNode?.attrs.tableBorderStyle === opt.value ? 'is-active' : ''}`}
                  onClick={() => setTableAttr('tableBorderStyle', opt.value)}>
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <div className="tiptap-toolbar-divider" />

          {/* Border color */}
          <div className="tiptap-table-toolbar-prop-group">
            <span className="tiptap-image-toolbar-label">Couleur</span>
            <div className="tiptap-table-toolbar-colors">
              {CELL_BORDER_COLORS.map((c) => (
                <button key={c} type="button" className="tiptap-table-toolbar-swatch" style={{ background: c }} title={c}
                  onClick={() => setTableAttr('tableBorderColor', c)} />
              ))}
              <button type="button" className="tiptap-table-toolbar-swatch tiptap-table-toolbar-swatch-reset" title="Réinitialiser"
                onClick={() => setTableAttr('tableBorderColor', null)} />
            </div>
          </div>

          {/* Border width */}
          <div className="tiptap-table-toolbar-prop-group">
            <span className="tiptap-image-toolbar-label">Épaisseur</span>
            <div className="tiptap-image-toolbar-btn-row">
              {[null, '1px', '2px', '3px', '4px'].map((w) => (
                <button key={w ?? 'auto'} type="button"
                  className={`tiptap-props-btn ${tableNode?.attrs.tableBorderWidth === w ? 'is-active' : ''}`}
                  onClick={() => setTableAttr('tableBorderWidth', w)}>
                  {w ?? 'Auto'}
                </button>
              ))}
            </div>
          </div>

          <div className="tiptap-toolbar-divider" />

          {/* Layout */}
          <div className="tiptap-table-toolbar-prop-group">
            <span className="tiptap-image-toolbar-label">Disposition</span>
            <div className="tiptap-image-toolbar-btn-row">
              <button type="button"
                className={`tiptap-props-btn ${!tableNode?.attrs.tableLayout ? 'is-active' : ''}`}
                onClick={() => setTableAttr('tableLayout', null)}>Auto</button>
              <button type="button"
                className={`tiptap-props-btn ${tableNode?.attrs.tableLayout === 'fixed' ? 'is-active' : ''}`}
                onClick={() => setTableAttr('tableLayout', 'fixed')}>Fixe</button>
            </div>
          </div>

          <div className="tiptap-toolbar-divider" />

          {/* Striped rows */}
          <div className="tiptap-table-toolbar-prop-group">
            <span className="tiptap-image-toolbar-label">Alternées</span>
            <TB
              onClick={() => setTableAttr('stripedRows', !tableNode?.attrs.stripedRows)}
              isActive={!!tableNode?.attrs.stripedRows}
              title="Lignes alternées"
            >
              {tableNode?.attrs.stripedRows ? '✓ Oui' : 'Non'}
            </TB>
          </div>
        </div>
      )}
    </div>
  );
};

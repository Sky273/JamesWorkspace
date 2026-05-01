import type { Editor } from '@tiptap/react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  BORDER_STYLE_OPTIONS,
  BORDER_WIDTH_PRESETS,
  CELL_BG_COLORS,
  CELL_BORDER_COLORS,
  CELL_PADDING_PRESETS,
  getTableNode,
  RESET_SWATCH_STYLE,
  TABLE_BORDER_WIDTH_PRESETS,
  TABLE_GRID_SIZE,
  TABLE_SIZE_PRESETS,
  TABLE_TABS,
  TABLE_WIDTH_PRESETS,
  TEXTALIGN_OPTIONS,
  VALIGN_OPTIONS,
} from './EditorToolbar.data';
import { Dropdown } from './EditorToolbar.dropdown';

type TableAttributeCommands = {
  setTableAttribute: (attr: string, value: unknown) => boolean;
};

type TableTab = 'structure' | 'cell' | 'table';

interface TableTabProps {
  editor: Editor;
  close: () => void;
}

const runTableAttributeCommand = (editor: Editor, attr: string, value: unknown) => {
  editor
    .chain()
    .focus()
    .command(({ commands }) => (
      commands as typeof commands & TableAttributeCommands
    ).setTableAttribute(attr, value))
    .run();
};

const TableGridPicker = ({ onSelect }: { onSelect: (rows: number, cols: number) => void }) => {
  const { t } = useTranslation();
  const [hovered, setHovered] = useState({ r: 0, c: 0 });

  return (
    <div style={{ padding: '4px 10px 8px' }}>
      <div className="tiptap-grid-picker">
        {Array.from({ length: TABLE_GRID_SIZE }, (_, row) => (
          <div key={row} className="tiptap-grid-row">
            {Array.from({ length: TABLE_GRID_SIZE }, (_, col) => (
              <div
                key={col}
                role="button"
                tabIndex={0}
                className={`tiptap-grid-cell ${row < hovered.r && col < hovered.c ? 'is-selected' : ''}`}
                onMouseEnter={() => setHovered({ r: row + 1, c: col + 1 })}
                onClick={() => onSelect(hovered.r, hovered.c)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    onSelect(row + 1, col + 1);
                  }
                }}
              />
            ))}
          </div>
        ))}
      </div>
      <div style={{ textAlign: 'center', fontSize: 11, color: '#9ca3af', marginTop: 4 }}>
        {hovered.r > 0 ? `${hovered.r} x ${hovered.c}` : t('tiptap.table.hoverToChoose')}
      </div>
    </div>
  );
};

const TableInsertPanel = ({ editor, close }: TableTabProps) => {
  const { t } = useTranslation();

  return (
  <>
    <div className="tiptap-dropdown-section">{t('tiptap.table.insertTable')}</div>
    <TableGridPicker
      onSelect={(rows, cols) => {
        editor.chain().focus().insertTable({ rows, cols, withHeaderRow: true }).run();
        close();
      }}
    />
    <div className="tiptap-dropdown-section">{t('tiptap.table.presets')}</div>
    {TABLE_SIZE_PRESETS.map(([rows, cols]) => (
      <button
        key={`${rows}x${cols}`}
        type="button"
        className="tiptap-dropdown-item"
        onClick={() => {
          editor.chain().focus().insertTable({ rows, cols, withHeaderRow: true }).run();
          close();
        }}
      >
        {t('tiptap.table.tableSize', { rows, cols })}
      </button>
    ))}
  </>
  );
};

const TableStructureTab = ({ editor, close }: TableTabProps) => {
  const { t } = useTranslation();

  return (
  <>
    <div className="tiptap-dropdown-section">{t('tiptap.table.rows')}</div>
    <button type="button" className="tiptap-dropdown-item" onClick={() => { editor.chain().focus().addRowBefore().run(); close(); }}>
      {t('tiptap.table.addRowBefore')}
    </button>
    <button type="button" className="tiptap-dropdown-item" onClick={() => { editor.chain().focus().addRowAfter().run(); close(); }}>
      {t('tiptap.table.addRowAfter')}
    </button>
    <button type="button" className="tiptap-dropdown-item tiptap-dropdown-danger" onClick={() => { editor.chain().focus().deleteRow().run(); close(); }}>
      {t('tiptap.table.deleteRow')}
    </button>

    <div className="tiptap-dropdown-section">{t('tiptap.table.columns')}</div>
    <button type="button" className="tiptap-dropdown-item" onClick={() => { editor.chain().focus().addColumnBefore().run(); close(); }}>
      {t('tiptap.table.addColumnBefore')}
    </button>
    <button type="button" className="tiptap-dropdown-item" onClick={() => { editor.chain().focus().addColumnAfter().run(); close(); }}>
      {t('tiptap.table.addColumnAfter')}
    </button>
    <button type="button" className="tiptap-dropdown-item tiptap-dropdown-danger" onClick={() => { editor.chain().focus().deleteColumn().run(); close(); }}>
      {t('tiptap.table.deleteColumn')}
    </button>

    <div className="tiptap-dropdown-section">{t('tiptap.table.cells')}</div>
    <button type="button" className="tiptap-dropdown-item" onClick={() => { editor.chain().focus().mergeCells().run(); close(); }}>
      {t('tiptap.table.mergeCells')}
    </button>
    <button type="button" className="tiptap-dropdown-item" onClick={() => { editor.chain().focus().splitCell().run(); close(); }}>
      {t('tiptap.table.splitCell')}
    </button>
    <button type="button" className="tiptap-dropdown-item" onClick={() => { editor.chain().focus().toggleHeaderRow().run(); close(); }}>
      {t('tiptap.table.toggleHeaderRow')}
    </button>
    <button type="button" className="tiptap-dropdown-item" onClick={() => { editor.chain().focus().toggleHeaderColumn().run(); close(); }}>
      {t('tiptap.table.toggleHeaderColumn')}
    </button>
  </>
  );
};

const TableCellTab = ({ editor }: Omit<TableTabProps, 'close'>) => {
  const { t } = useTranslation();

  return (
  <div className="tiptap-props-panel">
    <div className="tiptap-props-section">
      <div className="tiptap-props-label">{t('tiptap.table.backgroundColor')}</div>
      <div className="tiptap-dropdown-colors">
        {CELL_BG_COLORS.map((color) => (
          <button key={color} type="button" className="tiptap-color-swatch" style={{ background: color, width: 18, height: 18 }} title={color} onClick={() => editor.chain().focus().setCellAttribute('backgroundColor', color).run()} />
        ))}
        <button type="button" className="tiptap-color-swatch" style={RESET_SWATCH_STYLE} title={t('common.delete')} onClick={() => editor.chain().focus().setCellAttribute('backgroundColor', null).run()} />
      </div>
    </div>

    <div className="tiptap-props-section">
      <div className="tiptap-props-label">{t('tiptap.table.verticalAlign')}</div>
      <div className="tiptap-props-btn-group">
        {VALIGN_OPTIONS.map((option) => (
          <button key={option.value} type="button" className="tiptap-props-btn" title={option.label} onClick={() => editor.chain().focus().setCellAttribute('verticalAlign', option.value).run()}>
            {option.icon} {option.label}
          </button>
        ))}
      </div>
    </div>

    <div className="tiptap-props-section">
      <div className="tiptap-props-label">{t('tiptap.table.textAlign')}</div>
      <div className="tiptap-props-btn-group">
        {TEXTALIGN_OPTIONS.map((option) => (
          <button key={option.value} type="button" className="tiptap-props-btn" title={option.label} onClick={() => editor.chain().focus().setCellAttribute('textAlign', option.value).run()}>
            {option.label}
          </button>
        ))}
      </div>
    </div>

    <div className="tiptap-props-section">
      <div className="tiptap-props-label">Padding</div>
      <div className="tiptap-props-btn-group">
        {CELL_PADDING_PRESETS.map((padding) => (
          <button key={padding} type="button" className="tiptap-props-btn" onClick={() => editor.chain().focus().setCellAttribute('cellPadding', padding).run()}>
            {padding.split(' ')[0]}
          </button>
        ))}
        <button type="button" className="tiptap-props-btn" style={{ color: '#9ca3af' }} onClick={() => editor.chain().focus().setCellAttribute('cellPadding', null).run()}>
          Reset
        </button>
      </div>
    </div>

    <div className="tiptap-props-section">
      <div className="tiptap-props-label">Bordure de cellule</div>
      <div className="tiptap-dropdown-colors">
        {CELL_BORDER_COLORS.map((color) => (
          <button key={color} type="button" className="tiptap-color-swatch" style={{ background: color, width: 18, height: 18 }} title={color} onClick={() => editor.chain().focus().setCellAttribute('borderColor', color).run()} />
        ))}
        <button type="button" className="tiptap-color-swatch" style={RESET_SWATCH_STYLE} title="Réinitialiser" onClick={() => editor.chain().focus().setCellAttribute('borderColor', null).run()} />
      </div>
      <div className="tiptap-props-btn-group" style={{ marginTop: 4 }}>
        {BORDER_WIDTH_PRESETS.map((width) => (
          <button key={width} type="button" className="tiptap-props-btn" onClick={() => editor.chain().focus().setCellAttribute('borderWidth', width).run()}>
            {width}
          </button>
        ))}
        <button type="button" className="tiptap-props-btn" style={{ color: '#9ca3af' }} onClick={() => editor.chain().focus().setCellAttribute('borderWidth', null).run()}>
          Reset
        </button>
      </div>
    </div>
  </div>
  );
};

const TablePropertiesTab = ({ editor }: Omit<TableTabProps, 'close'>) => {
  const tableNode = getTableNode(editor);

  return (
    <div className="tiptap-props-panel">
      <div className="tiptap-props-section">
        <div className="tiptap-props-label">Largeur du tableau</div>
        <div className="tiptap-props-btn-group">
          {TABLE_WIDTH_PRESETS.map((option) => (
            <button key={option.label} type="button" className={`tiptap-props-btn ${tableNode?.attrs.tableWidth === option.value ? 'is-active' : ''}`} onClick={() => runTableAttributeCommand(editor, 'tableWidth', option.value)}>
              {option.label}
            </button>
          ))}
        </div>
      </div>

      <div className="tiptap-props-section">
        <div className="tiptap-props-label">Style de bordure</div>
        <div className="tiptap-props-btn-group">
          {BORDER_STYLE_OPTIONS.map((option) => (
            <button key={option.label} type="button" className={`tiptap-props-btn ${tableNode?.attrs.tableBorderStyle === option.value ? 'is-active' : ''}`} onClick={() => runTableAttributeCommand(editor, 'tableBorderStyle', option.value)}>
              {option.label}
            </button>
          ))}
        </div>
      </div>

      <div className="tiptap-props-section">
        <div className="tiptap-props-label">Couleur de bordure</div>
        <div className="tiptap-dropdown-colors">
          {CELL_BORDER_COLORS.map((color) => (
            <button key={color} type="button" className="tiptap-color-swatch" style={{ background: color, width: 18, height: 18 }} title={color} onClick={() => runTableAttributeCommand(editor, 'tableBorderColor', color)} />
          ))}
          <button type="button" className="tiptap-color-swatch" style={RESET_SWATCH_STYLE} title="Réinitialiser" onClick={() => runTableAttributeCommand(editor, 'tableBorderColor', null)} />
        </div>
      </div>

      <div className="tiptap-props-section">
        <div className="tiptap-props-label">Épaisseur de bordure</div>
        <div className="tiptap-props-btn-group">
          {TABLE_BORDER_WIDTH_PRESETS.map((width) => (
            <button key={width ?? 'default'} type="button" className={`tiptap-props-btn ${tableNode?.attrs.tableBorderWidth === width ? 'is-active' : ''}`} onClick={() => runTableAttributeCommand(editor, 'tableBorderWidth', width)}>
              {width ?? 'Auto'}
            </button>
          ))}
        </div>
      </div>

      <div className="tiptap-props-section">
        <div className="tiptap-props-label">Disposition</div>
        <div className="tiptap-props-btn-group">
          <button type="button" className={`tiptap-props-btn ${!tableNode?.attrs.tableLayout ? 'is-active' : ''}`} onClick={() => runTableAttributeCommand(editor, 'tableLayout', null)}>
            Auto
          </button>
          <button type="button" className={`tiptap-props-btn ${tableNode?.attrs.tableLayout === 'fixed' ? 'is-active' : ''}`} onClick={() => runTableAttributeCommand(editor, 'tableLayout', 'fixed')}>
            Fixe
          </button>
        </div>
      </div>

      <div className="tiptap-props-section">
        <div className="tiptap-props-label">Lignes alternées</div>
        <div className="tiptap-props-btn-group">
          <button type="button" className={`tiptap-props-btn ${tableNode?.attrs.stripedRows ? 'is-active' : ''}`} onClick={() => runTableAttributeCommand(editor, 'stripedRows', !tableNode?.attrs.stripedRows)}>
            {tableNode?.attrs.stripedRows ? 'Activé' : 'Désactivé'}
          </button>
        </div>
      </div>
    </div>
  );
};

export const TableMenu = ({ editor }: { editor: Editor }) => {
  const inTable = editor.isActive('table');
  const [activeTab, setActiveTab] = useState<TableTab>('structure');

  return (
    <Dropdown
      trigger={
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="3" y="3" width="18" height="18" rx="2" />
          <line x1="3" y1="9" x2="21" y2="9" />
          <line x1="3" y1="15" x2="21" y2="15" />
          <line x1="9" y1="3" x2="9" y2="21" />
          <line x1="15" y1="3" x2="15" y2="21" />
        </svg>
      }
      title="Tableau"
      isActive={inTable}
      autoClose={false}
    >
      {(close: () => void) => (
        <>
          {!inTable ? (
            <TableInsertPanel editor={editor} close={close} />
          ) : (
            <>
              <div className="tiptap-tab-bar">
                {TABLE_TABS.map(([key, label]) => (
                  <button key={key} type="button" className={`tiptap-tab-btn ${activeTab === key ? 'is-active' : ''}`} aria-pressed={activeTab === key} onClick={() => setActiveTab(key as TableTab)}>
                    {label}
                  </button>
                ))}
              </div>
              {activeTab === 'structure' && <TableStructureTab editor={editor} close={close} />}
              {activeTab === 'cell' && <TableCellTab editor={editor} />}
              {activeTab === 'table' && <TablePropertiesTab editor={editor} />}
              <div style={{ padding: '4px', borderTop: '1px solid var(--border, #e5e7eb)' }}>
                <button
                  type="button"
                  className="tiptap-dropdown-item tiptap-dropdown-danger"
                  onClick={() => {
                    editor.chain().focus().deleteTable().run();
                    close();
                  }}
                >
                  Supprimer le tableau
                </button>
              </div>
            </>
          )}
        </>
      )}
    </Dropdown>
  );
};

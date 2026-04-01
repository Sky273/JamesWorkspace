/**
 * EditorToolbar - Full toolbar primitives for TiptapEditor.
 */

import type { Editor } from '@tiptap/react';
import { useCallback, useState } from 'react';
import {
  BORDER_STYLE_OPTIONS,
  BORDER_WIDTH_PRESETS,
  CELL_BG_COLORS,
  CELL_BORDER_COLORS,
  CELL_PADDING_PRESETS,
  COLORS,
  getTableNode,
  HEADING_LABELS,
  HEADING_LEVELS,
  HEADING_SIZES,
  RESET_SWATCH_STYLE,
  TABLE_BORDER_WIDTH_PRESETS,
  TABLE_GRID_SIZE,
  TABLE_SIZE_PRESETS,
  TABLE_TABS,
  TABLE_WIDTH_PRESETS,
  TEXTALIGN_OPTIONS,
  VALIGN_OPTIONS,
} from './EditorToolbar.data';
import { useDismissiblePopover } from './EditorToolbar.hooks';

type TableAttributeCommands = {
  setTableAttribute: (attr: string, value: unknown) => boolean;
};

interface TBProps {
  onClick: () => void;
  isActive?: boolean;
  disabled?: boolean;
  title: string;
  children: React.ReactNode;
  className?: string;
}

export const TB = ({
  onClick,
  isActive,
  disabled,
  title,
  children,
  className = '',
}: TBProps) => (
  <button
    type="button"
    onClick={onClick}
    disabled={disabled}
    title={title}
    className={`tiptap-toolbar-btn ${isActive ? 'is-active' : ''} ${className}`}
  >
    {children}
  </button>
);

export const Divider = () => <div className="tiptap-toolbar-divider" />;

interface DropdownProps {
  trigger: React.ReactNode;
  title: string;
  children: React.ReactNode | ((close: () => void) => React.ReactNode);
  isActive?: boolean;
  autoClose?: boolean;
}

const Dropdown = ({
  trigger,
  title,
  children,
  isActive,
  autoClose = true,
}: DropdownProps) => {
  const { open, ref, close, toggle } = useDismissiblePopover<HTMLDivElement>();
  const content = typeof children === 'function' ? children(close) : children;

  return (
    <div className="tiptap-dropdown-wrapper" ref={ref}>
      <button
        type="button"
        className={`tiptap-toolbar-btn tiptap-dropdown-trigger ${isActive ? 'is-active' : ''}`}
        title={title}
        onClick={toggle}
      >
        {trigger}
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ marginLeft: 2 }}>
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>
      {open && (
        <div className="tiptap-dropdown-menu" onClick={autoClose ? close : undefined}>
          {content}
        </div>
      )}
    </div>
  );
};

export const HeadingDropdown = ({ editor }: { editor: Editor }) => {
  const activeLevel = HEADING_LEVELS.find((level) =>
    editor.isActive('heading', { level }),
  );
  const label = activeLevel ? `H${activeLevel}` : 'P';

  return (
    <Dropdown
      trigger={<span style={{ minWidth: 22, textAlign: 'center' }}>{label}</span>}
      title="Type de bloc"
      isActive={!!activeLevel}
    >
      <button
        type="button"
        className={`tiptap-dropdown-item ${!activeLevel ? 'is-active' : ''}`}
        onClick={() => editor.chain().focus().setParagraph().run()}
      >
        <span style={{ fontSize: '0.9em' }}>P</span> Paragraphe
      </button>
      {HEADING_LEVELS.map((level) => (
        <button
          key={level}
          type="button"
          className={`tiptap-dropdown-item ${editor.isActive('heading', { level }) ? 'is-active' : ''}`}
          onClick={() => editor.chain().focus().toggleHeading({ level }).run()}
        >
          <span style={{ fontSize: HEADING_SIZES[level], fontWeight: 700 }}>H{level}</span>{' '}
          {HEADING_LABELS[level]}
        </button>
      ))}
    </Dropdown>
  );
};

interface ColorPickerProps {
  editor: Editor;
  type: 'text' | 'highlight';
}

export const ColorPicker = ({ editor, type }: ColorPickerProps) => {
  const { open, ref, close, toggle } = useDismissiblePopover<HTMLDivElement>();

  const applyColor = useCallback(
    (color: string) => {
      if (type === 'text') editor.chain().focus().setColor(color).run();
      else editor.chain().focus().toggleHighlight({ color }).run();
      close();
    },
    [close, editor, type],
  );

  return (
    <div className="tiptap-color-picker-wrapper" ref={ref}>
      <button
        type="button"
        className="tiptap-toolbar-btn"
        title={type === 'text' ? 'Couleur de texte' : 'Surlignage'}
        onClick={toggle}
      >
        {type === 'text' ? (
          <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', lineHeight: 1 }}>
            <span style={{ fontSize: 14 }}>A</span>
            <span
              style={{
                width: 14,
                height: 3,
                background: editor.getAttributes('textStyle').color || '#000',
                borderRadius: 1,
              }}
            />
          </span>
        ) : (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 20h9" />
            <path d="m16.376 3.622 4.002 4.002-12.748 12.748H3.628v-4.002z" />
          </svg>
        )}
      </button>
      {open && (
        <div className="tiptap-color-picker-dropdown">
          {COLORS.map((color) => (
            <button
              key={color}
              type="button"
              className="tiptap-color-swatch"
              style={{ background: color }}
              title={color}
              onClick={() => applyColor(color)}
            />
          ))}
          <button
            type="button"
            className="tiptap-color-reset"
            onClick={() => {
              if (type === 'text') editor.chain().focus().unsetColor().run();
              else editor.chain().focus().unsetHighlight().run();
              close();
            }}
          >
            {type === 'text' ? 'Reinitialiser' : 'Supprimer'}
          </button>
        </div>
      )}
    </div>
  );
};

const TableGridPicker = ({ onSelect }: { onSelect: (rows: number, cols: number) => void }) => {
  const [hovered, setHovered] = useState({ r: 0, c: 0 });

  return (
    <div style={{ padding: '4px 10px 8px' }}>
      <div className="tiptap-grid-picker">
        {Array.from({ length: TABLE_GRID_SIZE }, (_, row) => (
          <div key={row} className="tiptap-grid-row">
            {Array.from({ length: TABLE_GRID_SIZE }, (_, col) => (
              <div
                key={col}
                className={`tiptap-grid-cell ${row < hovered.r && col < hovered.c ? 'is-selected' : ''}`}
                onMouseEnter={() => setHovered({ r: row + 1, c: col + 1 })}
                onClick={() => onSelect(hovered.r, hovered.c)}
              />
            ))}
          </div>
        ))}
      </div>
      <div style={{ textAlign: 'center', fontSize: 11, color: '#9ca3af', marginTop: 4 }}>
        {hovered.r > 0 ? `${hovered.r} x ${hovered.c}` : 'Survolez pour choisir'}
      </div>
    </div>
  );
};

type TableTab = 'structure' | 'cell' | 'table';

interface TableTabProps {
  editor: Editor;
  close: () => void;
}

const TableInsertPanel = ({ editor, close }: TableTabProps) => (
  <>
    <div className="tiptap-dropdown-section">Inserer un tableau</div>
    <TableGridPicker
      onSelect={(rows, cols) => {
        editor.chain().focus().insertTable({ rows, cols, withHeaderRow: true }).run();
        close();
      }}
    />
    <div className="tiptap-dropdown-section">Tailles predefinies</div>
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
        Tableau {rows}x{cols}
      </button>
    ))}
  </>
);

const TableStructureTab = ({ editor, close }: TableTabProps) => (
  <>
    <div className="tiptap-dropdown-section">Lignes</div>
    <button type="button" className="tiptap-dropdown-item" onClick={() => { editor.chain().focus().addRowBefore().run(); close(); }}>
      Ajouter ligne au-dessus
    </button>
    <button type="button" className="tiptap-dropdown-item" onClick={() => { editor.chain().focus().addRowAfter().run(); close(); }}>
      Ajouter ligne en-dessous
    </button>
    <button type="button" className="tiptap-dropdown-item tiptap-dropdown-danger" onClick={() => { editor.chain().focus().deleteRow().run(); close(); }}>
      Supprimer la ligne
    </button>

    <div className="tiptap-dropdown-section">Colonnes</div>
    <button type="button" className="tiptap-dropdown-item" onClick={() => { editor.chain().focus().addColumnBefore().run(); close(); }}>
      Ajouter colonne a gauche
    </button>
    <button type="button" className="tiptap-dropdown-item" onClick={() => { editor.chain().focus().addColumnAfter().run(); close(); }}>
      Ajouter colonne a droite
    </button>
    <button type="button" className="tiptap-dropdown-item tiptap-dropdown-danger" onClick={() => { editor.chain().focus().deleteColumn().run(); close(); }}>
      Supprimer la colonne
    </button>

    <div className="tiptap-dropdown-section">Cellules</div>
    <button type="button" className="tiptap-dropdown-item" onClick={() => { editor.chain().focus().mergeCells().run(); close(); }}>
      Fusionner les cellules
    </button>
    <button type="button" className="tiptap-dropdown-item" onClick={() => { editor.chain().focus().splitCell().run(); close(); }}>
      Diviser la cellule
    </button>
    <button type="button" className="tiptap-dropdown-item" onClick={() => { editor.chain().focus().toggleHeaderRow().run(); close(); }}>
      Basculer ligne d'en-tete
    </button>
    <button type="button" className="tiptap-dropdown-item" onClick={() => { editor.chain().focus().toggleHeaderColumn().run(); close(); }}>
      Basculer colonne d'en-tete
    </button>
  </>
);

const TableCellTab = ({ editor }: Omit<TableTabProps, 'close'>) => (
  <div className="tiptap-props-panel">
    <div className="tiptap-props-section">
      <div className="tiptap-props-label">Couleur de fond</div>
      <div className="tiptap-dropdown-colors">
        {CELL_BG_COLORS.map((color) => (
          <button
            key={color}
            type="button"
            className="tiptap-color-swatch"
            style={{ background: color, width: 18, height: 18 }}
            title={color}
            onClick={() => editor.chain().focus().setCellAttribute('backgroundColor', color).run()}
          />
        ))}
        <button
          type="button"
          className="tiptap-color-swatch"
          style={RESET_SWATCH_STYLE}
          title="Supprimer"
          onClick={() => editor.chain().focus().setCellAttribute('backgroundColor', null).run()}
        />
      </div>
    </div>

    <div className="tiptap-props-section">
      <div className="tiptap-props-label">Alignement vertical</div>
      <div className="tiptap-props-btn-group">
        {VALIGN_OPTIONS.map((option) => (
          <button
            key={option.value}
            type="button"
            className="tiptap-props-btn"
            title={option.label}
            onClick={() => editor.chain().focus().setCellAttribute('verticalAlign', option.value).run()}
          >
            {option.icon} {option.label}
          </button>
        ))}
      </div>
    </div>

    <div className="tiptap-props-section">
      <div className="tiptap-props-label">Alignement texte</div>
      <div className="tiptap-props-btn-group">
        {TEXTALIGN_OPTIONS.map((option) => (
          <button
            key={option.value}
            type="button"
            className="tiptap-props-btn"
            title={option.label}
            onClick={() => editor.chain().focus().setCellAttribute('textAlign', option.value).run()}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>

    <div className="tiptap-props-section">
      <div className="tiptap-props-label">Padding</div>
      <div className="tiptap-props-btn-group">
        {CELL_PADDING_PRESETS.map((padding) => (
          <button
            key={padding}
            type="button"
            className="tiptap-props-btn"
            onClick={() => editor.chain().focus().setCellAttribute('cellPadding', padding).run()}
          >
            {padding.split(' ')[0]}
          </button>
        ))}
        <button
          type="button"
          className="tiptap-props-btn"
          style={{ color: '#9ca3af' }}
          onClick={() => editor.chain().focus().setCellAttribute('cellPadding', null).run()}
        >
          Reset
        </button>
      </div>
    </div>

    <div className="tiptap-props-section">
      <div className="tiptap-props-label">Bordure de cellule</div>
      <div className="tiptap-dropdown-colors">
        {CELL_BORDER_COLORS.map((color) => (
          <button
            key={color}
            type="button"
            className="tiptap-color-swatch"
            style={{ background: color, width: 18, height: 18 }}
            title={color}
            onClick={() => editor.chain().focus().setCellAttribute('borderColor', color).run()}
          />
        ))}
        <button
          type="button"
          className="tiptap-color-swatch"
          style={RESET_SWATCH_STYLE}
          title="Reinitialiser"
          onClick={() => editor.chain().focus().setCellAttribute('borderColor', null).run()}
        />
      </div>
      <div className="tiptap-props-btn-group" style={{ marginTop: 4 }}>
        {BORDER_WIDTH_PRESETS.map((width) => (
          <button
            key={width}
            type="button"
            className="tiptap-props-btn"
            onClick={() => editor.chain().focus().setCellAttribute('borderWidth', width).run()}
          >
            {width}
          </button>
        ))}
        <button
          type="button"
          className="tiptap-props-btn"
          style={{ color: '#9ca3af' }}
          onClick={() => editor.chain().focus().setCellAttribute('borderWidth', null).run()}
        >
          Reset
        </button>
      </div>
    </div>
  </div>
);

const TablePropertiesTab = ({ editor }: Omit<TableTabProps, 'close'>) => {
  const tableNode = getTableNode(editor);
  const tableCommands = editor.commands as typeof editor.commands & TableAttributeCommands;

  return (
    <div className="tiptap-props-panel">
      <div className="tiptap-props-section">
        <div className="tiptap-props-label">Largeur du tableau</div>
        <div className="tiptap-props-btn-group">
          {TABLE_WIDTH_PRESETS.map((option) => (
            <button
              key={option.label}
              type="button"
              className={`tiptap-props-btn ${tableNode?.attrs.tableWidth === option.value ? 'is-active' : ''}`}
              onClick={() => tableCommands.setTableAttribute('tableWidth', option.value)}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      <div className="tiptap-props-section">
        <div className="tiptap-props-label">Style de bordure</div>
        <div className="tiptap-props-btn-group">
          {BORDER_STYLE_OPTIONS.map((option) => (
            <button
              key={option.label}
              type="button"
              className={`tiptap-props-btn ${tableNode?.attrs.tableBorderStyle === option.value ? 'is-active' : ''}`}
              onClick={() => tableCommands.setTableAttribute('tableBorderStyle', option.value)}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      <div className="tiptap-props-section">
        <div className="tiptap-props-label">Couleur de bordure</div>
        <div className="tiptap-dropdown-colors">
          {CELL_BORDER_COLORS.map((color) => (
            <button
              key={color}
              type="button"
              className="tiptap-color-swatch"
              style={{ background: color, width: 18, height: 18 }}
              title={color}
              onClick={() => tableCommands.setTableAttribute('tableBorderColor', color)}
            />
          ))}
          <button
            type="button"
            className="tiptap-color-swatch"
            style={RESET_SWATCH_STYLE}
            title="Reinitialiser"
            onClick={() => tableCommands.setTableAttribute('tableBorderColor', null)}
          />
        </div>
      </div>

      <div className="tiptap-props-section">
        <div className="tiptap-props-label">Epaisseur de bordure</div>
        <div className="tiptap-props-btn-group">
          {TABLE_BORDER_WIDTH_PRESETS.map((width) => (
            <button
              key={width ?? 'default'}
              type="button"
              className={`tiptap-props-btn ${tableNode?.attrs.tableBorderWidth === width ? 'is-active' : ''}`}
              onClick={() => tableCommands.setTableAttribute('tableBorderWidth', width)}
            >
              {width ?? 'Auto'}
            </button>
          ))}
        </div>
      </div>

      <div className="tiptap-props-section">
        <div className="tiptap-props-label">Disposition</div>
        <div className="tiptap-props-btn-group">
          <button
            type="button"
            className={`tiptap-props-btn ${!tableNode?.attrs.tableLayout ? 'is-active' : ''}`}
            onClick={() => tableCommands.setTableAttribute('tableLayout', null)}
          >
            Auto
          </button>
          <button
            type="button"
            className={`tiptap-props-btn ${tableNode?.attrs.tableLayout === 'fixed' ? 'is-active' : ''}`}
            onClick={() => tableCommands.setTableAttribute('tableLayout', 'fixed')}
          >
            Fixe
          </button>
        </div>
      </div>

      <div className="tiptap-props-section">
        <div className="tiptap-props-label">Lignes alternees</div>
        <div className="tiptap-props-btn-group">
          <button
            type="button"
            className={`tiptap-props-btn ${tableNode?.attrs.stripedRows ? 'is-active' : ''}`}
            onClick={() => tableCommands.setTableAttribute('stripedRows', !tableNode?.attrs.stripedRows)}
          >
            {tableNode?.attrs.stripedRows ? 'Active' : 'Desactive'}
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
      {(close) => (
        <>
          {!inTable ? (
            <TableInsertPanel editor={editor} close={close} />
          ) : (
            <>
              <div className="tiptap-tab-bar">
                {TABLE_TABS.map(([key, label]) => (
                  <button
                    key={key}
                    type="button"
                    className={`tiptap-tab-btn ${activeTab === key ? 'is-active' : ''}`}
                    onClick={() => setActiveTab(key as TableTab)}
                  >
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

export const ImageMenu = ({
  editor,
  onAddImage,
  onUploadImage,
}: {
  editor: Editor;
  onAddImage: () => void;
  onUploadImage: () => void;
}) => {
  return (
    <Dropdown
      trigger={
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="3" y="3" width="18" height="18" rx="2" />
          <circle cx="8.5" cy="8.5" r="1.5" />
          <polyline points="21 15 16 10 5 21" />
        </svg>
      }
      title="Image"
      isActive={editor.isActive('image')}
    >
      <button type="button" className="tiptap-dropdown-item" onClick={onAddImage}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
          <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
        </svg>
        Inserer depuis une URL
      </button>
      <button type="button" className="tiptap-dropdown-item" onClick={onUploadImage}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
          <polyline points="17 8 12 3 7 8" />
          <line x1="12" y1="3" x2="12" y2="15" />
        </svg>
        Televerser depuis l'ordinateur
      </button>
    </Dropdown>
  );
};

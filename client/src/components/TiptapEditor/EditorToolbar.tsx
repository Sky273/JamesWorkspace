/**
 * EditorToolbar - Full toolbar for TiptapEditor
 * Features: heading dropdown H1-H5, image upload + URL, detailed table management,
 * image properties, table properties, color pickers, justify alignment
 */

import type { Editor } from '@tiptap/react';
import { useCallback, useEffect, useRef, useState } from 'react';

// ============================================
// TYPES
// ============================================

interface EditorToolbarProps {
  editor: Editor;
  onSetLink: () => void;
  onAddImage: () => void;
  onUploadImage: () => void;
  minimal?: boolean;
  extraContent?: React.ReactNode;
}

// ============================================
// TOOLBAR BUTTON
// ============================================

interface TBProps {
  onClick: () => void;
  isActive?: boolean;
  disabled?: boolean;
  title: string;
  children: React.ReactNode;
  className?: string;
}

const TB = ({ onClick, isActive, disabled, title, children, className = '' }: TBProps) => (
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

const Divider = () => <div className="tiptap-toolbar-divider" />;

// ============================================
// DROPDOWN (generic)
// ============================================

interface DropdownProps {
  trigger: React.ReactNode;
  title: string;
  children: React.ReactNode;
  isActive?: boolean;
}

const Dropdown = ({ trigger, title, children, isActive }: DropdownProps) => {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  return (
    <div className="tiptap-dropdown-wrapper" ref={ref}>
      <button
        type="button"
        className={`tiptap-toolbar-btn tiptap-dropdown-trigger ${isActive ? 'is-active' : ''}`}
        title={title}
        onClick={() => setOpen(!open)}
      >
        {trigger}
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ marginLeft: 2 }}><path d="m6 9 6 6 6-6" /></svg>
      </button>
      {open && (
        <div className="tiptap-dropdown-menu" onClick={() => setOpen(false)}>
          {children}
        </div>
      )}
    </div>
  );
};

// ============================================
// HEADING DROPDOWN
// ============================================

const HEADING_LEVELS = [1, 2, 3, 4, 5] as const;
const HEADING_LABELS: Record<number, string> = { 1: 'Titre 1', 2: 'Titre 2', 3: 'Titre 3', 4: 'Titre 4', 5: 'Titre 5' };
const HEADING_SIZES: Record<number, string> = { 1: '1.4em', 2: '1.2em', 3: '1.05em', 4: '0.95em', 5: '0.85em' };

const HeadingDropdown = ({ editor }: { editor: Editor }) => {
  const activeLevel = HEADING_LEVELS.find((l) => editor.isActive('heading', { level: l }));
  const label = activeLevel ? `H${activeLevel}` : '¶';

  return (
    <Dropdown trigger={<span style={{ minWidth: 22, textAlign: 'center' }}>{label}</span>} title="Type de bloc" isActive={!!activeLevel}>
      <button
        type="button"
        className={`tiptap-dropdown-item ${!activeLevel ? 'is-active' : ''}`}
        onClick={() => editor.chain().focus().setParagraph().run()}
      >
        <span style={{ fontSize: '0.9em' }}>¶</span> Paragraphe
      </button>
      {HEADING_LEVELS.map((level) => (
        <button
          key={level}
          type="button"
          className={`tiptap-dropdown-item ${editor.isActive('heading', { level }) ? 'is-active' : ''}`}
          onClick={() => editor.chain().focus().toggleHeading({ level }).run()}
        >
          <span style={{ fontSize: HEADING_SIZES[level], fontWeight: 700 }}>H{level}</span> {HEADING_LABELS[level]}
        </button>
      ))}
    </Dropdown>
  );
};

// ============================================
// COLOR PICKER
// ============================================

const COLORS = [
  '#000000', '#434343', '#666666', '#999999', '#b7b7b7', '#cccccc', '#d9d9d9', '#efefef', '#f3f3f3', '#ffffff',
  '#980000', '#ff0000', '#ff9900', '#ffff00', '#00ff00', '#00ffff', '#4a86e8', '#0000ff', '#9900ff', '#ff00ff',
  '#e6b8af', '#f4cccc', '#fce5cd', '#fff2cc', '#d9ead3', '#d0e0e3', '#c9daf8', '#cfe2f3', '#d9d2e9', '#ead1dc',
  '#dd7e6b', '#ea9999', '#f9cb9c', '#ffe599', '#b6d7a8', '#a2c4c9', '#a4c2f4', '#9fc5e8', '#b4a7d6', '#d5a6bd',
];

interface ColorPickerProps {
  editor: Editor;
  type: 'text' | 'highlight';
}

const ColorPicker = ({ editor, type }: ColorPickerProps) => {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const applyColor = useCallback(
    (color: string) => {
      if (type === 'text') {
        editor.chain().focus().setColor(color).run();
      } else {
        editor.chain().focus().toggleHighlight({ color }).run();
      }
      setOpen(false);
    },
    [editor, type]
  );

  return (
    <div className="tiptap-color-picker-wrapper" ref={ref}>
      <button
        type="button"
        className="tiptap-toolbar-btn"
        title={type === 'text' ? 'Couleur de texte' : 'Surlignage'}
        onClick={() => setOpen(!open)}
      >
        {type === 'text' ? (
          <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', lineHeight: 1 }}>
            <span style={{ fontSize: 14 }}>A</span>
            <span style={{ width: 14, height: 3, background: editor.getAttributes('textStyle').color || '#000', borderRadius: 1 }} />
          </span>
        ) : (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 20h9" /><path d="m16.376 3.622 4.002 4.002-12.748 12.748H3.628v-4.002z" />
          </svg>
        )}
      </button>
      {open && (
        <div className="tiptap-color-picker-dropdown">
          {COLORS.map((c) => (
            <button
              key={c}
              type="button"
              className="tiptap-color-swatch"
              style={{ background: c }}
              title={c}
              onClick={() => applyColor(c)}
            />
          ))}
          <button
            type="button"
            className="tiptap-color-reset"
            onClick={() => {
              if (type === 'text') editor.chain().focus().unsetColor().run();
              else editor.chain().focus().unsetHighlight().run();
              setOpen(false);
            }}
          >
            {type === 'text' ? 'Réinitialiser' : 'Supprimer'}
          </button>
        </div>
      )}
    </div>
  );
};

// ============================================
// TABLE MENU (dropdown with all table actions)
// ============================================

const TableMenu = ({ editor }: { editor: Editor }) => {
  const inTable = editor.isActive('table');

  return (
    <Dropdown
      trigger={
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="3" y1="15" x2="21" y2="15"/><line x1="9" y1="3" x2="9" y2="21"/><line x1="15" y1="3" x2="15" y2="21"/></svg>
      }
      title="Tableau"
      isActive={inTable}
    >
      {!inTable ? (
        <>
          <button type="button" className="tiptap-dropdown-item" onClick={() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/></svg>
            Insérer tableau 3×3
          </button>
          <button type="button" className="tiptap-dropdown-item" onClick={() => editor.chain().focus().insertTable({ rows: 2, cols: 2, withHeaderRow: true }).run()}>
            Insérer tableau 2×2
          </button>
          <button type="button" className="tiptap-dropdown-item" onClick={() => editor.chain().focus().insertTable({ rows: 4, cols: 4, withHeaderRow: true }).run()}>
            Insérer tableau 4×4
          </button>
          <button type="button" className="tiptap-dropdown-item" onClick={() => editor.chain().focus().insertTable({ rows: 5, cols: 5, withHeaderRow: true }).run()}>
            Insérer tableau 5×5
          </button>
        </>
      ) : (
        <>
          <div className="tiptap-dropdown-section">Lignes</div>
          <button type="button" className="tiptap-dropdown-item" onClick={() => editor.chain().focus().addRowBefore().run()}>
            ↑ Ajouter ligne au-dessus
          </button>
          <button type="button" className="tiptap-dropdown-item" onClick={() => editor.chain().focus().addRowAfter().run()}>
            ↓ Ajouter ligne en-dessous
          </button>
          <button type="button" className="tiptap-dropdown-item tiptap-dropdown-danger" onClick={() => editor.chain().focus().deleteRow().run()}>
            ✕ Supprimer la ligne
          </button>

          <div className="tiptap-dropdown-section">Colonnes</div>
          <button type="button" className="tiptap-dropdown-item" onClick={() => editor.chain().focus().addColumnBefore().run()}>
            ← Ajouter colonne à gauche
          </button>
          <button type="button" className="tiptap-dropdown-item" onClick={() => editor.chain().focus().addColumnAfter().run()}>
            → Ajouter colonne à droite
          </button>
          <button type="button" className="tiptap-dropdown-item tiptap-dropdown-danger" onClick={() => editor.chain().focus().deleteColumn().run()}>
            ✕ Supprimer la colonne
          </button>

          <div className="tiptap-dropdown-section">Cellules</div>
          <button type="button" className="tiptap-dropdown-item" onClick={() => editor.chain().focus().mergeCells().run()}>
            ⊞ Fusionner les cellules
          </button>
          <button type="button" className="tiptap-dropdown-item" onClick={() => editor.chain().focus().splitCell().run()}>
            ⊟ Diviser la cellule
          </button>
          <button type="button" className="tiptap-dropdown-item" onClick={() => editor.chain().focus().toggleHeaderRow().run()}>
            ≡ Basculer ligne d'en-tête
          </button>
          <button type="button" className="tiptap-dropdown-item" onClick={() => editor.chain().focus().toggleHeaderColumn().run()}>
            ‖ Basculer colonne d'en-tête
          </button>

          <div className="tiptap-dropdown-section">Couleur de cellule</div>
          <div className="tiptap-dropdown-colors">
            {['#ffffff', '#f3f4f6', '#dbeafe', '#dcfce7', '#fef9c3', '#fee2e2', '#f3e8ff', '#e0e7ff'].map((c) => (
              <button
                key={c}
                type="button"
                className="tiptap-color-swatch"
                style={{ background: c, width: 20, height: 20 }}
                title={c}
                onClick={() => editor.chain().focus().setCellAttribute('backgroundColor', c).run()}
              />
            ))}
            <button
              type="button"
              className="tiptap-color-swatch"
              style={{ background: 'linear-gradient(135deg, #fff 45%, #ef4444 50%, #fff 55%)', width: 20, height: 20, border: '1px solid #d1d5db' }}
              title="Supprimer la couleur"
              onClick={() => editor.chain().focus().setCellAttribute('backgroundColor', null).run()}
            />
          </div>

          <div className="tiptap-dropdown-section" />
          <button type="button" className="tiptap-dropdown-item tiptap-dropdown-danger" onClick={() => editor.chain().focus().deleteTable().run()}>
            🗑 Supprimer le tableau
          </button>
        </>
      )}
    </Dropdown>
  );
};

// ============================================
// IMAGE MENU (dropdown: URL + upload)
// ============================================

const ImageMenu = ({ editor, onAddImage, onUploadImage }: { editor: Editor; onAddImage: () => void; onUploadImage: () => void }) => {
  return (
    <Dropdown
      trigger={
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
      }
      title="Image"
      isActive={editor.isActive('image')}
    >
      <button type="button" className="tiptap-dropdown-item" onClick={onAddImage}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
        Insérer depuis une URL
      </button>
      <button type="button" className="tiptap-dropdown-item" onClick={onUploadImage}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
        Téléverser depuis l'ordinateur
      </button>
    </Dropdown>
  );
};

// ============================================
// MAIN TOOLBAR
// ============================================

export const EditorToolbar = ({ editor, onSetLink, onAddImage, onUploadImage, minimal, extraContent }: EditorToolbarProps) => {
  return (
    <div className="tiptap-toolbar">
      {extraContent}

      {/* Undo / Redo */}
      <TB onClick={() => editor.chain().focus().undo().run()} disabled={!editor.can().undo()} title="Annuler (Ctrl+Z)">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 7v6h6"/><path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13"/></svg>
      </TB>
      <TB onClick={() => editor.chain().focus().redo().run()} disabled={!editor.can().redo()} title="Rétablir (Ctrl+Y)">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 7v6h-6"/><path d="M3 17a9 9 0 0 1 9-9 9 9 0 0 1 6 2.3L21 13"/></svg>
      </TB>

      <Divider />

      {/* Heading dropdown */}
      <HeadingDropdown editor={editor} />

      <Divider />

      {/* Bold / Italic / Underline / Strikethrough */}
      <TB onClick={() => editor.chain().focus().toggleBold().run()} isActive={editor.isActive('bold')} title="Gras (Ctrl+B)">
        <strong>B</strong>
      </TB>
      <TB onClick={() => editor.chain().focus().toggleItalic().run()} isActive={editor.isActive('italic')} title="Italique (Ctrl+I)">
        <em>I</em>
      </TB>
      <TB onClick={() => editor.chain().focus().toggleUnderline().run()} isActive={editor.isActive('underline')} title="Souligné (Ctrl+U)">
        <u>U</u>
      </TB>
      <TB onClick={() => editor.chain().focus().toggleStrike().run()} isActive={editor.isActive('strike')} title="Barré">
        <s>S</s>
      </TB>

      <Divider />

      {/* Text alignment */}
      <TB onClick={() => editor.chain().focus().setTextAlign('left').run()} isActive={editor.isActive({ textAlign: 'left' })} title="Aligner à gauche">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="17" y1="10" x2="3" y2="10"/><line x1="21" y1="6" x2="3" y2="6"/><line x1="21" y1="14" x2="3" y2="14"/><line x1="17" y1="18" x2="3" y2="18"/></svg>
      </TB>
      <TB onClick={() => editor.chain().focus().setTextAlign('center').run()} isActive={editor.isActive({ textAlign: 'center' })} title="Centrer">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="10" x2="6" y2="10"/><line x1="21" y1="6" x2="3" y2="6"/><line x1="21" y1="14" x2="3" y2="14"/><line x1="18" y1="18" x2="6" y2="18"/></svg>
      </TB>
      <TB onClick={() => editor.chain().focus().setTextAlign('right').run()} isActive={editor.isActive({ textAlign: 'right' })} title="Aligner à droite">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="21" y1="10" x2="7" y2="10"/><line x1="21" y1="6" x2="3" y2="6"/><line x1="21" y1="14" x2="3" y2="14"/><line x1="21" y1="18" x2="7" y2="18"/></svg>
      </TB>
      <TB onClick={() => editor.chain().focus().setTextAlign('justify').run()} isActive={editor.isActive({ textAlign: 'justify' })} title="Justifier">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="21" y1="10" x2="3" y2="10"/><line x1="21" y1="6" x2="3" y2="6"/><line x1="21" y1="14" x2="3" y2="14"/><line x1="21" y1="18" x2="3" y2="18"/></svg>
      </TB>

      <Divider />

      {/* Lists */}
      <TB onClick={() => editor.chain().focus().toggleBulletList().run()} isActive={editor.isActive('bulletList')} title="Liste à puces">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><circle cx="4" cy="6" r="1" fill="currentColor"/><circle cx="4" cy="12" r="1" fill="currentColor"/><circle cx="4" cy="18" r="1" fill="currentColor"/></svg>
      </TB>
      <TB onClick={() => editor.chain().focus().toggleOrderedList().run()} isActive={editor.isActive('orderedList')} title="Liste numérotée">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="10" y1="6" x2="21" y2="6"/><line x1="10" y1="12" x2="21" y2="12"/><line x1="10" y1="18" x2="21" y2="18"/><text x="2" y="8" fontSize="8" fill="currentColor" stroke="none">1</text><text x="2" y="14" fontSize="8" fill="currentColor" stroke="none">2</text><text x="2" y="20" fontSize="8" fill="currentColor" stroke="none">3</text></svg>
      </TB>

      {/* Blockquote */}
      <TB onClick={() => editor.chain().focus().toggleBlockquote().run()} isActive={editor.isActive('blockquote')} title="Citation">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 17h3l2-4V7H5v6h3zm8 0h3l2-4V7h-6v6h3z"/></svg>
      </TB>

      <Divider />

      {/* Code / Code block */}
      <TB onClick={() => editor.chain().focus().toggleCode().run()} isActive={editor.isActive('code')} title="Code inline">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>
      </TB>
      {!minimal && (
        <TB onClick={() => editor.chain().focus().toggleCodeBlock().run()} isActive={editor.isActive('codeBlock')} title="Bloc de code">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2"/><polyline points="9 8 5 12 9 16"/><polyline points="15 8 19 12 15 16"/></svg>
        </TB>
      )}

      <Divider />

      {/* Link */}
      <TB onClick={onSetLink} isActive={editor.isActive('link')} title="Lien">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
      </TB>

      {/* Unlink (visible when link is active) */}
      {editor.isActive('link') && (
        <TB onClick={() => editor.chain().focus().unsetLink().run()} title="Supprimer le lien">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m18.84 12.25 1.72-1.71a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="m5.16 11.75-1.72 1.71a5 5 0 0 0 7.07 7.07l1.72-1.71"/><line x1="2" y1="2" x2="22" y2="22"/></svg>
        </TB>
      )}

      {/* Image */}
      {!minimal && (
        <>
          <ImageMenu editor={editor} onAddImage={onAddImage} onUploadImage={onUploadImage} />
        </>
      )}

      {/* Table */}
      {!minimal && (
        <>
          <Divider />
          <TableMenu editor={editor} />
        </>
      )}

      <Divider />

      {/* Color pickers */}
      <ColorPicker editor={editor} type="text" />
      <ColorPicker editor={editor} type="highlight" />

      <Divider />

      {/* Horizontal rule */}
      <TB onClick={() => editor.chain().focus().setHorizontalRule().run()} title="Ligne horizontale">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="2" y1="12" x2="22" y2="12"/></svg>
      </TB>

      {/* Clear formatting */}
      <TB onClick={() => editor.chain().focus().clearNodes().unsetAllMarks().run()} title="Effacer le formatage">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 7h16"/><path d="m5 7 4 12"/><path d="M15 7l-2.5 7.5"/><path d="m2 17 4 4"/><path d="m18 13 4 4"/><path d="m2 21 4-4"/><path d="m18 17 4-4"/></svg>
      </TB>
    </div>
  );
};

/**
 * EditorToolbar - Full toolbar for TiptapEditor
 */

import type { Editor } from '@tiptap/react';
import { useCallback, useRef, useState } from 'react';

interface EditorToolbarProps {
  editor: Editor;
  onSetLink: () => void;
  onAddImage: () => void;
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
}

const TB = ({ onClick, isActive, disabled, title, children }: TBProps) => (
  <button
    type="button"
    onClick={onClick}
    disabled={disabled}
    title={title}
    className={`tiptap-toolbar-btn ${isActive ? 'is-active' : ''}`}
  >
    {children}
  </button>
);

const Divider = () => <div className="tiptap-toolbar-divider" />;

// ============================================
// COLOR PICKER
// ============================================

const COLORS = [
  '#000000', '#434343', '#666666', '#999999', '#b7b7b7', '#cccccc', '#d9d9d9', '#efefef', '#f3f3f3', '#ffffff',
  '#980000', '#ff0000', '#ff9900', '#ffff00', '#00ff00', '#00ffff', '#4a86e8', '#0000ff', '#9900ff', '#ff00ff',
  '#e6b8af', '#f4cccc', '#fce5cd', '#fff2cc', '#d9ead3', '#d0e0e3', '#c9daf8', '#cfe2f3', '#d9d2e9', '#ead1dc',
];

interface ColorPickerProps {
  editor: Editor;
  type: 'text' | 'highlight';
}

const ColorPicker = ({ editor, type }: ColorPickerProps) => {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

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
          {type === 'text' && (
            <button
              type="button"
              className="tiptap-color-reset"
              onClick={() => { editor.chain().focus().unsetColor().run(); setOpen(false); }}
            >
              Réinitialiser
            </button>
          )}
          {type === 'highlight' && (
            <button
              type="button"
              className="tiptap-color-reset"
              onClick={() => { editor.chain().focus().unsetHighlight().run(); setOpen(false); }}
            >
              Supprimer
            </button>
          )}
        </div>
      )}
    </div>
  );
};

// ============================================
// MAIN TOOLBAR
// ============================================

export const EditorToolbar = ({ editor, onSetLink, onAddImage, minimal, extraContent }: EditorToolbarProps) => {
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

      {/* Headings */}
      <TB onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()} isActive={editor.isActive('heading', { level: 1 })} title="Titre 1">
        H1
      </TB>
      <TB onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} isActive={editor.isActive('heading', { level: 2 })} title="Titre 2">
        H2
      </TB>
      <TB onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} isActive={editor.isActive('heading', { level: 3 })} title="Titre 3">
        H3
      </TB>

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

      {/* Image */}
      {!minimal && (
        <TB onClick={onAddImage} title="Image">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
        </TB>
      )}

      {/* Table */}
      {!minimal && (
        <>
          <Divider />
          <TB onClick={() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()} title="Insérer tableau">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="3" y1="15" x2="21" y2="15"/><line x1="9" y1="3" x2="9" y2="21"/><line x1="15" y1="3" x2="15" y2="21"/></svg>
          </TB>
          {editor.isActive('table') && (
            <>
              <TB onClick={() => editor.chain().focus().addColumnAfter().run()} title="Ajouter colonne">+Col</TB>
              <TB onClick={() => editor.chain().focus().addRowAfter().run()} title="Ajouter ligne">+Lig</TB>
              <TB onClick={() => editor.chain().focus().deleteColumn().run()} title="Supprimer colonne">-Col</TB>
              <TB onClick={() => editor.chain().focus().deleteRow().run()} title="Supprimer ligne">-Lig</TB>
              <TB onClick={() => editor.chain().focus().deleteTable().run()} title="Supprimer tableau">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </TB>
            </>
          )}
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

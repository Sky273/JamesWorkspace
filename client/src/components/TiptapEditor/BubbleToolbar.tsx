/**
 * BubbleToolbar - Context-aware floating toolbar on selection
 * Shows different controls for: text, images, links
 */

import type { Editor } from '@tiptap/react';
import { useState, useCallback } from 'react';

interface BubbleToolbarProps {
  editor: Editor;
  onSetLink: () => void;
}

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
    className={`tiptap-bubble-btn ${isActive ? 'is-active' : ''} ${className}`}
  >
    {children}
  </button>
);

// ============================================
// IMAGE BUBBLE (shown when image is selected)
// ============================================

const ImageBubble = ({ editor }: { editor: Editor }) => {
  const attrs = editor.getAttributes('image');
  const [showProps, setShowProps] = useState(false);
  const [width, setWidth] = useState(attrs.width || '');
  const [height, setHeight] = useState(attrs.height || '');
  const [alt, setAlt] = useState(attrs.alt || '');

  const applySize = useCallback(() => {
    const src = attrs.src as string;
    if (!src) return;
    editor.chain().focus().setImage({
      src,
      ...(width ? { width: width as unknown as number } : {}),
      ...(height ? { height: height as unknown as number } : {}),
      ...(alt ? { alt } : {}),
    }).run();
    setShowProps(false);
  }, [editor, attrs.src, width, height, alt]);

  const setImageWidth = useCallback((w: string) => {
    const src = attrs.src as string;
    if (!src) return;
    editor.chain().focus().setImage({ src, width: w as unknown as number, ...(attrs.alt ? { alt: attrs.alt as string } : {}) }).run();
  }, [editor, attrs.src, attrs.alt]);

  return (
    <div className="tiptap-bubble-menu tiptap-bubble-image">
      {!showProps ? (
        <>
          <TB onClick={() => setImageWidth('25%')} title="25%">25%</TB>
          <TB onClick={() => setImageWidth('50%')} title="50%">50%</TB>
          <TB onClick={() => setImageWidth('75%')} title="75%">75%</TB>
          <TB onClick={() => setImageWidth('100%')} title="100%">100%</TB>
          <span className="tiptap-bubble-divider" />
          <TB onClick={() => setShowProps(true)} title="Propriétés de l'image">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
          </TB>
          <TB onClick={() => editor.chain().focus().deleteSelection().run()} title="Supprimer l'image" className="tiptap-bubble-danger">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
          </TB>
        </>
      ) : (
        <div className="tiptap-bubble-props">
          <label>
            <span>Largeur</span>
            <input type="text" value={width} onChange={(e) => setWidth(e.target.value)} placeholder="ex: 300px, 50%" />
          </label>
          <label>
            <span>Hauteur</span>
            <input type="text" value={height} onChange={(e) => setHeight(e.target.value)} placeholder="auto" />
          </label>
          <label>
            <span>Alt</span>
            <input type="text" value={alt} onChange={(e) => setAlt(e.target.value)} placeholder="Description" />
          </label>
          <div className="tiptap-bubble-props-actions">
            <button type="button" className="tiptap-bubble-props-apply" onClick={applySize}>Appliquer</button>
            <button type="button" className="tiptap-bubble-props-cancel" onClick={() => setShowProps(false)}>Annuler</button>
          </div>
        </div>
      )}
    </div>
  );
};

// ============================================
// LINK BUBBLE (shown when cursor is in a link)
// ============================================

const LinkBubble = ({ editor, onSetLink }: { editor: Editor; onSetLink: () => void }) => {
  const href = editor.getAttributes('link').href || '';
  return (
    <div className="tiptap-bubble-menu tiptap-bubble-link">
      <a href={href} target="_blank" rel="noopener noreferrer" className="tiptap-bubble-link-url" title={href}>
        {href.length > 40 ? href.slice(0, 40) + '…' : href}
      </a>
      <TB onClick={onSetLink} title="Modifier le lien">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.12 2.12 0 0 1 3 3L12 15l-4 1 1-4Z"/></svg>
      </TB>
      <TB onClick={() => editor.chain().focus().unsetLink().run()} title="Supprimer le lien" className="tiptap-bubble-danger">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m18.84 12.25 1.72-1.71a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="m5.16 11.75-1.72 1.71a5 5 0 0 0 7.07 7.07l1.72-1.71"/><line x1="2" y1="2" x2="22" y2="22"/></svg>
      </TB>
    </div>
  );
};

// ============================================
// TEXT BUBBLE (default: shown on text selection)
// ============================================

const TextBubble = ({ editor, onSetLink }: { editor: Editor; onSetLink: () => void }) => (
  <div className="tiptap-bubble-menu">
    <TB onClick={() => editor.chain().focus().toggleBold().run()} isActive={editor.isActive('bold')} title="Gras">
      <strong>B</strong>
    </TB>
    <TB onClick={() => editor.chain().focus().toggleItalic().run()} isActive={editor.isActive('italic')} title="Italique">
      <em>I</em>
    </TB>
    <TB onClick={() => editor.chain().focus().toggleUnderline().run()} isActive={editor.isActive('underline')} title="Souligné">
      <u>U</u>
    </TB>
    <TB onClick={() => editor.chain().focus().toggleStrike().run()} isActive={editor.isActive('strike')} title="Barré">
      <s>S</s>
    </TB>
    <span className="tiptap-bubble-divider" />
    <TB onClick={() => editor.chain().focus().toggleCode().run()} isActive={editor.isActive('code')} title="Code">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>
    </TB>
    <TB onClick={onSetLink} isActive={editor.isActive('link')} title="Lien">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
    </TB>
    <TB onClick={() => editor.chain().focus().toggleHighlight().run()} isActive={editor.isActive('highlight')} title="Surligner">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 20h9"/><path d="m16.376 3.622 4.002 4.002-12.748 12.748H3.628v-4.002z"/></svg>
    </TB>
    <span className="tiptap-bubble-divider" />
    <TB onClick={() => editor.chain().focus().setTextAlign('left').run()} isActive={editor.isActive({ textAlign: 'left' })} title="Gauche">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="17" y1="10" x2="3" y2="10"/><line x1="21" y1="6" x2="3" y2="6"/><line x1="21" y1="14" x2="3" y2="14"/><line x1="17" y1="18" x2="3" y2="18"/></svg>
    </TB>
    <TB onClick={() => editor.chain().focus().setTextAlign('center').run()} isActive={editor.isActive({ textAlign: 'center' })} title="Centre">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="10" x2="6" y2="10"/><line x1="21" y1="6" x2="3" y2="6"/><line x1="21" y1="14" x2="3" y2="14"/><line x1="18" y1="18" x2="6" y2="18"/></svg>
    </TB>
    <TB onClick={() => editor.chain().focus().setTextAlign('right').run()} isActive={editor.isActive({ textAlign: 'right' })} title="Droite">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="21" y1="10" x2="7" y2="10"/><line x1="21" y1="6" x2="3" y2="6"/><line x1="21" y1="14" x2="3" y2="14"/><line x1="21" y1="18" x2="7" y2="18"/></svg>
    </TB>
  </div>
);

// ============================================
// MAIN EXPORT (context-aware)
// ============================================

export const BubbleToolbar = ({ editor, onSetLink }: BubbleToolbarProps) => {
  if (editor.isActive('image')) {
    return <ImageBubble editor={editor} />;
  }

  if (editor.isActive('link') && editor.state.selection.empty) {
    return <LinkBubble editor={editor} onSetLink={onSetLink} />;
  }

  return <TextBubble editor={editor} onSetLink={onSetLink} />;
};

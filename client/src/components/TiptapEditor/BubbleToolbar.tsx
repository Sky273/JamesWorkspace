/**
 * BubbleToolbar - Floating toolbar on text selection
 */

import type { Editor } from '@tiptap/react';

interface BubbleToolbarProps {
  editor: Editor;
  onSetLink: () => void;
}

const TB = ({ onClick, isActive, title, children }: {
  onClick: () => void;
  isActive?: boolean;
  title: string;
  children: React.ReactNode;
}) => (
  <button
    type="button"
    onClick={onClick}
    title={title}
    className={`tiptap-bubble-btn ${isActive ? 'is-active' : ''}`}
  >
    {children}
  </button>
);

export const BubbleToolbar = ({ editor, onSetLink }: BubbleToolbarProps) => {
  return (
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
      <TB onClick={() => editor.chain().focus().toggleCode().run()} isActive={editor.isActive('code')} title="Code">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>
      </TB>
      <TB onClick={onSetLink} isActive={editor.isActive('link')} title="Lien">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
      </TB>
      <TB onClick={() => editor.chain().focus().toggleHighlight().run()} isActive={editor.isActive('highlight')} title="Surligner">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 20h9"/><path d="m16.376 3.622 4.002 4.002-12.748 12.748H3.628v-4.002z"/></svg>
      </TB>
    </div>
  );
};

/**
 * EditorToolbar - Full toolbar for TiptapEditor
 * Main assembly layer
 */

import type { Editor } from '@tiptap/react';
import { useTranslation } from 'react-i18next';
import {
  TB,
  Divider,
  HeadingDropdown,
  ColorPicker,
  TableMenu,
  ImageMenu,
} from './EditorToolbar.parts';

interface EditorToolbarProps {
  editor: Editor;
  onSetLink: () => void;
  onAddImage: () => void;
  onUploadImage: () => void;
  minimal?: boolean;
  extraContent?: React.ReactNode;
  isHtmlMode?: boolean;
  onToggleHtmlMode?: () => void;
}

export const EditorToolbar = ({
  editor,
  onSetLink,
  onAddImage,
  onUploadImage,
  minimal,
  extraContent,
  isHtmlMode,
  onToggleHtmlMode,
}: EditorToolbarProps) => {
  const { t } = useTranslation();

  return (
    <div className="tiptap-toolbar">
      {extraContent}

      <TB onClick={() => editor.chain().focus().undo().run()} disabled={!editor.can().undo()} title={t('tiptap.undo')}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 7v6h6"/><path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13"/></svg>
      </TB>
      <TB onClick={() => editor.chain().focus().redo().run()} disabled={!editor.can().redo()} title={t('tiptap.redo')}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 7v6h-6"/><path d="M3 17a9 9 0 0 1 9-9 9 9 0 0 1 6 2.3L21 13"/></svg>
      </TB>

      <Divider />
      <HeadingDropdown editor={editor} />
      <Divider />

      <TB onClick={() => editor.chain().focus().toggleBold().run()} isActive={editor.isActive('bold')} title={t('tiptap.bold')}>
        <strong>B</strong>
      </TB>
      <TB onClick={() => editor.chain().focus().toggleItalic().run()} isActive={editor.isActive('italic')} title={t('tiptap.italic')}>
        <em>I</em>
      </TB>
      <TB onClick={() => editor.chain().focus().toggleUnderline().run()} isActive={editor.isActive('underline')} title={t('tiptap.underline')}>
        <u>U</u>
      </TB>
      <TB onClick={() => editor.chain().focus().toggleStrike().run()} isActive={editor.isActive('strike')} title={t('tiptap.strike')}>
        <s>S</s>
      </TB>

      <Divider />

      <TB onClick={() => editor.chain().focus().setTextAlign('left').run()} isActive={editor.isActive({ textAlign: 'left' })} title={t('tiptap.alignLeft')}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="17" y1="10" x2="3" y2="10"/><line x1="21" y1="6" x2="3" y2="6"/><line x1="21" y1="14" x2="3" y2="14"/><line x1="17" y1="18" x2="3" y2="18"/></svg>
      </TB>
      <TB onClick={() => editor.chain().focus().setTextAlign('center').run()} isActive={editor.isActive({ textAlign: 'center' })} title={t('tiptap.alignCenter')}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="10" x2="6" y2="10"/><line x1="21" y1="6" x2="3" y2="6"/><line x1="21" y1="14" x2="3" y2="14"/><line x1="18" y1="18" x2="6" y2="18"/></svg>
      </TB>
      <TB onClick={() => editor.chain().focus().setTextAlign('right').run()} isActive={editor.isActive({ textAlign: 'right' })} title={t('tiptap.alignRight')}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="21" y1="10" x2="7" y2="10"/><line x1="21" y1="6" x2="3" y2="6"/><line x1="21" y1="14" x2="3" y2="14"/><line x1="21" y1="18" x2="7" y2="18"/></svg>
      </TB>
      <TB onClick={() => editor.chain().focus().setTextAlign('justify').run()} isActive={editor.isActive({ textAlign: 'justify' })} title={t('tiptap.justify')}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="21" y1="10" x2="3" y2="10"/><line x1="21" y1="6" x2="3" y2="6"/><line x1="21" y1="14" x2="3" y2="14"/><line x1="21" y1="18" x2="3" y2="18"/></svg>
      </TB>

      <Divider />

      <TB onClick={() => editor.chain().focus().toggleBulletList().run()} isActive={editor.isActive('bulletList')} title={t('tiptap.bulletList')}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><circle cx="4" cy="6" r="1" fill="currentColor"/><circle cx="4" cy="12" r="1" fill="currentColor"/><circle cx="4" cy="18" r="1" fill="currentColor"/></svg>
      </TB>
      <TB onClick={() => editor.chain().focus().toggleOrderedList().run()} isActive={editor.isActive('orderedList')} title={t('tiptap.orderedList')}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="10" y1="6" x2="21" y2="6"/><line x1="10" y1="12" x2="21" y2="12"/><line x1="10" y1="18" x2="21" y2="18"/><text x="2" y="8" fontSize="8" fill="currentColor" stroke="none">1</text><text x="2" y="14" fontSize="8" fill="currentColor" stroke="none">2</text><text x="2" y="20" fontSize="8" fill="currentColor" stroke="none">3</text></svg>
      </TB>
      <TB onClick={() => editor.chain().focus().toggleBlockquote().run()} isActive={editor.isActive('blockquote')} title={t('tiptap.blockquote')}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 17h3l2-4V7H5v6h3zm8 0h3l2-4V7h-6v6h3z"/></svg>
      </TB>

      <Divider />

      <TB onClick={() => editor.chain().focus().toggleCode().run()} isActive={editor.isActive('code')} title={t('tiptap.inlineCode')}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>
      </TB>
      {!minimal && (
        <TB onClick={() => editor.chain().focus().toggleCodeBlock().run()} isActive={editor.isActive('codeBlock')} title={t('tiptap.codeBlock')}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2"/><polyline points="9 8 5 12 9 16"/><polyline points="15 8 19 12 15 16"/></svg>
        </TB>
      )}

      <Divider />

      <TB onClick={onSetLink} isActive={editor.isActive('link')} title={t('tiptap.link')}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
      </TB>
      {editor.isActive('link') && (
        <TB onClick={() => editor.chain().focus().unsetLink().run()} title={t('tiptap.removeLink')}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m18.84 12.25 1.72-1.71a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="m5.16 11.75-1.72 1.71a5 5 0 0 0 7.07 7.07l1.72-1.71"/><line x1="2" y1="2" x2="22" y2="22"/></svg>
        </TB>
      )}

      {!minimal && <ImageMenu editor={editor} onAddImage={onAddImage} onUploadImage={onUploadImage} />}

      {!minimal && (
        <>
          <Divider />
          <TableMenu editor={editor} />
        </>
      )}

      <Divider />
      <ColorPicker editor={editor} type="text" />
      <ColorPicker editor={editor} type="highlight" />
      <Divider />

      <TB onClick={() => editor.chain().focus().setHorizontalRule().run()} title={t('tiptap.horizontalRule')}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="2" y1="12" x2="22" y2="12"/></svg>
      </TB>
      <TB onClick={() => editor.chain().focus().clearNodes().unsetAllMarks().run()} title={t('tiptap.clearFormatting')}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 7h16"/><path d="m5 7 4 12"/><path d="M15 7l-2.5 7.5"/><path d="m2 17 4 4"/><path d="m18 13 4 4"/><path d="m2 21 4-4"/><path d="m18 17 4-4"/></svg>
      </TB>

      {onToggleHtmlMode && (
        <>
          <Divider />
          <TB onClick={onToggleHtmlMode} isActive={isHtmlMode} title={isHtmlMode ? t('tiptap.visualMode') : t('tiptap.editHtml')}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="4 7 4 4 20 4 20 7"/><line x1="9" y1="20" x2="15" y2="20"/><line x1="12" y1="4" x2="12" y2="20"/></svg>
            <span style={{ fontSize: 9, marginLeft: 2, fontWeight: 600 }}>HTML</span>
          </TB>
        </>
      )}
    </div>
  );
};

export default EditorToolbar;

/**
 * TiptapEditor - Centralized rich text editor component
 * Replaces TinyMCE across the application
 */

import { useEditor, EditorContent } from '@tiptap/react';
import { BubbleMenu } from '@tiptap/react/menus';
import { StarterKit } from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import TextAlign from '@tiptap/extension-text-align';
import Link from '@tiptap/extension-link';
import Image from '@tiptap/extension-image';
import { Table } from '@tiptap/extension-table';
import { TableRow } from '@tiptap/extension-table-row';
import { TableCell } from '@tiptap/extension-table-cell';
import { TableHeader } from '@tiptap/extension-table-header';
import Highlight from '@tiptap/extension-highlight';
import { Color } from '@tiptap/extension-color';
import { TextStyle } from '@tiptap/extension-text-style';
import CodeBlockLowlight from '@tiptap/extension-code-block-lowlight';
import { CharacterCount } from '@tiptap/extension-character-count';
import { Placeholder } from '@tiptap/extension-placeholder';
import { common, createLowlight } from 'lowlight';
import {
  useCallback,
  useEffect,
  useImperativeHandle,
  forwardRef,
  useState,
  useRef,
  type ChangeEvent,
} from 'react';

import { EditorToolbar } from './EditorToolbar';
import { BubbleToolbar } from './BubbleToolbar';
import './TiptapEditor.css';

const lowlight = createLowlight(common);

// ============================================
// TYPES
// ============================================

export interface TiptapEditorRef {
  getContent: () => string;
  setContent: (html: string) => void;
  getEditor: () => ReturnType<typeof useEditor> | null;
}

export interface TiptapEditorProps {
  content?: string;
  onChange?: (html: string) => void;
  onReady?: () => void;
  height?: number;
  placeholder?: string;
  editable?: boolean;
  /** Minimal toolbar (no table, image, code block) */
  minimal?: boolean;
  /** Custom toolbar buttons to prepend */
  extraToolbarContent?: React.ReactNode;
  /** Class for the outer wrapper */
  className?: string;
}

// ============================================
// COMPONENT
// ============================================

const TiptapEditor = forwardRef<TiptapEditorRef, TiptapEditorProps>(
  (
    {
      content = '',
      onChange,
      onReady,
      height = 500,
      placeholder = '',
      editable = true,
      minimal = false,
      extraToolbarContent,
      className = '',
    },
    ref
  ) => {
    const [ready, setReady] = useState(false);
    const contentSetRef = useRef(false);

    const editor = useEditor({
      extensions: [
        StarterKit.configure({
          codeBlock: false, // replaced by CodeBlockLowlight
          heading: { levels: [1, 2, 3, 4, 5] },
        }),
        Underline,
        TextAlign.configure({
          types: ['heading', 'paragraph'],
          alignments: ['left', 'center', 'right', 'justify'],
        }),
        Link.configure({
          openOnClick: false,
          HTMLAttributes: { rel: 'noopener noreferrer', target: '_blank' },
        }),
        Image.configure({
          inline: true,
          allowBase64: true,
        }),
        Table.configure({ resizable: true }),
        TableRow,
        TableCell,
        TableHeader,
        Highlight.configure({ multicolor: true }),
        TextStyle,
        Color,
        CodeBlockLowlight.configure({ lowlight }),
        CharacterCount,
        Placeholder.configure({ placeholder }),
      ],
      editable,
      content,
      onCreate: () => {
        setReady(true);
        onReady?.();
      },
      onUpdate: ({ editor: e }) => {
        onChange?.(e.getHTML());
      },
    });

    // Set initial content when it arrives after editor creation
    useEffect(() => {
      if (editor && content && !contentSetRef.current) {
        const currentContent = editor.getHTML();
        // Only set if different from what editor already has
        if (currentContent === '<p></p>' || currentContent === '') {
          editor.commands.setContent(content, { emitUpdate: false });
          contentSetRef.current = true;
        }
      }
    }, [editor, content]);

    // Expose imperative methods
    useImperativeHandle(
      ref,
      () => ({
        getContent: () => editor?.getHTML() || '',
        setContent: (html: string) => {
          editor?.commands.setContent(html, { emitUpdate: false });
        },
        getEditor: () => editor,
      }),
      [editor]
    );

    // Word count
    const wordCount = editor?.storage.characterCount?.words() ?? 0;
    const charCount = editor?.storage.characterCount?.characters() ?? 0;

    // Link insertion
    const setLink = useCallback(() => {
      if (!editor) return;
      const previousUrl = editor.getAttributes('link').href;
      const url = window.prompt('URL', previousUrl || 'https://');
      if (url === null) return; // cancelled
      if (url === '') {
        editor.chain().focus().extendMarkRange('link').unsetLink().run();
        return;
      }
      editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
    }, [editor]);

    // Image insertion by URL
    const addImage = useCallback(() => {
      if (!editor) return;
      const url = window.prompt('URL de l\'image');
      if (url) {
        editor.chain().focus().setImage({ src: url }).run();
      }
    }, [editor]);

    // Image upload via file input
    const fileInputRef = useRef<HTMLInputElement>(null);
    const triggerImageUpload = useCallback(() => {
      fileInputRef.current?.click();
    }, []);
    const handleImageUpload = useCallback(
      (e: ChangeEvent<HTMLInputElement>) => {
        if (!editor) return;
        const files = e.target.files;
        if (!files?.length) return;
        Array.from(files).forEach((file) => {
          if (!file.type.startsWith('image/')) return;
          const reader = new FileReader();
          reader.onload = (ev) => {
            const src = ev.target?.result as string;
            if (src) {
              editor.chain().focus().setImage({ src }).run();
            }
          };
          reader.readAsDataURL(file);
        });
        // Reset so same file can be re-selected
        e.target.value = '';
      },
      [editor]
    );

    if (!editor) return null;

    return (
      <div className={`tiptap-editor-wrapper ${className}`}>
        {/* Hidden file input for image upload */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          style={{ display: 'none' }}
          onChange={handleImageUpload}
        />

        {/* Toolbar */}
        <EditorToolbar
          editor={editor}
          onSetLink={setLink}
          onAddImage={addImage}
          onUploadImage={triggerImageUpload}
          minimal={minimal}
          extraContent={extraToolbarContent}
        />

        {/* Bubble menu on text selection */}
        {editor && (
          <BubbleMenu editor={editor}>
            <BubbleToolbar editor={editor} onSetLink={setLink} />
          </BubbleMenu>
        )}

        {/* Editor content */}
        <div
          className="tiptap-editor-content"
          style={{ minHeight: height, maxHeight: height, overflowY: 'auto' }}
        >
          <EditorContent editor={editor} />
        </div>

        {/* Word count footer */}
        <div className="tiptap-editor-footer">
          <span>{wordCount} mots</span>
          <span>{charCount} caractères</span>
        </div>
      </div>
    );
  }
);

TiptapEditor.displayName = 'TiptapEditor';

export default TiptapEditor;

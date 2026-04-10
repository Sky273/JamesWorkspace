/**
 * TiptapEditor - Centralized rich text editor component
 * Replaces TinyMCE across the application
 */

import { useEditor, EditorContent } from '@tiptap/react';
import { BubbleMenu } from '@tiptap/react/menus';
import { isTextSelection } from '@tiptap/core';
import { StarterKit } from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import TextAlign from '@tiptap/extension-text-align';
import Link from '@tiptap/extension-link';
import { CustomImage } from './CustomImage';
import { CustomTable } from './CustomTable';
import { TableRow } from '@tiptap/extension-table-row';
import { CustomTableCell } from './CustomTableCell';
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
import { ImageToolbar } from './ImageToolbar';
import { TableToolbar } from './TableToolbar';
import { SuggestionsExtension } from './SuggestionsExtension';
import type { SuggestionsBySection } from './suggestions.shared';
import { ProofExtension } from './ProofExtension';
import type { SkillProofEntry } from './proof.shared';
import { getSkillProofCount } from './proof.shared';
import { normalizeEditorContent } from './contentNormalization';
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
  /** Improvement suggestions to display as ProseMirror decorations */
  suggestions?: SuggestionsBySection;
  /** Evidence-backed skills/tools to display in the skills section */
  skillProofs?: SkillProofEntry[];
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
      suggestions,
      skillProofs = [],
    },
    ref
  ) => {
    const [_ready, setReady] = useState(false);
    const lastSyncedContentRef = useRef('');
    const [suggestionsVisible, setSuggestionsVisible] = useState(true);
    const [skillProofsVisible, setSkillProofsVisible] = useState(false);
    const [htmlMode, setHtmlMode] = useState(false);
    const [htmlSource, setHtmlSource] = useState('');
    const normalizedContent = normalizeEditorContent(content);

    const editor = useEditor({
      extensions: [
        StarterKit.configure({
          codeBlock: false, // replaced by CodeBlockLowlight
          heading: { levels: [1, 2, 3, 4, 5] },
          link: false,      // configured explicitly below
          underline: false,  // configured explicitly below
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
        CustomImage.configure({
          inline: true,
          allowBase64: true,
        }),
        CustomTable.configure({ resizable: true }),
        TableRow,
        CustomTableCell,
        TableHeader,
        Highlight.configure({ multicolor: true }),
        TextStyle,
        Color,
        CodeBlockLowlight.configure({ lowlight }),
        CharacterCount,
        Placeholder.configure({ placeholder }),
        SuggestionsExtension.configure({ suggestions: suggestions || {} }),
        ProofExtension.configure({ proofs: skillProofs || [] }),
      ],
      editable,
      content: normalizedContent,
      onCreate: () => {
        lastSyncedContentRef.current = normalizedContent;
        setReady(true);
        onReady?.();
      },
      onUpdate: ({ editor: e }) => {
        const nextHtml = e.getHTML();
        lastSyncedContentRef.current = nextHtml;
        onChange?.(nextHtml);
      },
    });

    // Sync suggestions when prop changes
    useEffect(() => {
      if (editor && suggestions) {
        editor.commands.setSuggestions(suggestions);
      }
    }, [editor, suggestions]);

    useEffect(() => {
      if (editor) {
        editor.commands.setSkillProofs(skillProofs || []);
      }
    }, [editor, skillProofs]);

    // Keep editor content in sync with external updates without re-emitting change events.
    useEffect(() => {
      if (!editor) {
        return;
      }

      const currentContent = editor.getHTML();
      if (normalizedContent === lastSyncedContentRef.current || normalizedContent === currentContent) {
        lastSyncedContentRef.current = currentContent;
        return;
      }

      editor.commands.setContent(normalizedContent, { emitUpdate: false });
      lastSyncedContentRef.current = normalizedContent;
    }, [editor, normalizedContent]);

    // Expose imperative methods
    useImperativeHandle(
      ref,
      () => ({
        getContent: () => editor?.getHTML() || '',
        setContent: (html: string) => {
          const normalizedHtml = normalizeEditorContent(html);
          editor?.commands.setContent(normalizedHtml, { emitUpdate: false });
          lastSyncedContentRef.current = normalizedHtml;
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

    // Toggle suggestions visibility
    const handleToggleSuggestions = useCallback(() => {
      if (!editor) return;
      editor.commands.toggleSuggestions();
      setSuggestionsVisible((v) => !v);
    }, [editor]);

    const handleToggleSkillProofs = useCallback(() => {
      if (!editor) return;
      editor.commands.toggleSkillProofs();
      setSkillProofsVisible((v) => !v);
    }, [editor]);

    // Toggle HTML source mode
    const handleToggleHtmlMode = useCallback(() => {
      if (!editor) return;
      if (!htmlMode) {
        // Switching TO html mode: capture current editor HTML
        setHtmlSource(editor.getHTML());
      } else {
        // Switching BACK to WYSIWYG: apply edited HTML
        editor.commands.setContent(htmlSource, { emitUpdate: true });
      }
      setHtmlMode((v) => !v);
    }, [editor, htmlMode, htmlSource]);

    const hasSuggestions =
      suggestions &&
      Object.values(suggestions).flat().filter(Boolean).length > 0;
    const hasSkillProofs = getSkillProofCount(skillProofs || []) > 0;

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
          isHtmlMode={htmlMode}
          onToggleHtmlMode={handleToggleHtmlMode}
          extraContent={
            <>
              {hasSuggestions && (
                <>
                  <button
                    type="button"
                    className={`tiptap-toolbar-btn suggestion-toggle-btn ${suggestionsVisible ? 'is-active' : ''}`}
                    onClick={handleToggleSuggestions}
                    title={suggestionsVisible ? 'Masquer les suggestions' : 'Afficher les suggestions'}
                  >
                    💡
                  </button>
                  <div className="tiptap-toolbar-divider" />
                </>
              )}
              {hasSkillProofs && (
                <>
                  <button
                    type="button"
                    className={`tiptap-toolbar-btn proof-toggle-btn ${skillProofsVisible ? 'is-active' : ''}`}
                    onClick={handleToggleSkillProofs}
                    title={skillProofsVisible ? 'Masquer les preuves de compétences' : 'Afficher les preuves de compétences'}
                  >
                    Preuves
                  </button>
                  <div className="tiptap-toolbar-divider" />
                </>
              )}
              {extraToolbarContent}
            </>
          }
        />

        {/* Bubble menu on text selection and image node selection */}
        {editor && (
          <BubbleMenu
            editor={editor}
            shouldShow={({ editor: e, element, view, state, from, to }) => {
              // Check focus (editor or inside the bubble menu itself)
              const isChildOfMenu = element.contains(document.activeElement);
              const hasEditorFocus = view.hasFocus() || isChildOfMenu;
              if (!hasEditorFocus || !e.isEditable) return false;

              const { selection } = state;

              // Images are handled by ImageToolbar (outside overflow container)
              if (e.isActive('image')) return false;

              // Default text selection behavior
              if (selection.empty) return false;
              const isEmptyTextBlock = !state.doc.textBetween(from, to).length && isTextSelection(selection);
              if (isEmptyTextBlock) return false;

              return true;
            }}
          >
            <BubbleToolbar editor={editor} onSetLink={setLink} />
          </BubbleMenu>
        )}

        {/* Image toolbar (contextual - appears when image selected) */}
        <ImageToolbar editor={editor} />

        {/* Table toolbar (contextual - appears when cursor is in a table) */}
        <TableToolbar editor={editor} />

        {/* Editor content */}
        <div
          className="tiptap-editor-content"
          style={{ minHeight: height, maxHeight: height, overflowY: 'auto' }}
        >
          {htmlMode ? (
            <textarea
              className="tiptap-html-source"
              value={htmlSource}
              onChange={(e) => setHtmlSource(e.target.value)}
              spellCheck={false}
              style={{ minHeight: height - 8, maxHeight: height - 8 }}
            />
          ) : (
            <EditorContent editor={editor} />
          )}
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

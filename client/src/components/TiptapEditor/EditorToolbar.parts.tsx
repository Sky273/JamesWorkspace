/**
 * EditorToolbar - Full toolbar primitives for TiptapEditor.
 */

import type { Editor } from '@tiptap/react';
import { useCallback } from 'react';
import {
  COLORS,
  HEADING_LABELS,
  HEADING_LEVELS,
  HEADING_SIZES,
} from './EditorToolbar.data';
import { Dropdown } from './EditorToolbar.dropdown';
import { useDismissiblePopover } from './EditorToolbar.hooks';
export { ImageMenu } from './EditorToolbar.mediaMenu';
export { TableMenu } from './EditorToolbar.tableMenu';

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

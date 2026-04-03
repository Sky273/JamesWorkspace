import type { Editor } from '@tiptap/react';
import { Dropdown } from './EditorToolbar.dropdown';

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

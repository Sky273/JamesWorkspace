/**
 * TinyMCE Global Type Declarations
 */

export interface TinyMCEEditor {
  remove: () => void;
  setContent: (content: string) => void;
  getContent: () => string;
  on: (event: string, callback: () => void) => void;
  id: string;
  getBody: () => HTMLElement;
  selection: {
    getContent: (args?: { format?: string }) => string;
    setContent: (content: string) => void;
    getNode: () => HTMLElement;
    getRng: () => Range;
    collapse: (toStart?: boolean) => void;
  };
  annotator?: {
    register: (name: string, settings: {
      persistent?: boolean;
      decorate?: (uid: string, data: Record<string, unknown>) => {
        attributes?: Record<string, string>;
        classes?: string[];
      };
    }) => void;
    annotate: (name: string, data: Record<string, unknown>) => void;
    remove: (name: string) => void;
    getAll: (name: string) => Record<string, HTMLElement[]>;
  };
  ui: {
    registry: {
      addButton: (name: string, config: {
        text?: string;
        icon?: string;
        tooltip?: string;
        onAction?: () => void;
        onSetup?: (api: unknown) => void;
      }) => void;
    };
  };
  windowManager: {
    open: (config: {
      title: string;
      body: {
        type: string;
        items: Array<{
          type: string;
          html?: string;
          name?: string;
          label?: string;
        }>;
      };
      buttons: Array<{
        type: string;
        text: string;
        primary?: boolean;
      }>;
      onSubmit?: (api: unknown) => void;
    }) => void;
  };
}

export interface TinyMCEInitConfig {
  selector?: string;
  height?: number;
  menubar?: boolean;
  plugins?: string | string[];
  toolbar?: string;
  content_style?: string;
  branding?: boolean;
  promotion?: boolean;
  license_key?: string;
  setup?: (editor: TinyMCEEditor) => void;
  [key: string]: unknown;
}

export interface TinyMCE {
  init: (config: TinyMCEInitConfig) => Promise<TinyMCEEditor[]>;
  get: (id: string) => TinyMCEEditor | null;
  remove: (selector: string) => void;
}

declare global {
  interface Window {
    tinymce: TinyMCE | undefined;
  }
}

export {};

// Module declarations for TinyMCE dynamic imports
declare module 'tinymce/tinymce';
declare module 'tinymce/themes/silver';
declare module 'tinymce/skins/ui/oxide/skin.css';
declare module 'tinymce/skins/ui/oxide/content.css';
declare module 'tinymce/skins/content/default/content.css';
declare module 'tinymce/icons/default';
declare module 'tinymce/models/dom/model';
declare module 'tinymce/plugins/advlist';
declare module 'tinymce/plugins/autolink';
declare module 'tinymce/plugins/lists';
declare module 'tinymce/plugins/link';
declare module 'tinymce/plugins/image';
declare module 'tinymce/plugins/charmap';
declare module 'tinymce/plugins/preview';
declare module 'tinymce/plugins/anchor';
declare module 'tinymce/plugins/searchreplace';
declare module 'tinymce/plugins/visualblocks';
declare module 'tinymce/plugins/code';
declare module 'tinymce/plugins/fullscreen';
declare module 'tinymce/plugins/insertdatetime';
declare module 'tinymce/plugins/media';
declare module 'tinymce/plugins/table';
declare module 'tinymce/plugins/help';
declare module 'tinymce/plugins/wordcount';

// Word extractor module declaration
declare module 'word-extractor';

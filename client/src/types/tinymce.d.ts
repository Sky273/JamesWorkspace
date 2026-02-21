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

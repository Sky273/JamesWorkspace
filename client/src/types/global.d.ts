/**
 * Global Type Declarations
 * Declares modules without type definitions
 */

// TinyMCE global
declare global {
  interface Window {
    tinymce: typeof import('tinymce');
  }
}

// Modules without types
declare module 'word-extractor' {
  interface Document {
    getBody(): string;
    getFootnotes(): string;
    getEndnotes(): string;
    getHeaders(): string;
    getFooters(): string;
    getAnnotations(): string;
  }

  class WordExtractor {
    extract(input: Buffer | string): Promise<Document>;
  }

  export default WordExtractor;
}

declare module '*.md?raw' {
  const content: string;
  export default content;
}

export {};

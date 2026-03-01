/**
 * Global Type Declarations
 * Declares modules without type definitions
 */

import type { JSX as ReactJSX } from 'react';

// React 19 compatibility: restore JSX namespace in global scope
declare global {
  namespace JSX {
    type Element = ReactJSX.Element;
    type ElementClass = ReactJSX.ElementClass;
    type ElementAttributesProperty = ReactJSX.ElementAttributesProperty;
    type ElementChildrenAttribute = ReactJSX.ElementChildrenAttribute;
    type LibraryManagedAttributes<C, P> = ReactJSX.LibraryManagedAttributes<C, P>;
    type IntrinsicAttributes = ReactJSX.IntrinsicAttributes;
    type IntrinsicClassAttributes<T> = ReactJSX.IntrinsicClassAttributes<T>;
    type IntrinsicElements = ReactJSX.IntrinsicElements;
  }
}

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

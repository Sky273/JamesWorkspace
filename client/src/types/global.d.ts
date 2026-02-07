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
declare module 'html2pdf.js' {
  interface Html2PdfOptions {
    margin?: number | number[];
    filename?: string;
    image?: { type?: string; quality?: number };
    html2canvas?: Record<string, unknown>;
    jsPDF?: { unit?: string; format?: string; orientation?: string };
  }

  interface Html2Pdf {
    from(element: HTMLElement | string): Html2Pdf;
    set(options: Html2PdfOptions): Html2Pdf;
    save(): Promise<void>;
    outputPdf(type?: string): Promise<Blob | string>;
    toPdf(): Html2Pdf;
  }

  function html2pdf(): Html2Pdf;
  export default html2pdf;
}

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

/**
 * Lazy loading module for PDF.js
 * This module loads pdfjs-dist on demand to reduce initial bundle size
 */

import { useState, useEffect } from 'react';
import type * as PDFJS from 'pdfjs-dist';

type PDFJSModule = typeof PDFJS;

let pdfjsModule: PDFJSModule | null = null;
let loadingPromise: Promise<PDFJSModule> | null = null;

/**
 * Dynamically load PDF.js
 * @returns The pdfjs module
 */
export async function loadPdfjs(): Promise<PDFJSModule> {
    // Return existing promise if already loading
    if (loadingPromise) {
        return loadingPromise;
    }
    
    // Return cached module if already loaded
    if (pdfjsModule) {
        return pdfjsModule;
    }
    
    loadingPromise = (async () => {
        try {
            const pdfjs = await import('pdfjs-dist');
            const workerSrc = await import('pdfjs-dist/build/pdf.worker.min.mjs?url');
            
            // Configure the worker
            pdfjs.GlobalWorkerOptions.workerSrc = workerSrc.default;
            
            pdfjsModule = pdfjs;
            return pdfjsModule;
        } catch (error) {
            loadingPromise = null;
            throw error;
        }
    })();
    
    return loadingPromise;
}

/**
 * Check if PDF.js is loaded
 */
export function isPdfjsLoaded(): boolean {
    return pdfjsModule !== null;
}

/**
 * Get the loaded PDF.js module (returns null if not loaded)
 */
export function getPdfjs(): PDFJSModule | null {
    return pdfjsModule;
}

interface UsePdfjsLoaderResult {
    pdfjs: PDFJSModule | null;
    isLoaded: boolean;
    error: Error | null;
}

/**
 * Hook for React components to use PDF.js with lazy loading
 */
export function usePdfjsLoader(): UsePdfjsLoaderResult {
    const [pdfjs, setPdfjs] = useState<PDFJSModule | null>(null);
    const [isLoaded, setIsLoaded] = useState(false);
    const [error, setError] = useState<Error | null>(null);
    
    useEffect(() => {
        let mounted = true;
        
        loadPdfjs()
            .then((module) => {
                if (mounted) {
                    setPdfjs(module);
                    setIsLoaded(true);
                }
            })
            .catch((err) => {
                if (mounted) setError(err);
            });
        
        return () => { mounted = false; };
    }, []);
    
    return { pdfjs, isLoaded, error };
}

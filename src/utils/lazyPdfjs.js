/**
 * Lazy loading module for PDF.js
 * This module loads pdfjs-dist on demand to reduce initial bundle size
 */

import { useState, useEffect } from 'react';

let pdfjsModule = null;
let loadingPromise = null;

/**
 * Dynamically load PDF.js
 * @returns {Promise<Object>} The pdfjs module
 */
export async function loadPdfjs() {
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
 * @returns {boolean}
 */
export function isPdfjsLoaded() {
    return pdfjsModule !== null;
}

/**
 * Get the loaded PDF.js module (returns null if not loaded)
 * @returns {Object|null}
 */
export function getPdfjs() {
    return pdfjsModule;
}

/**
 * Hook for React components to use PDF.js with lazy loading
 * @returns {{ pdfjs: Object|null, isLoaded: boolean, error: Error|null }}
 */
export function usePdfjsLoader() {
    const [pdfjs, setPdfjs] = useState(null);
    const [isLoaded, setIsLoaded] = useState(false);
    const [error, setError] = useState(null);
    
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

/**
 * Lazy loading module for Tesseract.js (OCR)
 * This module loads tesseract.js on demand to reduce initial bundle size
 */

import { useState, useEffect } from 'react';

let tesseractModule = null;
let loadingPromise = null;

/**
 * Dynamically load Tesseract.js
 * @returns {Promise<Object>} The tesseract module with createWorker function
 */
export async function loadTesseract() {
    // Return existing promise if already loading
    if (loadingPromise) {
        return loadingPromise;
    }
    
    // Return cached module if already loaded
    if (tesseractModule) {
        return tesseractModule;
    }
    
    loadingPromise = (async () => {
        try {
            const tesseract = await import('tesseract.js');
            tesseractModule = tesseract;
            return tesseractModule;
        } catch (error) {
            loadingPromise = null;
            throw error;
        }
    })();
    
    return loadingPromise;
}

/**
 * Create a Tesseract worker with lazy loading
 * @param {string} lang - Language code (default: 'eng')
 * @returns {Promise<Object>} Tesseract worker instance
 */
export async function createLazyWorker(lang = 'eng') {
    const tesseract = await loadTesseract();
    const worker = await tesseract.createWorker(lang);
    return worker;
}

/**
 * Check if Tesseract is loaded
 * @returns {boolean}
 */
export function isTesseractLoaded() {
    return tesseractModule !== null;
}

/**
 * Hook for React components to use Tesseract with lazy loading
 * @returns {{ tesseract: Object|null, isLoaded: boolean, error: Error|null }}
 */
export function useTesseractLoader() {
    const [tesseract, setTesseract] = useState(null);
    const [isLoaded, setIsLoaded] = useState(false);
    const [error, setError] = useState(null);
    
    useEffect(() => {
        let mounted = true;
        
        loadTesseract()
            .then((module) => {
                if (mounted) {
                    setTesseract(module);
                    setIsLoaded(true);
                }
            })
            .catch((err) => {
                if (mounted) setError(err);
            });
        
        return () => { mounted = false; };
    }, []);
    
    return { tesseract, isLoaded, error };
}

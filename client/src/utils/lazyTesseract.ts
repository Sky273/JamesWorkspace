/**
 * Lazy loading module for Tesseract.js (OCR)
 * This module loads tesseract.js on demand to reduce initial bundle size
 */

import { useState, useEffect } from 'react';
import type * as Tesseract from 'tesseract.js';

type TesseractModule = typeof Tesseract;

let tesseractModule: TesseractModule | null = null;
let loadingPromise: Promise<TesseractModule> | null = null;

/**
 * Dynamically load Tesseract.js
 * @returns The tesseract module with createWorker function
 */
export async function loadTesseract(): Promise<TesseractModule> {
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
 * @param lang - Language code (default: 'eng')
 * @returns Tesseract worker instance
 */
export async function createLazyWorker(lang: string = 'eng'): Promise<Tesseract.Worker> {
    const tesseract = await loadTesseract();
    const worker = await tesseract.createWorker(lang);
    return worker;
}

/**
 * Check if Tesseract is loaded
 */
export function isTesseractLoaded(): boolean {
    return tesseractModule !== null;
}

interface UseTesseractLoaderResult {
    tesseract: TesseractModule | null;
    isLoaded: boolean;
    error: Error | null;
}

/**
 * Hook for React components to use Tesseract with lazy loading
 */
export function useTesseractLoader(): UseTesseractLoaderResult {
    const [tesseract, setTesseract] = useState<TesseractModule | null>(null);
    const [isLoaded, setIsLoaded] = useState(false);
    const [error, setError] = useState<Error | null>(null);
    
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

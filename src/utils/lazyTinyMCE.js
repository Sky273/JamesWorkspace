/**
 * Lazy loading module for TinyMCE
 * This module loads TinyMCE and its plugins on demand to reduce initial bundle size
 */

import { useState, useEffect } from 'react';

let tinymceLoaded = false;
let loadingPromise = null;

/**
 * Dynamically load TinyMCE and all required plugins
 * @returns {Promise<void>} Resolves when TinyMCE is fully loaded
 */
export async function loadTinyMCE() {
    // Return existing promise if already loading
    if (loadingPromise) {
        return loadingPromise;
    }
    
    // Return immediately if already loaded
    if (tinymceLoaded) {
        return Promise.resolve();
    }
    
    loadingPromise = (async () => {
        try {
            // Load TinyMCE core
            await import('tinymce/tinymce');
            
            // Load theme and skins
            await Promise.all([
                import('tinymce/themes/silver'),
                import('tinymce/skins/ui/oxide/skin.css'),
                import('tinymce/skins/ui/oxide/content.css'),
                import('tinymce/skins/content/default/content.css'),
                import('tinymce/icons/default'),
                import('tinymce/models/dom/model')
            ]);
            
            // Load plugins in parallel
            await Promise.all([
                import('tinymce/plugins/advlist'),
                import('tinymce/plugins/autolink'),
                import('tinymce/plugins/lists'),
                import('tinymce/plugins/link'),
                import('tinymce/plugins/image'),
                import('tinymce/plugins/charmap'),
                import('tinymce/plugins/preview'),
                import('tinymce/plugins/anchor'),
                import('tinymce/plugins/searchreplace'),
                import('tinymce/plugins/visualblocks'),
                import('tinymce/plugins/code'),
                import('tinymce/plugins/fullscreen'),
                import('tinymce/plugins/insertdatetime'),
                import('tinymce/plugins/media'),
                import('tinymce/plugins/table'),
                import('tinymce/plugins/help'),
                import('tinymce/plugins/wordcount')
            ]);
            
            tinymceLoaded = true;
        } catch (error) {
            loadingPromise = null;
            throw error;
        }
    })();
    
    return loadingPromise;
}

/**
 * Check if TinyMCE is loaded
 * @returns {boolean}
 */
export function isTinyMCELoaded() {
    return tinymceLoaded;
}

/**
 * Hook for React components to use TinyMCE with lazy loading
 * Usage: const { isLoaded, error } = useTinyMCE();
 */
export function useTinyMCELoader() {
    const [isLoaded, setIsLoaded] = useState(false);
    const [error, setError] = useState(null);
    
    useEffect(() => {
        let mounted = true;
        
        loadTinyMCE()
            .then(() => {
                if (mounted) setIsLoaded(true);
            })
            .catch((err) => {
                if (mounted) setError(err);
            });
        
        return () => { mounted = false; };
    }, []);
    
    return { isLoaded, error };
}


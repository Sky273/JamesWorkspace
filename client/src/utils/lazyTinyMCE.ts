/**
 * @deprecated TinyMCE has been replaced by Tiptap.
 * This file is kept as a stub to avoid broken imports.
 * All editor functionality now uses TiptapEditor from components/TiptapEditor.
 */

export async function loadTinyMCE(): Promise<void> {
    return Promise.resolve();
}

export function isTinyMCELoaded(): boolean {
    return false;
}

export function useTinyMCELoader(): { isLoaded: boolean; error: Error | null } {
    return { isLoaded: false, error: null };
}

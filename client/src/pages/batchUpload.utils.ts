/**
 * Batch Upload Utilities
 * File traversal helpers and types for BatchUploadPage
 * Extracted from BatchUploadPage.tsx
 */

// Extended File type with custom path property
export type FileWithPath = File & {
  customRelativePath?: string;
};

export interface FileStatus {
  file: File;
  relativePath?: string; // Preserve folder structure from webkitRelativePath
  status: 'pending' | 'uploading' | 'extracting' | 'analyzing' | 'improving' | 'exporting' | 'success' | 'error';
  progress: number;
  error?: string;
  resumeId?: string;
  resumeName?: string;
}

export type ExportFormat = 'pdf' | 'docx' | 'doc';
export type ExportFormats = ExportFormat[];

// Helper to traverse directory entries and get files with paths
export const traverseFileTree = async (entry: FileSystemEntry, path: string = ''): Promise<FileWithPath[]> => {
  const files: FileWithPath[] = [];
  
  if (entry.isFile) {
    const fileEntry = entry as FileSystemFileEntry;
    return new Promise((resolve) => {
      fileEntry.file((file) => {
        // Create a new file with the relative path stored in custom property
        const fileWithPath = file as FileWithPath;
        fileWithPath.customRelativePath = path + file.name;
        resolve([fileWithPath]);
      }, () => resolve([]));
    });
  } else if (entry.isDirectory) {
    const dirEntry = entry as FileSystemDirectoryEntry;
    const dirReader = dirEntry.createReader();
    
    return new Promise((resolve) => {
      const readEntries = (allEntries: FileSystemEntry[] = []) => {
        dirReader.readEntries(async (entries) => {
          if (entries.length === 0) {
            // All entries read, process them
            const filePromises = allEntries.map(e => 
              traverseFileTree(e, path + entry.name + '/')
            );
            const fileArrays = await Promise.all(filePromises);
            resolve(fileArrays.flat());
          } else {
            // More entries to read
            readEntries([...allEntries, ...entries]);
          }
        }, () => resolve([]));
      };
      readEntries();
    });
  }
  
  return files;
};

// Custom getFilesFromEvent to preserve folder structure
export const getFilesFromEvent = async (event: Event | DragEvent | FileSystemFileHandle[]): Promise<FileWithPath[]> => {
  const files: FileWithPath[] = [];
  
  // Handle FileSystemFileHandle[] (new API in react-dropzone v15)
  if (Array.isArray(event)) {
    console.log('[getFilesFromEvent] Received FileSystemFileHandle array:', event.length);
    for (const handle of event) {
      if ('getFile' in handle && typeof handle.getFile === 'function') {
        try {
          const file = await (handle as FileSystemFileHandle).getFile();
          files.push(file as FileWithPath);
        } catch (error) {
          console.error('[getFilesFromEvent] Error getting file from handle:', error);
        }
      }
    }
    console.log('[getFilesFromEvent] Files from handles:', files.length);
    return files;
  }
  
  // Handle DragEvent
  const dragEvent = event as DragEvent;
  console.log('[getFilesFromEvent] Event type:', dragEvent.type, 'Has dataTransfer:', !!dragEvent.dataTransfer);
  
  if (dragEvent.dataTransfer) {
    const items = dragEvent.dataTransfer.items;
    const dataTransferFiles = dragEvent.dataTransfer.files;
    
    console.log('[getFilesFromEvent] items length:', items?.length, 'files length:', dataTransferFiles?.length);
    
    // IMPORTANT: Collect entries synchronously before any async operations
    // because dataTransfer.items is cleared by the browser after the event handler returns
    if (items && items.length > 0) {
      const entries: FileSystemEntry[] = [];
      
      // Collect all entries SYNCHRONOUSLY first
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        console.log('[getFilesFromEvent] Item', i, 'kind:', item.kind, 'type:', item.type);
        if (item.kind === 'file') {
          const entry = item.webkitGetAsEntry?.();
          console.log('[getFilesFromEvent] Entry:', entry?.name, 'isFile:', entry?.isFile, 'isDirectory:', entry?.isDirectory);
          if (entry) {
            entries.push(entry);
          }
        }
      }
      
      console.log('[getFilesFromEvent] Collected entries:', entries.length);
      
      // Now process entries asynchronously
      if (entries.length > 0) {
        try {
          const filePromises = entries.map(entry => traverseFileTree(entry));
          const fileArrays = await Promise.all(filePromises);
          files.push(...fileArrays.flat());
          console.log('[getFilesFromEvent] Files from entries:', files.length);
        } catch (error) {
          console.error('[getFilesFromEvent] Error traversing file tree:', error);
        }
      }
    }
    
    // Fallback to regular files if no entries found or traversal failed
    if (files.length === 0 && dataTransferFiles && dataTransferFiles.length > 0) {
      console.log('[getFilesFromEvent] Using fallback dataTransfer.files');
      for (let i = 0; i < dataTransferFiles.length; i++) {
        files.push(dataTransferFiles[i] as FileWithPath);
      }
    }
  }
  
  // Handle input change event
  const inputEvent = event as Event;
  if ('target' in inputEvent && inputEvent.target) {
    const input = inputEvent.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      console.log('[getFilesFromEvent] Files from input:', input.files.length);
      for (let i = 0; i < input.files.length; i++) {
        files.push(input.files[i] as FileWithPath);
      }
    }
  }
  
  console.log('[getFilesFromEvent] Returning files:', files.length);
  return files;
};

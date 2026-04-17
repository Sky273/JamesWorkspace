import path from 'path';
import fs from 'fs';
import os from 'os';
import { normalizeArchiveRelativePath } from '../../utils/archiveRelativePath.js';

export function getBatchExportMaxOperations() {
    const configuredValue = Number.parseInt(process.env.BATCH_EXPORT_MAX_OPERATIONS || '', 10);
    if (!Number.isFinite(configuredValue) || configuredValue < 1) {
        return 300;
    }

    return Math.min(configuredValue, 300);
}

export function getBatchExportBatchSize() {
    const configuredValue = Number.parseInt(process.env.BATCH_EXPORT_BATCH_SIZE || '', 10);
    if (!Number.isFinite(configuredValue) || configuredValue < 1) {
        return 100;
    }

    return Math.min(configuredValue, 100);
}

export function buildSafeArchiveFilePath(relativePath, generatedFileName) {
    const normalizedRelativePath = normalizeArchiveRelativePath(relativePath);
    if (!normalizedRelativePath) {
        return generatedFileName;
    }

    const archiveDirectory = path.posix.dirname(normalizedRelativePath);
    if (!archiveDirectory || archiveDirectory === '.') {
        return generatedFileName;
    }

    return `${archiveDirectory}/${generatedFileName}`;
}

export async function createTempExportWorkspace(jobId) {
    return fs.promises.mkdtemp(path.join(os.tmpdir(), `batch-export-${jobId}-`));
}

export async function persistGeneratedArtifact(tempDir, itemId, format, content) {
    const artifactPath = path.join(tempDir, `${itemId}-${format}-${Date.now()}`);
    await fs.promises.writeFile(artifactPath, Buffer.from(content));
    return artifactPath;
}

export function buildExportItemSelection(items) {
    const statusCounts = items.reduce((acc, item) => {
        acc[item.status] = (acc[item.status] || 0) + 1;
        return acc;
    }, {});
    const successfulItems = items.filter(item => item.status === 'success' && (item.resume_id || item.adaptation_id));
    const successWithoutResumeId = items.filter(item => item.status === 'success' && !item.resume_id && !item.adaptation_id);
    const skippedItems = items.length - successfulItems.length;
    const itemsWithRelativePath = successfulItems.filter(item => item.relative_path);

    return {
        statusCounts,
        successfulItems,
        successWithoutResumeId,
        skippedItems,
        itemsWithRelativePath
    };
}

export function createItemResultsMap(successfulItems) {
    const itemResults = new Map();
    for (const item of successfulItems) {
        itemResults.set(item.id, { item, failures: [], successCount: 0 });
    }
    return itemResults;
}

export function createFormatFolders(zip, exportFormats) {
    const formatFolders = {};
    for (const format of exportFormats) {
        formatFolders[format] = { root: zip.folder(format.toUpperCase()) };
    }
    return formatFolders;
}

export function resolveDuplicateArchivePath(filePath, fileNameCounts) {
    const count = fileNameCounts.get(filePath) || 0;
    let resolvedPath = filePath;

    if (count > 0) {
        const lastDot = filePath.lastIndexOf('.');
        if (lastDot > 0) {
            resolvedPath = `${filePath.substring(0, lastDot)}_${count + 1}${filePath.substring(lastDot)}`;
        } else {
            resolvedPath = `${filePath}_${count + 1}`;
        }
    }

    fileNameCounts.set(filePath, count + 1);
    return resolvedPath;
}

export function countActualZipFiles(zip) {
    return Object.values(zip.files).filter(file => !file.dir).length;
}

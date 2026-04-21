import path from 'path';
import fs from 'fs';
import os from 'os';
import { pipeline } from 'stream/promises';

export async function writeExportArchiveToDisk({ zip, jobId }) {
    const exportsDir = path.join(os.tmpdir(), 'batch-exports');
    await fs.promises.mkdir(exportsDir, { recursive: true });

    const fileName = `export_${jobId}_${Date.now()}.zip`;
    const filePath = path.join(exportsDir, fileName);
    const zipStream = typeof zip.generateNodeStream === 'function'
        ? zip.generateNodeStream({ streamFiles: true, compression: 'DEFLATE' })
        : null;

    if (zipStream) {
        try {
            await pipeline(zipStream, fs.createWriteStream(filePath));
        } catch (error) {
            error.partialArchivePath = filePath;
            throw error;
        }
    } else {
        const zipBuffer = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
        await fs.promises.writeFile(filePath, zipBuffer);
    }

    const archiveBytes = (await fs.promises.stat(filePath)).size;
    return { fileName, filePath, archiveBytes };
}

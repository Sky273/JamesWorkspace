import { execFile } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import path from 'path';
import { createGzip, createGunzip } from 'zlib';
import { pipeline } from 'stream/promises';
import { safeLog } from '../../utils/logger.backend.js';

const execFileAsync = promisify(execFile);

const PG_BIN_PATHS = [
    '/usr/lib/postgresql/18/bin',
    '/usr/lib/postgresql/17/bin',
    '/usr/lib/postgresql/16/bin',
    '/usr/bin',
    ''
];

export async function findPgBinary(binaryName) {
    for (const binPath of PG_BIN_PATHS) {
        const fullPath = binPath ? path.join(binPath, binaryName) : binaryName;
        try {
            if (!binPath) {
                return fullPath;
            }

            await fs.promises.access(fullPath);
            return fullPath;
        } catch {
            // Continue to next path.
        }
    }

    return binaryName;
}

export async function readBackupFilePrefix(filePath, maxBytes = 5000) {
    const fd = await fs.promises.open(filePath, 'r');
    try {
        const buffer = Buffer.alloc(maxBytes);
        const { bytesRead } = await fd.read(buffer, 0, maxBytes, 0);
        return buffer.subarray(0, bytesRead).toString('utf8');
    } finally {
        await fd.close();
    }
}

export async function fileExists(filePath) {
    try {
        await fs.promises.access(filePath);
        return true;
    } catch {
        return false;
    }
}

export async function safeUnlink(filePath) {
    try {
        await fs.promises.unlink(filePath);
    } catch (error) {
        if (error?.code !== 'ENOENT') {
            throw error;
        }
    }
}

export async function cleanupBackupArtifacts(paths) {
    try {
        for (const filePath of paths) {
            if (filePath && await fileExists(filePath)) {
                await safeUnlink(filePath);
            }
        }
    } catch {
        // Ignore cleanup errors.
    }
}

export async function createBackupArtifact({
    binaryName = 'pg_dump',
    versionErrorMessage,
    dumpArgs,
    env,
    localPath,
    compressedPath
}) {
    const pgDumpBin = await findPgBinary(binaryName);

    try {
        await execFileAsync(pgDumpBin, ['--version']);
    } catch {
        throw new Error(versionErrorMessage);
    }

    await execFileAsync(pgDumpBin, dumpArgs, { env });

    const source = fs.createReadStream(localPath);
    const destination = fs.createWriteStream(compressedPath);
    const gzip = createGzip();

    await pipeline(source, gzip, destination);
    await safeUnlink(localPath);

    return { binaryPath: pgDumpBin };
}

export async function restoreBackupArtifact({
    binaryName = 'psql',
    versionErrorMessage,
    env,
    localCompressedPath,
    localPath,
    restoreArgs,
    legacyTruncateArgs
}) {
    const source = fs.createReadStream(localCompressedPath);
    const destination = fs.createWriteStream(localPath);
    const gunzip = createGunzip();

    await pipeline(source, gunzip, destination);
    await safeUnlink(localCompressedPath);

    const psqlBin = await findPgBinary(binaryName);

    try {
        await execFileAsync(psqlBin, ['--version']);
    } catch {
        throw new Error(versionErrorMessage);
    }

    const backupContent = await readBackupFilePrefix(localPath, 5000);
    const hasDropCommands = backupContent.includes('DROP TABLE') || backupContent.includes('DROP SCHEMA');

    if (!hasDropCommands && legacyTruncateArgs) {
        safeLog('info', 'Old backup format detected, truncating tables before restore');

        try {
            await execFileAsync(psqlBin, legacyTruncateArgs, { env });
            safeLog('info', 'Tables truncated successfully');
        } catch (truncateError) {
            safeLog('warn', 'Failed to truncate tables, continuing with restore', { error: truncateError.message });
        }
    }

    await execFileAsync(psqlBin, restoreArgs, { env });
    await safeUnlink(localPath);

    return { binaryPath: psqlBin, hasDropCommands };
}

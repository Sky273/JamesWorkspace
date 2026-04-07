const path = require('path');
const { promisify } = require('util');
const { execFile } = require('child_process');

const execFileAsync = promisify(execFile);
const TRANSIENT_CLEANUP_ERROR_CODES = new Set(['EBUSY', 'EPERM']);

function createTempArtifactPaths({ tempDir, prefix, outputs }) {
  const tempId = `${prefix}_${Date.now()}_${Math.random().toString(36).substring(7)}`;
  const files = {};

  for (const [name, extension] of Object.entries(outputs)) {
    files[name] = path.join(tempDir, `${tempId}.${extension}`);
  }

  return { tempId, files };
}

async function runExternalCommand({ command, args = [], cwd, timeout, failureMessage, log, logContext, signal }) {
  try {
    await execFileAsync(command, args, {
      cwd,
      timeout,
      signal,
      windowsHide: true,
      maxBuffer: 10 * 1024 * 1024
    });
  } catch (error) {
    log('error', failureMessage, { error: error.message, ...logContext });
    throw error;
  }
}

function isTransientCleanupError(error) {
  return TRANSIENT_CLEANUP_ERROR_CODES.has(error?.code);
}

async function removeTempFileWithRetry({ fs, filePath, maxAttempts = 2 }) {
  let lastError = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      await fs.unlink(filePath);
      return null;
    } catch (error) {
      if (error?.code === 'ENOENT') {
        return null;
      }

      lastError = error;
      if (!isTransientCleanupError(error) || attempt === maxAttempts) {
        break;
      }
    }
  }

  return lastError;
}

async function cleanupTempFiles({ fs, log, filePaths }) {
  const cleanupErrors = [];

  for (const filePath of filePaths) {
    if (!filePath) {
      continue;
    }

    const cleanupError = await removeTempFileWithRetry({ fs, filePath });
    if (cleanupError) {
      cleanupErrors.push({
        filePath,
        error: cleanupError.message,
        code: cleanupError.code
      });
    }
  }

  if (cleanupErrors.length > 0) {
    log('warn', 'Failed to cleanup temp files', {
      failures: cleanupErrors.length,
      errors: cleanupErrors
    });
  }
}

module.exports = {
  cleanupTempFiles,
  createTempArtifactPaths,
  runExternalCommand,
  _internal: {
    isTransientCleanupError,
    removeTempFileWithRetry
  }
};

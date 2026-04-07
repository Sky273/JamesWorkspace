const path = require('path');
const { promisify } = require('util');
const { execFile } = require('child_process');

const execFileAsync = promisify(execFile);

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

async function cleanupTempFiles({ fs, log, filePaths }) {
  const cleanupErrors = [];

  for (const filePath of filePaths) {
    if (!filePath) {
      continue;
    }

    try {
      await fs.unlink(filePath);
    } catch (error) {
      if (error?.code !== 'ENOENT') {
        cleanupErrors.push({
          filePath,
          error: error.message
        });
      }
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
  runExternalCommand
};

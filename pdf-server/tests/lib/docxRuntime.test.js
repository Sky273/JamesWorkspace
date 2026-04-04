import { describe, it, expect, vi } from 'vitest';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const {
  cleanupTempFiles,
  createTempArtifactPaths,
  runExternalCommand
} = require('../../lib/docxRuntime.cjs');

describe('docxRuntime', () => {
  it('creates stable temp artifact paths for named outputs', () => {
    vi.spyOn(Date, 'now').mockReturnValue(1234567890);
    vi.spyOn(Math, 'random').mockReturnValue(0.123456789);

    const result = createTempArtifactPaths({
      tempDir: 'C:\\temp',
      prefix: 'docx',
      outputs: { html: 'html', docx: 'docx' }
    });

    expect(result.files.html).toContain('docx_1234567890');
    expect(result.files.html.endsWith('.html')).toBe(true);
    expect(result.files.docx.endsWith('.docx')).toBe(true);

    Date.now.mockRestore();
    Math.random.mockRestore();
  });

  it('wraps external command failures with logging context', async () => {
    const log = vi.fn();

    await expect(runExternalCommand({
      command: 'does-not-exist',
      args: ['--version'],
      log,
      timeout: 30000,
      failureMessage: 'Pandoc failed'
    })).rejects.toThrow();

    expect(log).toHaveBeenCalledWith('error', 'Pandoc failed', expect.objectContaining({
      error: expect.any(String)
    }));
  });

  it('cleans up temp files and ignores already-missing paths', async () => {
    const fs = {
      unlink: vi.fn((filePath) => filePath.endsWith('.html')
        ? Promise.resolve()
        : Promise.reject(Object.assign(new Error('ENOENT'), { code: 'ENOENT' })))
    };
    const log = vi.fn();

    await cleanupTempFiles({
      fs,
      log,
      filePaths: ['C:\\temp\\a.html', 'C:\\temp\\b.docx']
    });

    expect(fs.unlink).toHaveBeenCalledTimes(2);
    expect(fs.unlink).toHaveBeenCalledWith('C:\\temp\\a.html');
    expect(log).not.toHaveBeenCalled();
  });
});

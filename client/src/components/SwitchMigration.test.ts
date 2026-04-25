import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'fs';
import path from 'path';

const runtimeRoots = [
  path.resolve(__dirname, '..'),
];

function collectRuntimeSourceFiles(directory: string): string[] {
  return readdirSync(directory).flatMap((entry) => {
    const fullPath = path.join(directory, entry);
    const stats = statSync(fullPath);

    if (stats.isDirectory()) {
      return collectRuntimeSourceFiles(fullPath);
    }

    if (!/\.(ts|tsx)$/.test(entry) || /\.(test|spec)\.(ts|tsx)$/.test(entry)) {
      return [];
    }

    return [fullPath];
  });
}

describe('checkbox migration', () => {
  it('does not render native checkbox inputs in runtime source', () => {
    const offenders = runtimeRoots
      .flatMap(collectRuntimeSourceFiles)
      .filter((filePath) => /type\s*=\s*["']checkbox["']/.test(readFileSync(filePath, 'utf8')))
      .map((filePath) => path.relative(path.resolve(__dirname, '..', '..'), filePath));

    expect(offenders).toEqual([]);
  });
});

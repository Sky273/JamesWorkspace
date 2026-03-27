import fs from 'fs';
import path from 'path';

export function tiptapV3SourcePlugin() {
  const tiptapDir = path.resolve(__dirname, '../../node_modules/@tiptap');
  const resolutionCache = new Map();

  const cachedResolution = (cacheKey, resolver) => {
    if (resolutionCache.has(cacheKey)) {
      return resolutionCache.get(cacheKey);
    }

    const resolved = resolver();
    resolutionCache.set(cacheKey, resolved);
    return resolved;
  };

  return {
    name: 'tiptap-v3-source',
    enforce: 'pre',
    resolveId(source, importer) {
      const cacheKey = `${importer || ''}::${source}`;

      if (source.startsWith('@tiptap/')) {
        const match = source.match(/^@tiptap\/([^/]+)(?:\/(.+))?$/);
        if (!match) return null;

        const [, pkgName, subpath] = match;
        const pkgDir = path.join(tiptapDir, pkgName);

        return cachedResolution(cacheKey, () => {
          if (pkgName === 'pm' && subpath) {
            const file = path.join(pkgDir, subpath, 'index.ts');
            return fs.existsSync(file) ? file : null;
          }

          if (subpath) {
            const srcFile = path.join(pkgDir, 'src', `${subpath}.ts`);
            if (fs.existsSync(srcFile)) return srcFile;

            const srcDir = path.join(pkgDir, 'src', subpath, 'index.ts');
            return fs.existsSync(srcDir) ? srcDir : null;
          }

          const srcEntry = path.join(pkgDir, 'src', 'index.ts');
          return fs.existsSync(srcEntry) ? srcEntry : null;
        });
      }

      if (importer && importer.includes(path.join('node_modules', '@tiptap')) && source.includes('/dist/')) {
        return cachedResolution(cacheKey, () => {
          const rewritten = source.replace(/\/dist\//, '/src/').replace(/\.js$/, '.ts');
          const resolved = path.resolve(path.dirname(importer), rewritten);
          return fs.existsSync(resolved) ? resolved : null;
        });
      }

      return null;
    },
  };
}

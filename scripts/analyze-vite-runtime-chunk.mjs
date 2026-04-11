import fs from 'fs';
import path from 'path';

const repoRoot = process.cwd();
const jsDir = path.join(repoRoot, 'client', 'dist', 'assets', 'js');

function getLatestFile(prefix, suffix) {
  const files = fs
    .readdirSync(jsDir)
    .filter((name) => name.startsWith(prefix) && name.endsWith(suffix))
    .map((name) => ({
      name,
      fullPath: path.join(jsDir, name),
      mtimeMs: fs.statSync(path.join(jsDir, name)).mtimeMs,
    }))
    .sort((a, b) => b.mtimeMs - a.mtimeMs);

  return files[0] || null;
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function safeRead(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

function findRuntimeSources(map) {
  return map.sources.filter(
    (source) =>
      source.includes('react/jsx-runtime') ||
      source.includes('react-jsx-runtime.production') ||
      source.includes('react/jsx-dev-runtime') ||
      source.includes('react-jsx-dev-runtime.production'),
  );
}

function findImports(source, patterns) {
  return source
    .split('\n')
    .filter((line) => patterns.some((pattern) => line.includes(pattern)));
}

function summarizeChunk(name) {
  const chunkPath = path.join(jsDir, name);
  const mapPath = `${chunkPath}.map`;
  const source = safeRead(chunkPath);
  const map = readJson(mapPath);

  return {
    name,
    runtimeSources: findRuntimeSources(map),
    reactMarkdownSources: map.sources.filter((entry) => entry.includes('react-markdown')),
    imports: findImports(source, ['vendor-markdown', 'vendor-react', 'vendor-tiptap', 'vendor-misc', 'vendor-map-core']),
  };
}

const latestMount = getLatestFile('mountApplication-', '.js');
if (!latestMount) {
  console.error('No mountApplication chunk found in client/dist/assets/js');
  process.exit(1);
}

const markdownChunk = getLatestFile('vendor-markdown-', '.js');
const reactChunk = getLatestFile('vendor-react-', '.js');

const mountSummary = summarizeChunk(latestMount.name);
const markdownSummary = markdownChunk ? summarizeChunk(markdownChunk.name) : null;
const reactSummary = reactChunk ? summarizeChunk(reactChunk.name) : null;

const reactMarkdownSource = safeRead(path.join(repoRoot, 'node_modules', 'react-markdown', 'lib', 'index.js'));
const reactMarkdownImportLines = findImports(reactMarkdownSource, ['react/jsx-runtime', "from 'react'", 'toJsxRuntime']);

const report = {
  generatedAt: new Date().toISOString(),
  jsDir,
  mountApplication: mountSummary,
  vendorMarkdown: markdownSummary,
  vendorReact: reactSummary,
  reactMarkdownImportLines,
  diagnosis: {
    mountImportsVendorMarkdown: mountSummary.imports.some((line) => line.includes('vendor-markdown')),
    vendorMarkdownContainsJsxRuntime: (markdownSummary?.runtimeSources.length || 0) > 0,
    vendorReactContainsJsxRuntime: (reactSummary?.runtimeSources.length || 0) > 0,
  },
};

console.log(JSON.stringify(report, null, 2));

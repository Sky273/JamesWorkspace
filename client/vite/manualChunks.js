export const chunkRules = [
  {
    chunk: 'vendor-tiptap',
    matches: ['@tiptap', 'prosemirror', 'lowlight'],
  },
  {
    chunk: 'vendor-react',
    matches: ['react-dom', 'react-router', '/react/', 'react/jsx-runtime', 'react/jsx-dev-runtime', 'react-i18next', 'scheduler', 'use-sync-external-store', 'react-is'],
  },
  {
    chunk: 'vendor-ui',
    matches: ['framer-motion', 'motion-dom', 'motion-utils', '@floating-ui', 'goober', '@headlessui', '@heroicons', 'react-hot-toast'],
  },
  {
    chunk: 'vendor-markdown',
    matches: ['react-markdown', 'remark-gfm', 'remark-', 'rehype-', 'micromark', 'mdast-util', 'hast-util', 'unist-', 'unified', 'vfile', 'highlight.js'],
  },
  {
    chunk: 'vendor-charts',
    matches: ['recharts', 'd3-', 'react-circular-progressbar'],
  },
  {
    chunk: 'vendor-forms',
    matches: ['react-dropzone', 'qrcode.react'],
  },
  {
    chunk: 'vendor-docs',
    matches: ['mammoth', 'underscore'],
  },
  {
    chunk: 'vendor-utils',
    matches: ['isomorphic-dompurify', 'dompurify', 'classnames'],
  },
  {
    chunk: 'vendor-map-geo',
    matches: ['supercluster', 'kdbush', 'pbf', 'geojson-vt', 'vector-tile', 'vt-pbf'],
  },
  {
    chunk: 'vendor-map-core',
    matches: ['maplibre-gl', '@mapbox'],
  },
  {
    chunk: 'vendor-pdf',
    matches: ['pdfjs-dist', 'html2pdf', 'jspdf'],
  },
  {
    chunk: 'vendor-i18n',
    matches: ['i18next'],
  },
  {
    chunk: 'vendor-three',
    matches: ['three'],
  },
];

export function manualChunks(id) {
  if (!id.includes('node_modules')) {
    return undefined;
  }

  for (const rule of chunkRules) {
    if (rule.matches.some((match) => id.includes(match))) {
      return rule.chunk;
    }
  }

  return 'vendor-misc';
}

export function createCodeSplittingGroups() {
  return chunkRules.map((rule, index) => ({
    name: rule.chunk,
    priority: chunkRules.length - index,
    test: (id) => id.includes('node_modules') && rule.matches.some((match) => id.includes(match)),
  }));
}

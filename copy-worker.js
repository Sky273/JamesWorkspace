import { copyFileSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const workerSrc = join(__dirname, 'node_modules', 'pdfjs-dist', 'build', 'pdf.worker.min.js');
const workerDest = join(__dirname, 'public', 'pdf.worker.min.js');

copyFileSync(workerSrc, workerDest);
console.log('Worker file copied successfully!');

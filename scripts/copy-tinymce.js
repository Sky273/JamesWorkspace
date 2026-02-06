import fs from 'fs-extra';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const sourceDir = join(__dirname, '../node_modules/tinymce');
const targetDir = join(__dirname, '../public/tinymce');

async function copyTinyMCE() {
  try {
    // Ensure target directory exists and is empty
    await fs.ensureDir(targetDir);
    await fs.emptyDir(targetDir);

    // Copy TinyMCE files
    await fs.copy(sourceDir, targetDir);
    console.log('TinyMCE files copied successfully to public directory');
  } catch (err) {
    console.error('Error copying TinyMCE files:', err);
    process.exit(1);
  }
}

copyTinyMCE();

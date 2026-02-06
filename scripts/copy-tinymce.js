import fs from 'fs/promises';
import { existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const sourceDir = join(__dirname, '../node_modules/tinymce');
const targetDir = join(__dirname, '../public/tinymce');

/**
 * Recursively copy a directory
 */
async function copyDir(src, dest) {
  await fs.mkdir(dest, { recursive: true });
  const entries = await fs.readdir(src, { withFileTypes: true });
  
  for (const entry of entries) {
    const srcPath = join(src, entry.name);
    const destPath = join(dest, entry.name);
    
    if (entry.isDirectory()) {
      await copyDir(srcPath, destPath);
    } else {
      await fs.copyFile(srcPath, destPath);
    }
  }
}

/**
 * Recursively remove a directory
 */
async function removeDir(dir) {
  if (existsSync(dir)) {
    await fs.rm(dir, { recursive: true, force: true });
  }
}

async function copyTinyMCE() {
  try {
    // Ensure target directory exists and is empty
    await removeDir(targetDir);
    
    // Copy TinyMCE files
    await copyDir(sourceDir, targetDir);
    console.log('TinyMCE files copied successfully to public directory');
  } catch (err) {
    console.error('Error copying TinyMCE files:', err);
    process.exit(1);
  }
}

copyTinyMCE();

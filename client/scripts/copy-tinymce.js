import fs from 'fs/promises';
import { existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { execSync } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const sourceDir = join(__dirname, '../../node_modules/tinymce');
const targetDir = join(__dirname, '../public/tinymce');

/**
 * Sleep for a given number of milliseconds
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

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
 * Recursively remove a directory with retry logic for locked files
 */
async function removeDir(dir, retries = 3) {
  if (!existsSync(dir)) return;
  
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      // On Windows, use rmdir /s /q which handles locked files better
      if (process.platform === 'win32') {
        try {
          execSync(`rmdir /s /q "${dir}"`, { stdio: 'ignore' });
        } catch {
          // Fallback to Node.js rm
          await fs.rm(dir, { recursive: true, force: true, maxRetries: 3, retryDelay: 1000 });
        }
      } else {
        await fs.rm(dir, { recursive: true, force: true });
      }
      return; // Success
    } catch (err) {
      if (attempt < retries) {
        console.log(`  ⚠️  Retry ${attempt}/${retries} - waiting for files to be released...`);
        await sleep(2000); // Wait 2 seconds before retry
      } else {
        throw err;
      }
    }
  }
}

async function copyTinyMCE() {
  try {
    // Check if source exists
    if (!existsSync(sourceDir)) {
      console.log('TinyMCE source not found in node_modules, skipping copy');
      return;
    }
    
    // Check if target already exists and is up to date
    if (existsSync(targetDir)) {
      // Remove old directory with retry logic
      await removeDir(targetDir);
    }
    
    // Copy TinyMCE files
    await copyDir(sourceDir, targetDir);
    console.log('TinyMCE files copied successfully to public directory');
  } catch (err) {
    // If still failing, try to continue without TinyMCE copy
    // (it may already exist from a previous build)
    if (existsSync(targetDir)) {
      console.warn('Warning: Could not refresh TinyMCE files, using existing copy');
      console.warn('  If you experience issues, close all applications and try again');
    } else {
      console.error('Error copying TinyMCE files:', err);
      process.exit(1);
    }
  }
}

copyTinyMCE();

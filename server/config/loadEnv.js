import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..', '..');

function resolveEnvCandidates() {
    const explicitPath = process.env.DOTENV_CONFIG_PATH;
    const candidates = [];

    if (explicitPath) {
        candidates.push(path.resolve(explicitPath));
    }

    candidates.push(
        path.join(ROOT_DIR, '.env'),
        path.join(ROOT_DIR, '.env.docker')
    );

    return [...new Set(candidates)];
}

function loadEnvFile(envPath) {
    if (!fs.existsSync(envPath)) {
        return false;
    }

    dotenv.config({
        path: envPath,
        override: false
    });

    return true;
}

export function loadEnvironmentFiles() {
    const loadedFiles = [];

    for (const envPath of resolveEnvCandidates()) {
        if (loadEnvFile(envPath)) {
            loadedFiles.push(envPath);
        }
    }

    return loadedFiles;
}

loadEnvironmentFiles();

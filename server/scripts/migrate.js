import path from 'path';
import { fileURLToPath } from 'url';
import { runDockerMigrate } from './docker-migrate.js';

const __filename = fileURLToPath(import.meta.url);

const isDirectRun = process.argv[1] && path.resolve(process.argv[1]) === __filename;

if (isDirectRun) {
    await runDockerMigrate();
}

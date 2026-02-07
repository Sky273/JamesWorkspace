#!/usr/bin/env node
/**
 * Quick Start Script
 * Sets up the development environment and starts all services
 * 
 * Usage:
 *   node scripts/quickstart.js
 *   node scripts/quickstart.js --skip-db    # Skip database setup
 *   node scripts/quickstart.js --prod       # Production mode
 */

import { spawn, exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const execAsync = promisify(exec);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.join(__dirname, '..');

// Parse arguments
const args = process.argv.slice(2);
const skipDb = args.includes('--skip-db');
const isProd = args.includes('--prod');

// Colors for console output
const colors = {
    reset: '\x1b[0m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    red: '\x1b[31m',
    cyan: '\x1b[36m',
    bold: '\x1b[1m'
};

function log(message, color = 'reset') {
    console.log(`${colors[color]}${message}${colors.reset}`);
}

function logStep(step, message) {
    console.log(`\n${colors.cyan}[${step}]${colors.reset} ${colors.bold}${message}${colors.reset}`);
}

async function checkPrerequisites() {
    logStep('1/6', 'Checking prerequisites...');
    
    // Check Node.js version
    const nodeVersion = process.version;
    const majorVersion = parseInt(nodeVersion.slice(1).split('.')[0]);
    if (majorVersion < 18) {
        log(`❌ Node.js 18+ required. Current: ${nodeVersion}`, 'red');
        process.exit(1);
    }
    log(`  ✅ Node.js ${nodeVersion}`, 'green');
    
    // Check if .env exists
    const envPath = path.join(ROOT_DIR, '.env');
    if (!fs.existsSync(envPath)) {
        log('  ⚠️  .env file not found', 'yellow');
        
        // Copy from .env.example if available
        const examplePath = path.join(ROOT_DIR, '.env.example');
        if (fs.existsSync(examplePath)) {
            fs.copyFileSync(examplePath, envPath);
            log('  📄 Created .env from .env.example', 'green');
            log('  ⚠️  Please edit .env with your configuration!', 'yellow');
        } else {
            log('  ❌ .env.example not found. Please create .env manually.', 'red');
            process.exit(1);
        }
    } else {
        log('  ✅ .env file found', 'green');
    }
    
    // Check PostgreSQL
    if (!skipDb) {
        try {
            await execAsync('psql --version');
            log('  ✅ PostgreSQL client available', 'green');
        } catch {
            log('  ⚠️  PostgreSQL client not found (optional)', 'yellow');
        }
    }
}

async function installDependencies() {
    logStep('2/6', 'Installing dependencies...');
    
    const nodeModulesPath = path.join(ROOT_DIR, 'node_modules');
    const packageLockPath = path.join(ROOT_DIR, 'package-lock.json');
    const packageJsonPath = path.join(ROOT_DIR, 'package.json');
    
    // Check if node_modules needs update
    const needsInstall = !fs.existsSync(nodeModulesPath) || 
        (fs.existsSync(packageLockPath) && 
         fs.statSync(packageJsonPath).mtime > fs.statSync(nodeModulesPath).mtime);
    
    if (needsInstall) {
        log('  📦 Running npm install...', 'cyan');
        try {
            await execAsync('npm install', { cwd: ROOT_DIR });
            log('  ✅ Dependencies installed', 'green');
        } catch (error) {
            log(`  ❌ npm install failed: ${error.message}`, 'red');
            process.exit(1);
        }
    } else {
        log('  ✅ Dependencies up to date', 'green');
    }
}

async function setupDatabase() {
    if (skipDb) {
        logStep('3/6', 'Skipping database setup (--skip-db)');
        return;
    }
    
    logStep('3/6', 'Checking database connection...');
    
    // Load .env
    const dotenv = await import('dotenv');
    dotenv.config({ path: path.join(ROOT_DIR, '.env') });
    
    const { POSTGRES_HOST, POSTGRES_PORT, POSTGRES_DB, POSTGRES_USER, POSTGRES_PASSWORD } = process.env;
    
    if (!POSTGRES_HOST || !POSTGRES_DB || !POSTGRES_USER) {
        log('  ⚠️  PostgreSQL not configured in .env', 'yellow');
        log('  ℹ️  Please configure POSTGRES_* variables', 'cyan');
        return;
    }
    
    try {
        // Try to connect using pg
        const pg = await import('pg');
        const pool = new pg.default.Pool({
            host: POSTGRES_HOST,
            port: parseInt(POSTGRES_PORT || '5432'),
            database: POSTGRES_DB,
            user: POSTGRES_USER,
            password: POSTGRES_PASSWORD
        });
        
        await pool.query('SELECT 1');
        await pool.end();
        log('  ✅ Database connection successful', 'green');
    } catch (error) {
        log(`  ⚠️  Database connection failed: ${error.message}`, 'yellow');
        log('  ℹ️  Make sure PostgreSQL is running and credentials are correct', 'cyan');
    }
}

async function buildFrontend() {
    if (isProd) {
        logStep('4/6', 'Building frontend for production...');
        try {
            await execAsync('npm run build', { cwd: ROOT_DIR });
            log('  ✅ Frontend built successfully', 'green');
        } catch (error) {
            log(`  ❌ Build failed: ${error.message}`, 'red');
            process.exit(1);
        }
    } else {
        logStep('4/6', 'Skipping frontend build (development mode)');
        log('  ℹ️  Frontend will run in dev mode with hot reload', 'cyan');
    }
}

function startServices() {
    logStep('5/6', 'Starting services...');
    
    const services = [];
    
    // Start proxy server
    log('  🚀 Starting proxy server (port 3001)...', 'cyan');
    const proxyServer = spawn('node', ['server/proxy-server.js'], {
        cwd: ROOT_DIR,
        stdio: 'inherit',
        env: { ...process.env, NODE_ENV: isProd ? 'production' : 'development' }
    });
    services.push({ name: 'Proxy Server', process: proxyServer });
    
    // Start PDF server
    log('  🚀 Starting PDF server (port 3002)...', 'cyan');
    const pdfServer = spawn('node', ['pdf-server/server.cjs'], {
        cwd: ROOT_DIR,
        stdio: 'inherit'
    });
    services.push({ name: 'PDF Server', process: pdfServer });
    
    // Start Vite dev server (only in development)
    if (!isProd) {
        log('  🚀 Starting Vite dev server (port 5173)...', 'cyan');
        const viteServer = spawn('npm', ['run', 'dev'], {
            cwd: ROOT_DIR,
            stdio: 'inherit',
            shell: true
        });
        services.push({ name: 'Vite Dev Server', process: viteServer });
    }
    
    // Handle process termination
    const cleanup = () => {
        log('\n\n🛑 Shutting down services...', 'yellow');
        services.forEach(({ name, process }) => {
            process.kill();
            log(`  ✅ ${name} stopped`, 'green');
        });
        process.exit(0);
    };
    
    process.on('SIGINT', cleanup);
    process.on('SIGTERM', cleanup);
    
    return services;
}

function showSummary() {
    logStep('6/6', 'Quick Start Complete!');
    
    console.log(`
${colors.green}${colors.bold}═══════════════════════════════════════════════════════════${colors.reset}
${colors.green}${colors.bold}  ResumeConverter is running!${colors.reset}
${colors.green}${colors.bold}═══════════════════════════════════════════════════════════${colors.reset}

  ${colors.cyan}Frontend:${colors.reset}     ${isProd ? 'http://localhost:3001' : 'http://localhost:5173'}
  ${colors.cyan}API Server:${colors.reset}   http://localhost:3001/api
  ${colors.cyan}API Docs:${colors.reset}     http://localhost:3001/api/docs/ui
  ${colors.cyan}Health:${colors.reset}       http://localhost:3001/health
  ${colors.cyan}PDF Server:${colors.reset}   http://localhost:3002

  ${colors.yellow}Press Ctrl+C to stop all services${colors.reset}
`);
}

// Main execution
async function main() {
    console.log(`
${colors.cyan}${colors.bold}╔═══════════════════════════════════════════════════════════╗
║           ResumeConverter Quick Start v1.5.1              ║
╚═══════════════════════════════════════════════════════════╝${colors.reset}
`);
    
    try {
        await checkPrerequisites();
        await installDependencies();
        await setupDatabase();
        await buildFrontend();
        startServices();
        showSummary();
    } catch (error) {
        log(`\n❌ Quick start failed: ${error.message}`, 'red');
        process.exit(1);
    }
}

main();

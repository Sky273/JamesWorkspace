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

async function stopExistingServers() {
    logStep('0/6', 'Stopping existing servers...');
    
    const isWindows = process.platform === 'win32';
    
    try {
        if (isWindows) {
            // Kill processes LISTENING on ports 3001, 3002, 3443, 5173, 443 (proxy, pdf, https, vite, vite-https)
            // Note: We only kill LISTENING processes, not client connections
            const ports = [3001, 3002, 3443, 5173, 443];
            for (const port of ports) {
                try {
                    // Find processes LISTENING on this specific port (not client connections)
                    // Use exact port match with space/colon boundaries to avoid false positives
                    const { stdout } = await execAsync(`netstat -ano | findstr LISTENING | findstr ":${port} "`);
                    const lines = stdout.trim().split('\n');
                    const pids = new Set();
                    for (const line of lines) {
                        // Verify it's actually listening on this port (local address)
                        if (!line.includes('LISTENING')) continue;
                        const parts = line.trim().split(/\s+/);
                        // Format: TCP 0.0.0.0:443 0.0.0.0:0 LISTENING PID
                        const localAddr = parts[1] || '';
                        if (localAddr.endsWith(`:${port}`)) {
                            const pid = parts[parts.length - 1];
                            if (pid && pid !== '0') pids.add(pid);
                        }
                    }
                    for (const pid of pids) {
                        try {
                            await execAsync(`taskkill /F /PID ${pid}`);
                            log(`  🛑 Stopped server on port ${port} (PID: ${pid})`, 'yellow');
                        } catch {
                            // Process may have already exited
                        }
                    }
                } catch {
                    // No process listening on this port
                }
            }
        } else {
            // Unix: kill processes on ports
            const ports = [3001, 3002, 3443, 5173, 443];
            for (const port of ports) {
                try {
                    await execAsync(`lsof -ti:${port} | xargs kill -9 2>/dev/null || true`);
                } catch {
                    // No process on this port
                }
            }
        }
        log('  ✅ Existing servers stopped', 'green');
    } catch (error) {
        log('  ⚠️  Could not stop existing servers (may not be running)', 'yellow');
    }
    
    // Longer delay to ensure ports are fully released by the OS
    // Windows can take up to 4 minutes to release TIME_WAIT sockets, but usually 2-3 seconds is enough
    log('  ⏳ Waiting for ports to be released...', 'cyan');
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Verify ports are free
    if (isWindows) {
        for (const port of [3001, 3002, 5173, 443]) {
            try {
                const { stdout } = await execAsync(`netstat -ano | findstr :${port} | findstr LISTENING`);
                if (stdout.trim()) {
                    log(`  ⚠️  Port ${port} still in use, waiting longer...`, 'yellow');
                    await new Promise(resolve => setTimeout(resolve, 2000));
                }
            } catch {
                // Port is free (no output from findstr)
            }
        }
    }
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

async function startServices() {
    logStep('5/6', 'Starting services...');
    
    const services = [];
    
    // Helper to pipe output from child process
    const pipeOutput = (childProcess) => {
        if (childProcess.stdout) {
            childProcess.stdout.pipe(process.stdout);
        }
        if (childProcess.stderr) {
            childProcess.stderr.pipe(process.stderr);
        }
    };
    
    // Start proxy server with IPC for graceful shutdown
    log('  🚀 Starting proxy server (port 3001)...', 'cyan');
    const proxyServer = spawn('node', ['--max-old-space-size=2048', '--expose-gc', 'server/proxy-server.js'], {
        cwd: ROOT_DIR,
        stdio: ['ignore', 'pipe', 'pipe', 'ipc'],
        env: { ...process.env, NODE_ENV: isProd ? 'production' : 'development' }
    });
    pipeOutput(proxyServer);
    services.push({ name: 'Proxy Server', process: proxyServer, hasIpc: true });
    
    // Start PDF server
    log('  🚀 Starting PDF server (port 3002)...', 'cyan');
    const pdfServer = spawn('node', ['pdf-server/server.cjs'], {
        cwd: ROOT_DIR,
        stdio: ['ignore', 'pipe', 'pipe', 'ipc']
    });
    pipeOutput(pdfServer);
    services.push({ name: 'PDF Server', process: pdfServer, hasIpc: true });
    
    // Start Vite dev server (only in development)
    if (!isProd) {
        // Check if HTTPS is enabled in client/.env
        const clientEnvPath = path.join(ROOT_DIR, 'client', '.env');
        let viteHttpsEnabled = false;
        if (fs.existsSync(clientEnvPath)) {
            const clientEnv = fs.readFileSync(clientEnvPath, 'utf8');
            viteHttpsEnabled = clientEnv.includes('VITE_HTTPS_ENABLED=true');
        }
        const vitePort = viteHttpsEnabled ? 443 : 5173;
        const viteProtocol = viteHttpsEnabled ? 'https' : 'http';
        
        log(`  🚀 Starting Vite dev server (${viteProtocol}://localhost:${vitePort})...`, 'cyan');
        const viteServer = spawn('npm', ['run', 'dev'], {
            cwd: ROOT_DIR,
            stdio: ['ignore', 'pipe', 'pipe'],
            shell: true
        });
        pipeOutput(viteServer);
        services.push({ name: 'Vite Dev Server', process: viteServer, hasIpc: false, port: vitePort, protocol: viteProtocol });
    }
    
    // Handle process termination with proper cleanup
    let isShuttingDown = false;
    
    const cleanup = async () => {
        if (isShuttingDown) return;
        isShuttingDown = true;
        
        log('\n\n🛑 Shutting down services...', 'yellow');
        
        const isWindows = process.platform === 'win32';
        
        for (const { name, process: childProcess, hasIpc } of services) {
            try {
                if (hasIpc && childProcess.connected) {
                    // For processes with IPC, disconnect to trigger graceful shutdown
                    log(`  ⏳ Sending shutdown signal to ${name}...`, 'cyan');
                    childProcess.disconnect();
                    
                    // Wait for graceful shutdown (up to 5 seconds)
                    await new Promise((resolve) => {
                        const timeout = setTimeout(() => {
                            if (!childProcess.killed) {
                                log(`  ⚠️  ${name} did not exit gracefully, forcing...`, 'yellow');
                                if (isWindows) {
                                    execAsync(`taskkill /F /T /PID ${childProcess.pid}`).catch(() => {});
                                } else {
                                    childProcess.kill('SIGKILL');
                                }
                            }
                            resolve();
                        }, 5000);
                        
                        childProcess.on('exit', () => {
                            clearTimeout(timeout);
                            resolve();
                        });
                    });
                } else {
                    // For processes without IPC, use signals
                    if (isWindows) {
                        if (childProcess.pid) {
                            childProcess.kill('SIGINT');
                            await new Promise(resolve => setTimeout(resolve, 500));
                            if (!childProcess.killed) {
                                await execAsync(`taskkill /F /T /PID ${childProcess.pid}`).catch(() => {});
                            }
                        }
                    } else {
                        childProcess.kill('SIGTERM');
                    }
                }
                log(`  ✅ ${name} stopped`, 'green');
            } catch (error) {
                log(`  ⚠️  Error stopping ${name}: ${error.message}`, 'yellow');
            }
        }
        
        // Wait a moment for cleanup to complete
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        log('\n✅ All services stopped. Goodbye!', 'green');
        process.exit(0);
    };
    
    // Handle various termination signals
    process.on('SIGINT', cleanup);
    process.on('SIGTERM', cleanup);
    
    // Windows CMD specific: capture Ctrl+C using raw stdin
    if (process.platform === 'win32') {
        process.on('SIGBREAK', cleanup);
        
        // Enable raw mode to capture Ctrl+C directly
        if (process.stdin.isTTY) {
            process.stdin.setRawMode(true);
            process.stdin.resume();
            process.stdin.setEncoding('utf8');
            
            process.stdin.on('data', (key) => {
                // Ctrl+C = \u0003, Ctrl+Break = \u001b
                if (key === '\u0003' || key === '\x03') {
                    cleanup();
                }
                // Also handle 'q' key to quit
                if (key.toLowerCase() === 'q') {
                    cleanup();
                }
            });
            
            log('\n  💡 Press Ctrl+C or Q to stop all services\n', 'yellow');
        }
    }
    
    // Handle child process errors
    services.forEach(({ name, process: childProcess }) => {
        childProcess.on('error', (error) => {
            log(`  ❌ ${name} error: ${error.message}`, 'red');
        });
        
        childProcess.on('exit', (code, signal) => {
            if (!isShuttingDown && code !== 0) {
                log(`  ⚠️  ${name} exited unexpectedly (code: ${code}, signal: ${signal})`, 'yellow');
            }
        });
    });
    
    return services;
}

function getFrontendUrl() {
    const clientEnvPath = path.join(ROOT_DIR, 'client', '.env');
    let viteHttpsEnabled = false;
    if (fs.existsSync(clientEnvPath)) {
        const clientEnv = fs.readFileSync(clientEnvPath, 'utf8');
        viteHttpsEnabled = clientEnv.includes('VITE_HTTPS_ENABLED=true');
    }
    return viteHttpsEnabled ? 'https://localhost:443' : 'http://localhost:5173';
}

function showSummary() {
    logStep('6/6', 'Quick Start Complete!');
    
    console.log(`
${colors.green}${colors.bold}═══════════════════════════════════════════════════════════${colors.reset}
${colors.green}${colors.bold}  ResumeConverter is running!${colors.reset}
${colors.green}${colors.bold}═══════════════════════════════════════════════════════════${colors.reset}

  ${colors.cyan}Frontend:${colors.reset}     ${isProd ? 'http://localhost:3001' : getFrontendUrl()}
  ${colors.cyan}API Server:${colors.reset}   http://localhost:3001/api
  ${colors.cyan}API Docs:${colors.reset}     http://localhost:3001/api/docs/ui
  ${colors.cyan}Health:${colors.reset}       http://localhost:3001/health
  ${colors.cyan}PDF Server:${colors.reset}   http://localhost:3002

  ${colors.yellow}Press Ctrl+C to stop all services${colors.reset}
`);
}

// Main execution
async function main() {
    // Read version from package.json
    const packageJsonPath = path.join(ROOT_DIR, 'package.json');
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
    const version = packageJson.version || '?.?.?';
    
    console.log(`
${colors.cyan}${colors.bold}╔═══════════════════════════════════════════════════════════╗
║           ResumeConverter Quick Start v${version.padEnd(18)}║
╚═══════════════════════════════════════════════════════════╝${colors.reset}
`);
    
    try {
        await stopExistingServers();
        await checkPrerequisites();
        await installDependencies();
        await setupDatabase();
        await buildFrontend();
        await startServices();
        showSummary();
    } catch (error) {
        log(`\n❌ Quick start failed: ${error.message}`, 'red');
        process.exit(1);
    }
}

main();

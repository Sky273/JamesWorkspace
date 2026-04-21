import { safeLog } from '../utils/logger.backend.js';
import { httpAgent, httpsAgent } from './axios.js';
import { stopRuntimeMaintenance } from './lifecycle/runtimeMaintenance.js';
import { closePool } from '../services/database.service.js';

function completeShutdown(exitCode) {
    setImmediate(() => {
        process.exit(exitCode);
    });
}

async function finalizeShutdown(forceExitTimer, exitCode) {
    await stopRuntimeMaintenance();

    try {
        await closePool();
        safeLog('info', 'PostgreSQL connection pool closed');
    } catch (error) {
        safeLog('error', 'Error closing PostgreSQL pool', { error: error.message });
    }

    if (httpAgent) {
        httpAgent.destroy();
        safeLog('debug', 'HTTP agent destroyed');
    }
    if (httpsAgent) {
        httpsAgent.destroy();
        safeLog('debug', 'HTTPS agent destroyed');
    }

    if (global.gc) {
        global.gc();
        safeLog('debug', 'Garbage collection triggered');
    }

    clearTimeout(forceExitTimer);
    safeLog('info', 'Graceful shutdown complete', { exitCode });
    completeShutdown(exitCode);
}

export function createGracefulShutdown(server) {
    let shutdownInProgress = false;

    return async (signal, exitCode = 0) => {
        if (shutdownInProgress) {
            safeLog('warn', 'Graceful shutdown already in progress', { signal, exitCode });
            return;
        }

        shutdownInProgress = true;
        safeLog('info', 'Graceful shutdown initiated', { signal, exitCode });

        const forceExitTimer = setTimeout(() => {
            safeLog('error', 'Forced shutdown after timeout', { exitCode });
            process.exit(1);
        }, 10000);
        forceExitTimer.unref();

        server.close(async (closeError) => {
            if (closeError && closeError.code !== 'ERR_SERVER_NOT_RUNNING') {
                safeLog('error', 'Error while closing HTTP server', {
                    error: closeError.message,
                    code: closeError.code,
                    exitCode,
                });
                clearTimeout(forceExitTimer);
                completeShutdown(exitCode || 1);
                return;
            }

            safeLog('info', 'HTTP server closed');
            await finalizeShutdown(forceExitTimer, exitCode);
        });
    };
}

export function registerShutdownSignalHandlers(gracefulShutdown) {
    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));

    if (process.platform === 'win32') {
        process.on('SIGBREAK', () => gracefulShutdown('SIGBREAK'));
    }

    process.on('exit', (code) => {
        if (code !== 0) {
            safeLog('warn', 'Process exiting with non-zero code', { code });
        }
    });

    process.on('disconnect', () => {
        safeLog('info', 'Parent process disconnected, initiating shutdown');
        gracefulShutdown('DISCONNECT');
    });
}

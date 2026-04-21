import { safeLog } from '../utils/logger.backend.js';

function normalizeFatalReason(reason) {
    if (reason instanceof Error) {
        return {
            message: reason.message,
            stack: reason.stack,
        };
    }

    return { reason: String(reason) };
}

export function registerFatalProcessHandlers(getServerInstance) {
    let fatalErrorInProgress = false;

    const triggerFatalShutdown = (signal, details) => {
        if (fatalErrorInProgress) {
            safeLog('warn', 'Fatal shutdown already in progress', { signal });
            return;
        }

        fatalErrorInProgress = true;
        safeLog('error', 'Fatal process error', { signal, ...details });

        const serverInstance = getServerInstance?.();
        if (serverInstance?.gracefulShutdown) {
            serverInstance.gracefulShutdown(signal, 1);
            return;
        }

        setImmediate(() => {
            process.exit(1);
        });
    };

    process.on('uncaughtException', (error) => {
        triggerFatalShutdown('UNCAUGHT_EXCEPTION', normalizeFatalReason(error));
    });

    process.on('unhandledRejection', (reason) => {
        triggerFatalShutdown('UNHANDLED_REJECTION', normalizeFatalReason(reason));
    });
}

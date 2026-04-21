/**
 * Server Lifecycle Management
 * Startup initialization, graceful shutdown, memory monitoring
 */

import { createListeningServer } from './lifecycle.network.js';
import {
    createGracefulShutdown,
    registerShutdownSignalHandlers
} from './lifecycle.shutdown.js';

/**
 * Start the server and configure graceful shutdown
 * @param {express.Application} app - Express application
 * @param {string} serverDir - __dirname of the server directory
 * @returns {http.Server|https.Server} The server instance
 */
export function startServer(app, serverDir) {
    const server = createListeningServer(app, serverDir);
    const gracefulShutdown = createGracefulShutdown(server);

    server.gracefulShutdown = gracefulShutdown;
    registerShutdownSignalHandlers(gracefulShutdown);
    return server;
}

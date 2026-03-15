/**
 * Backup FTP/SFTP Service
 * Handles FTP/SFTP connections, uploads, downloads, and remote file listing
 */

import path from 'path';
import { safeLog } from '../../utils/logger.backend.js';

// ============================================
// LAZY-LOADED FTP/SFTP MODULES
// Cache modules to avoid repeated dynamic imports
// ============================================

let SftpClientModule = null;
let basicFtpModule = null;

/**
 * Get SFTP client class (lazy loaded and cached)
 */
async function getSftpClient() {
    if (!SftpClientModule) {
        SftpClientModule = (await import('ssh2-sftp-client')).default;
        safeLog('debug', 'ssh2-sftp-client module loaded');
    }
    return SftpClientModule;
}

/**
 * Get basic-ftp module (lazy loaded and cached)
 */
async function getBasicFtp() {
    if (!basicFtpModule) {
        basicFtpModule = await import('basic-ftp');
        safeLog('debug', 'basic-ftp module loaded');
    }
    return basicFtpModule;
}

/**
 * Get FTP client based on protocol
 */
export async function getClient(settings) {
    if (settings.protocol === 'sftp') {
        const SftpClient = await getSftpClient();
        const client = new SftpClient();
        try {
            await client.connect({
                host: settings.host,
                port: settings.port || 22,
                username: settings.username,
                password: settings.password
            });
            return { client, type: 'sftp' };
        } catch (error) {
            safeLog('error', 'SFTP connection failed', {
                host: settings.host,
                port: settings.port || 22,
                username: settings.username,
                error: error.message,
                code: error.code
            });
            throw error;
        }
    } else {
        const ftp = await getBasicFtp();
        const client = new ftp.Client();
        // Enable verbose logging only in development
        client.ftp.verbose = process.env.NODE_ENV === 'development';
        
        // TLS options: accept self-signed certificates
        const secureOptions = {
            rejectUnauthorized: false  // Accept self-signed certificates
        };
        
        // Determine secure mode based on protocol and tls_mode setting
        let tlsMode = settings.tls_mode;
        
        // Default to 'explicit' if tls_mode is not set or is invalid
        if (!tlsMode || !['none', 'explicit', 'implicit'].includes(tlsMode)) {
            tlsMode = 'explicit';
        }
        
        // If protocol is 'ftps', force TLS mode
        if (settings.protocol === 'ftps') {
            if (tlsMode === 'none') {
                tlsMode = 'explicit';
            }
        }
        
        let secure = false;
        
        // basic-ftp documentation:
        // - secure: true = Explicit FTPS (AUTH TLS before login)
        // - secure: "implicit" = Implicit FTPS (direct TLS connection, port 990)
        // - secure: false = Plain FTP (no encryption)
        if (tlsMode === 'explicit') {
            secure = true;
        } else if (tlsMode === 'implicit') {
            secure = 'implicit';
        }
        
        safeLog('info', 'FTP connection params', { 
            host: settings.host, 
            port: settings.port,
            tlsMode,
            secure,
            protocol: settings.protocol,
            username: settings.username,
            hasPassword: !!settings.password,
            passwordLength: settings.password ? settings.password.length : 0
        });
        
        const accessParams = {
            host: settings.host,
            port: settings.port || (tlsMode === 'implicit' ? 990 : 21),
            user: settings.username,
            password: settings.password,
            secure: secure,
            secureOptions: secure ? secureOptions : undefined
        };
        
        safeLog('info', 'FTP access params', {
            host: accessParams.host,
            port: accessParams.port,
            user: accessParams.user,
            hasPassword: !!accessParams.password,
            secure: accessParams.secure,
            secureType: typeof accessParams.secure
        });
        
        try {
            await client.access(accessParams);
            return { client, type: 'ftp' };
        } catch (error) {
            safeLog('error', 'FTP connection failed', {
                host: accessParams.host,
                port: accessParams.port,
                user: accessParams.user,
                secure: accessParams.secure,
                tlsMode,
                error: error.message,
                code: error.code
            });
            throw error;
        }
    }
}

/**
 * Properly close FTP/SFTP connection
 */
export async function closeClient(clientWrapper) {
    if (!clientWrapper) return;
    
    try {
        if (clientWrapper.type === 'sftp') {
            await clientWrapper.client.end();
        } else {
            // For FTP, send QUIT command first to properly close TLS connection
            try {
                await clientWrapper.client.quit();
            } catch (_quitError) {
                // QUIT may fail if connection is already broken, ignore
            }
            clientWrapper.client.close();
        }
    } catch (_e) {
        // Ignore close errors
    }
}

/**
 * Test connection to FTP/SFTP server
 */
export async function testConnection(settings) {
    let clientWrapper = null;
    try {
        clientWrapper = await getClient(settings);
        
        if (clientWrapper.type === 'sftp') {
            await clientWrapper.client.list(settings.remote_path || '/');
        } else {
            await clientWrapper.client.ensureDir(settings.remote_path || '/backups');
        }
        
        safeLog('info', 'Backup connection test successful', { 
            protocol: settings.protocol, 
            host: settings.host 
        });
        
        return { success: true, message: 'Connection successful' };
    } catch (error) {
        safeLog('error', 'Backup connection test failed', { 
            error: error.message,
            protocol: settings.protocol,
            host: settings.host
        });
        return { success: false, message: error.message };
    } finally {
        await closeClient(clientWrapper);
    }
}

/**
 * Upload file to remote server
 */
export async function uploadFile(settings, localPath, remotePath) {
    let clientWrapper = null;
    try {
        clientWrapper = await getClient(settings);
        
        if (clientWrapper.type === 'sftp') {
            await clientWrapper.client.put(localPath, remotePath);
        } else {
            await clientWrapper.client.uploadFrom(localPath, remotePath);
        }
        
        safeLog('info', 'File uploaded successfully', { localPath, remotePath });
        return true;
    } catch (error) {
        safeLog('error', 'File upload failed', { 
            localPath, 
            remotePath, 
            error: error.message,
            code: error.code,
            host: settings.host,
            protocol: settings.protocol
        });
        throw error;
    } finally {
        await closeClient(clientWrapper);
    }
}

/**
 * Download file from remote server
 */
export async function downloadFile(settings, remotePath, localPath) {
    let clientWrapper = null;
    try {
        clientWrapper = await getClient(settings);
        
        if (clientWrapper.type === 'sftp') {
            await clientWrapper.client.get(remotePath, localPath);
        } else {
            await clientWrapper.client.downloadTo(localPath, remotePath);
        }
        
        safeLog('info', 'File downloaded successfully', { remotePath, localPath });
        return true;
    } finally {
        await closeClient(clientWrapper);
    }
}

/**
 * List remote backups
 */
export async function listRemoteBackups(settings) {
    let clientWrapper = null;
    try {
        if (!settings || !settings.host) {
            return { success: false, files: [], message: 'No backup settings configured' };
        }
        
        clientWrapper = await getClient(settings);
        let files = [];
        
        if (clientWrapper.type === 'sftp') {
            const list = await clientWrapper.client.list(settings.remote_path || '/backups');
            files = list
                .filter(f => f.name.endsWith('.sql.gz'))
                .map(f => ({
                    name: f.name,
                    size: f.size,
                    date: new Date(f.modifyTime)
                }));
        } else {
            await clientWrapper.client.cd(settings.remote_path || '/backups');
            const list = await clientWrapper.client.list();
            files = list
                .filter(f => f.name.endsWith('.sql.gz'))
                .map(f => ({
                    name: f.name,
                    size: f.size,
                    date: f.modifiedAt
                }));
        }
        
        files.sort((a, b) => new Date(b.date) - new Date(a.date));
        
        return { success: true, files };
    } catch (_error) {
        safeLog('error', 'Failed to list remote backups', { error: _error.message });
        return { success: false, files: [], message: _error.message };
    } finally {
        await closeClient(clientWrapper);
    }
}

/**
 * Delete old backups based on retention policy
 */
export async function cleanupOldRemoteBackups(settings, type, retention) {
    let clientWrapper = null;
    try {
        clientWrapper = await getClient(settings);
        const prefix = `backup-${type}-`;
        let files = [];
        
        if (clientWrapper.type === 'sftp') {
            const list = await clientWrapper.client.list(settings.remote_path || '/backups');
            files = list
                .filter(f => f.name.startsWith(prefix) && f.name.endsWith('.sql.gz'))
                .map(f => ({
                    name: f.name,
                    date: new Date(f.modifyTime)
                }))
                .sort((a, b) => b.date - a.date);
        } else {
            await clientWrapper.client.cd(settings.remote_path || '/backups');
            const list = await clientWrapper.client.list();
            files = list
                .filter(f => f.name.startsWith(prefix) && f.name.endsWith('.sql.gz'))
                .map(f => ({
                    name: f.name,
                    date: f.modifiedAt
                }))
                .sort((a, b) => new Date(b.date) - new Date(a.date));
        }
        
        if (files.length > retention) {
            const toDelete = files.slice(retention);
            for (const file of toDelete) {
                const remotePath = path.posix.join(settings.remote_path || '/backups', file.name);
                if (clientWrapper.type === 'sftp') {
                    await clientWrapper.client.delete(remotePath);
                } else {
                    await clientWrapper.client.remove(remotePath);
                }
                safeLog('info', 'Deleted old backup', { filename: file.name });
            }
        }
    } catch (error) {
        safeLog('error', 'Failed to cleanup old backups', { error: error.message });
    } finally {
        await closeClient(clientWrapper);
    }
}

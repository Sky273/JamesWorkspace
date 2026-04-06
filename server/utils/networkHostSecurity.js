import dns from 'dns/promises';
import net from 'net';

function isIpv4InCidr(ip, base, prefixLength) {
    const octets = ip.split('.').map(Number);
    const baseOctets = base.split('.').map(Number);
    if (octets.length !== 4 || baseOctets.length !== 4 || octets.some(Number.isNaN) || baseOctets.some(Number.isNaN)) {
        return false;
    }

    let ipValue = 0;
    let baseValue = 0;
    for (let index = 0; index < 4; index++) {
        ipValue = (ipValue << 8) + octets[index];
        baseValue = (baseValue << 8) + baseOctets[index];
    }

    const mask = prefixLength === 0 ? 0 : (~0 << (32 - prefixLength)) >>> 0;
    return (ipValue & mask) === (baseValue & mask);
}

function isPrivateIpv4(ip) {
    return (
        isPrivateBackupIpv4(ip)
        || isBlockedOutboundIpv4(ip)
    );
}

function isPrivateBackupIpv4(ip) {
    return (
        isIpv4InCidr(ip, '10.0.0.0', 8)
        || isIpv4InCidr(ip, '100.64.0.0', 10)
        || isIpv4InCidr(ip, '172.16.0.0', 12)
        || isIpv4InCidr(ip, '192.168.0.0', 16)
    );
}

function isBlockedOutboundIpv4(ip) {
    return (
        isIpv4InCidr(ip, '0.0.0.0', 8)
        || isIpv4InCidr(ip, '127.0.0.0', 8)
        || isIpv4InCidr(ip, '169.254.0.0', 16)
        || isIpv4InCidr(ip, '192.0.0.0', 24)
        || isIpv4InCidr(ip, '192.0.2.0', 24)
        || isIpv4InCidr(ip, '198.18.0.0', 15)
        || isIpv4InCidr(ip, '198.51.100.0', 24)
        || isIpv4InCidr(ip, '203.0.113.0', 24)
        || isIpv4InCidr(ip, '224.0.0.0', 4)
    );
}

function isTrustedInternalIpv4(ip) {
    return (
        isPrivateBackupIpv4(ip)
        || isIpv4InCidr(ip, '127.0.0.0', 8)
        || isIpv4InCidr(ip, '169.254.0.0', 16)
    );
}

function isPrivateIpv6(ip) {
    return isPrivateBackupIpv6(ip) || isBlockedOutboundIpv6(ip);
}

function isPrivateBackupIpv6(ip) {
    const normalized = ip.toLowerCase();
    return (
        normalized.startsWith('fc')
        || normalized.startsWith('fd')
    );
}

function isBlockedOutboundIpv6(ip) {
    const normalized = ip.toLowerCase();
    return (
        normalized === '::1'
        || normalized === '::'
        || normalized.startsWith('fe8')
        || normalized.startsWith('fe9')
        || normalized.startsWith('fea')
        || normalized.startsWith('feb')
        || normalized.startsWith('ff')
    );
}

function isTrustedInternalIpv6(ip) {
    const normalized = ip.toLowerCase();
    return (
        normalized === '::1'
        || isPrivateBackupIpv6(normalized)
        || normalized.startsWith('fe8')
        || normalized.startsWith('fe9')
        || normalized.startsWith('fea')
        || normalized.startsWith('feb')
    );
}

export function isPrivateOrReservedIp(ip) {
    const family = net.isIP(ip);
    if (family === 4) {
        return isPrivateIpv4(ip);
    }
    if (family === 6) {
        return isPrivateIpv6(ip);
    }
    return false;
}

function isTrustedInternalIp(ip) {
    const family = net.isIP(ip);
    if (family === 4) {
        return isTrustedInternalIpv4(ip);
    }
    if (family === 6) {
        return isTrustedInternalIpv6(ip);
    }
    return false;
}

export async function assertSafeOutboundHost(host, {
    allowPrivateHostsEnvVar = 'ALLOW_PRIVATE_OUTBOUND_HOSTS',
    allowPrivateAddresses = false,
    resolver = dns.lookup
} = {}) {
    if (process.env[allowPrivateHostsEnvVar] === 'true') {
        return true;
    }

    const normalizedHost = String(host || '').trim().toLowerCase();
    if (!normalizedHost) {
        throw new Error('Remote host is required');
    }

    if (
        normalizedHost === 'localhost'
        || normalizedHost.endsWith('.localhost')
        || normalizedHost === 'localhost.localdomain'
    ) {
        throw new Error('Private or loopback hosts are not allowed');
    }

    const isBlockedIpAddress = isBlockedOutboundIp(normalizedHost);
    const isPrivateIpAddress = isPrivateOrReservedIp(normalizedHost);

    if (isBlockedIpAddress || (isPrivateIpAddress && !allowPrivateAddresses)) {
        throw new Error('Private or loopback hosts are not allowed');
    }

    const resolvedAddresses = await resolver(normalizedHost, { all: true, verbatim: true });
    if (!Array.isArray(resolvedAddresses) || resolvedAddresses.length === 0) {
        throw new Error('Remote host could not be resolved');
    }

    if (resolvedAddresses.some((entry) => isBlockedOutboundIp(entry.address))) {
        throw new Error('Remote host resolves to a private or loopback address');
    }

    if (!allowPrivateAddresses && resolvedAddresses.some((entry) => isPrivateOrReservedIp(entry.address))) {
        throw new Error('Remote host resolves to a private or loopback address');
    }

    return true;
}

function isLoopbackOrLocalHostname(hostname) {
    return hostname === 'localhost'
        || hostname.endsWith('.localhost')
        || hostname === 'localhost.localdomain';
}

function isBlockedOutboundIp(ip) {
    const family = net.isIP(ip);
    if (family === 4) {
        return isBlockedOutboundIpv4(ip);
    }
    if (family === 6) {
        return isBlockedOutboundIpv6(ip);
    }
    return false;
}

export async function assertTrustedInternalServiceUrl(urlString, {
    allowedProtocols = ['http:', 'https:'],
    resolver = dns.lookup
} = {}) {
    const parsedUrl = new URL(String(urlString || ''));
    if (!allowedProtocols.includes(parsedUrl.protocol)) {
        throw new Error('Internal service URL must use http or https');
    }

    const hostname = parsedUrl.hostname.trim().toLowerCase();
    if (!hostname) {
        throw new Error('Internal service host is required');
    }

    if (isLoopbackOrLocalHostname(hostname) || isTrustedInternalIp(hostname)) {
        return true;
    }

    const resolvedAddresses = await resolver(hostname, { all: true, verbatim: true });
    if (!Array.isArray(resolvedAddresses) || resolvedAddresses.length === 0) {
        throw new Error('Internal service host could not be resolved');
    }

    if (resolvedAddresses.some((entry) => isTrustedInternalIp(entry.address))) {
        return true;
    }

    throw new Error('Internal service host must resolve to a private or loopback address');
}

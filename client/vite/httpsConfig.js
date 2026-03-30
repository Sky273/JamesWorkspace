import fs from 'fs';
import path from 'path';

export function getHttpsConfig({ certificatesDir, httpsEnabled }) {
  if (!httpsEnabled) {
    return false;
  }

  const certsPath = path.resolve(certificatesDir);
  const keyPath = path.join(certsPath, 'private.key');
  const certPath = path.join(certsPath, 'certificate.crt');

  if (!fs.existsSync(keyPath) || !fs.existsSync(certPath)) {
    console.warn('HTTPS enabled but certificates not found. Falling back to HTTP.');
    return false;
  }

  return {
    key: fs.readFileSync(keyPath),
    cert: fs.readFileSync(certPath),
  };
}

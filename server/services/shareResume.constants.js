import path from 'path';
import { UPLOAD_DIR } from '../config/constants.js';

export const SHARED_PDF_DIR = path.join(UPLOAD_DIR, 'shared');
export const RESOLVED_SHARED_PDF_DIR = path.resolve(SHARED_PDF_DIR);
export const SHARE_LINK_TTL_DAYS = 7;
export const SHARE_LINK_TTL_MS = SHARE_LINK_TTL_DAYS * 24 * 60 * 60 * 1000;

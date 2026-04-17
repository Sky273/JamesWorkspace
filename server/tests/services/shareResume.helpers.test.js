import { describe, it, expect } from 'vitest';
import { vi } from 'vitest';

vi.mock('../../config/database.js', () => ({
    query: vi.fn()
}));

vi.mock('../../utils/logger.backend.js', () => ({
    safeLog: vi.fn()
}));

import { isManagedSharedPdfPath } from '../../services/shareResume.helpers.js';

describe('shareResume.helpers', () => {
    it('rejects Windows absolute paths outside the managed directory on every platform', () => {
        expect(isManagedSharedPdfPath('C:\\temp\\outside.pdf')).toBe(false);
    });
});

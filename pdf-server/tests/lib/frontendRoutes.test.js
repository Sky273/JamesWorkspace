import { describe, it, expect, vi } from 'vitest';
import express from 'express';
import request from 'supertest';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const { registerFrontendRoutes } = require('../../lib/frontendRoutes.cjs');

describe('frontendRoutes', () => {
  it('returns 404 when no embedded dist is present', async () => {
    const app = express();
    const fs = {
      existsSync: vi.fn(() => false)
    };

    const result = registerFrontendRoutes({
      app,
      fs,
      distDir: 'C:\\missing\\dist',
      distIndexPath: 'C:\\missing\\dist\\index.html'
    });

    expect(result.enabled).toBe(false);

    const res = await request(app).get('/missing-page');
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: 'Not found' });
  });
});

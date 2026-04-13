import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockSafeLog = vi.fn();
vi.mock('../../utils/logger.backend.js', () => ({
  safeLog: (...args) => mockSafeLog(...args),
}));

import { enforceRegistrationProtection } from '../../services/registrationProtection.service.js';

function createResponse() {
  const res = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
  };
  return res;
}

function createRequest(body = {}, userAgent = 'Mozilla/5.0') {
  return {
    body,
    ip: '127.0.0.1',
    headers: { 'user-agent': userAgent },
    get: vi.fn((header) => {
      if (header === 'user-agent') {
        return userAgent;
      }
      return undefined;
    }),
  };
}

describe('registrationProtection.service', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.clearAllMocks();
    delete process.env.REGISTRATION_MIN_FORM_FILL_MS;
    delete process.env.REGISTRATION_BLOCKED_EMAIL_DOMAINS;
    delete process.env.TURNSTILE_SECRET_KEY;
    delete process.env.HCAPTCHA_SECRET_KEY;
    delete process.env.E2E_RELAX_RATE_LIMITING;
  });

  it('allows a normal registration request when captcha is not configured', async () => {
    const req = createRequest({
      email: 'valid@example.com',
      website: '',
      formRenderedAt: Date.now() - 5000,
    });
    const res = createResponse();
    const next = vi.fn();

    await enforceRegistrationProtection(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });

  it('rejects filled honeypot fields', async () => {
    const req = createRequest({
      email: 'valid@example.com',
      website: 'https://spam.example',
      formRenderedAt: Date.now() - 5000,
    });
    const res = createResponse();
    const next = vi.fn();

    await enforceRegistrationProtection(req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(next).not.toHaveBeenCalled();
  });

  it('rejects suspicious crawler user agents', async () => {
    const req = createRequest({
      email: 'valid@example.com',
      website: '',
      formRenderedAt: Date.now() - 5000,
    }, 'curl/8.0');
    const res = createResponse();
    const next = vi.fn();

    await enforceRegistrationProtection(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  it('rejects disposable email domains', async () => {
    const req = createRequest({
      email: 'valid@mailinator.com',
      website: '',
      formRenderedAt: Date.now() - 5000,
    });
    const res = createResponse();
    const next = vi.fn();

    await enforceRegistrationProtection(req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: 'Please use a non-temporary email address.' });
    expect(next).not.toHaveBeenCalled();
  });

  it('rejects submissions that are too fast', async () => {
    const req = createRequest({
      email: 'valid@example.com',
      website: '',
      formRenderedAt: Date.now() - 500,
    });
    const res = createResponse();
    const next = vi.fn();

    await enforceRegistrationProtection(req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(next).not.toHaveBeenCalled();
  });
});

import { safeLog } from '../utils/logger.backend.js';

const DEFAULT_MIN_FORM_FILL_MS = 4000;
const CAPTCHA_VERIFY_TIMEOUT_MS = 5000;
const SUSPICIOUS_USER_AGENT_PATTERNS = [
  /bot/i,
  /crawl/i,
  /spider/i,
  /slurp/i,
  /wget/i,
  /curl/i,
  /python-requests/i,
  /axios/i,
  /go-http-client/i,
  /java\//i,
  /libwww-perl/i,
  /headless/i,
];

const DEFAULT_DISPOSABLE_EMAIL_DOMAINS = new Set([
  '10minutemail.com',
  '20minutemail.com',
  'dispostable.com',
  'fakeinbox.com',
  'guerrillamail.com',
  'mailinator.com',
  'maildrop.cc',
  'temp-mail.org',
  'tempmail.com',
  'yopmail.com',
]);

function isE2EProtectionRelaxed() {
  return process.env.E2E_RELAX_RATE_LIMITING === 'true';
}

function getRegistrationCaptchaConfig() {
  const turnstileSecret =
    process.env.CLOUDFLARE_TURNSTILE_SECRET_KEY
    || process.env.TURNSTILE_SECRET_KEY;

  if (turnstileSecret) {
    return {
      provider: 'turnstile',
      secret: turnstileSecret,
      verifyUrl: 'https://challenges.cloudflare.com/turnstile/v0/siteverify',
      responseField: 'response',
    };
  }

  if (process.env.HCAPTCHA_SECRET_KEY) {
    return {
      provider: 'hcaptcha',
      secret: process.env.HCAPTCHA_SECRET_KEY,
      verifyUrl: 'https://hcaptcha.com/siteverify',
      responseField: 'response',
    };
  }

  return null;
}

function getDisposableDomains() {
  const domains = new Set(DEFAULT_DISPOSABLE_EMAIL_DOMAINS);
  const extraDomains = String(process.env.REGISTRATION_BLOCKED_EMAIL_DOMAINS || '')
    .split(',')
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean);

  extraDomains.forEach((domain) => domains.add(domain));
  return domains;
}

function getMinFormFillMs() {
  const parsed = Number.parseInt(process.env.REGISTRATION_MIN_FORM_FILL_MS || '', 10);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return DEFAULT_MIN_FORM_FILL_MS;
  }
  return parsed;
}

function getClientIp(req) {
  return req.ip
    || req.headers['x-forwarded-for']?.split(',')[0]?.trim()
    || req.connection?.remoteAddress
    || 'unknown';
}

function rejectRegistration(res, statusCode, error, metadata = {}) {
  safeLog('warn', 'Registration protection rejected request', {
    statusCode,
    error,
    ...metadata,
  });
  return res.status(statusCode).json({ error });
}

export async function enforceRegistrationProtection(req, res, next) {
  if (isE2EProtectionRelaxed()) {
    return next();
  }

  const metadata = {
    email: req.body?.email,
    ip: getClientIp(req),
    userAgent: req.get?.('user-agent') || req.headers?.['user-agent'] || '',
  };

  const honeypotValue = String(req.body?.website || '').trim();
  if (honeypotValue) {
    return rejectRegistration(res, 400, 'Registration request rejected.', {
      ...metadata,
      reason: 'honeypot_filled',
    });
  }

  const userAgent = String(metadata.userAgent || '');
  if (userAgent && SUSPICIOUS_USER_AGENT_PATTERNS.some((pattern) => pattern.test(userAgent))) {
    return rejectRegistration(res, 403, 'Registration request rejected.', {
      ...metadata,
      reason: 'suspicious_user_agent',
    });
  }

  const formRenderedAt = Number(req.body?.formRenderedAt);
  if (!Number.isFinite(formRenderedAt) || formRenderedAt <= 0) {
    return rejectRegistration(res, 400, 'Registration metadata is required.', {
      ...metadata,
      reason: 'missing_form_timestamp',
    });
  }

  const elapsedMs = Date.now() - formRenderedAt;
  if (elapsedMs < getMinFormFillMs()) {
    return rejectRegistration(res, 400, 'Registration submitted too quickly.', {
      ...metadata,
      reason: 'submitted_too_quickly',
      elapsedMs,
    });
  }

  const emailDomain = String(req.body?.email || '').split('@')[1]?.trim().toLowerCase();
  if (emailDomain && getDisposableDomains().has(emailDomain)) {
    return rejectRegistration(res, 400, 'Please use a non-temporary email address.', {
      ...metadata,
      reason: 'disposable_email_domain',
      emailDomain,
    });
  }

  const captchaConfig = getRegistrationCaptchaConfig();
  if (!captchaConfig) {
    return next();
  }

  const captchaToken = String(req.body?.captchaToken || '').trim();
  if (!captchaToken) {
    return rejectRegistration(res, 400, 'Captcha verification is required.', {
      ...metadata,
      reason: 'missing_captcha_token',
      provider: captchaConfig.provider,
    });
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), CAPTCHA_VERIFY_TIMEOUT_MS);

  try {
    const payload = new URLSearchParams();
    payload.set('secret', captchaConfig.secret);
    payload.set(captchaConfig.responseField, captchaToken);
    if (metadata.ip && metadata.ip !== 'unknown') {
      payload.set('remoteip', metadata.ip);
    }

    const response = await fetch(captchaConfig.verifyUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: payload.toString(),
      signal: controller.signal,
    });

    const result = await response.json().catch(() => ({}));
    if (!response.ok || result?.success !== true) {
      return rejectRegistration(res, 400, 'Captcha verification failed.', {
        ...metadata,
        reason: 'captcha_verification_failed',
        provider: captchaConfig.provider,
        captchaErrors: result?.['error-codes'] || null,
      });
    }
  } catch (error) {
    return rejectRegistration(res, 503, 'Captcha verification unavailable.', {
      ...metadata,
      reason: 'captcha_verification_error',
      provider: captchaConfig.provider,
      error: error.message,
    });
  } finally {
    clearTimeout(timeoutId);
  }

  return next();
}

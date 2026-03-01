# Security Documentation

**Version**: 1.7.0  
**Last Updated**: March 2026

## Overview

This document describes the security measures implemented in the ResumeConverter application, including trade-offs made for functionality and their mitigations.

---

## Architecture de Sécurité

```
┌─────────────────────────────────────────────────────────────────┐
│                         CLIENT (React)                          │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐  │
│  │ httpOnly     │  │ CSRF Token   │  │ DOMPurify            │  │
│  │ Cookies      │  │ (Header)     │  │ Sanitization         │  │
│  └──────────────┘  └──────────────┘  └──────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      SERVER (Express.js)                        │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐  │
│  │ Rate Limit   │  │ Helmet       │  │ CORS                 │  │
│  │ (Multi-layer)│  │ (Headers)    │  │ (Strict Origin)      │  │
│  └──────────────┘  └──────────────┘  └──────────────────────┘  │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐  │
│  │ JWT Auth     │  │ Token        │  │ Zod Validation       │  │
│  │ Middleware   │  │ Blacklist    │  │ (Input)              │  │
│  └──────────────┘  └──────────────┘  └──────────────────────┘  │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐  │
│  │ Security     │  │ Firm Access  │  │ sanitize-html        │  │
│  │ Logging      │  │ Control      │  │ (Output)             │  │
│  └──────────────┘  └──────────────┘  └──────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      EXTERNAL SERVICES                          │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐  │
│  │ PostgreSQL   │  │ OpenAI API   │  │ Anthropic API        │  │
│  │ (Encrypted)  │  │ (Proxy)      │  │ (Proxy)              │  │
│  └──────────────┘  └──────────────┘  └──────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Authentication & Authorization

### JWT Token Security

- **Algorithm**: HS256 with explicit algorithm specification to prevent algorithm confusion attacks
- **Separate Secrets**: Access tokens and refresh tokens use different secrets
- **Token Expiration**: 
  - Access tokens: 1 hour
  - Refresh tokens: 7 days
- **Token Blacklist**: In-memory blacklist for immediate token revocation
  - Tokens are blacklisted on logout
  - All user tokens are invalidated when account is deactivated
  - Automatic cleanup of expired blacklisted tokens (hourly)
  - User-level blacklisting for security incidents

### Session Management

- **httpOnly Cookies**: Tokens are stored in httpOnly cookies (not accessible via JavaScript)
- **Secure Flag**: Enabled in production (HTTPS only)
- **SameSite**: `lax` to prevent CSRF while allowing normal navigation
- **CSRF Protection**: Double-submit cookie pattern with `csrf-csrf` library
- **Token Expiration Headers**: `X-Token-Expires-In` and `X-Token-Expiring-Soon` for frontend handling

### User Status Verification

- User status is checked on every authenticated request
- Inactive users are immediately blocked with clear error message
- Account deactivation triggers immediate token invalidation via user blacklist

### Role-Based Access Control (RBAC)

| Role | Permissions |
|------|-------------|
| **admin** | Full access, user management, settings, metrics, 3x rate limits |
| **user** | Own resources, assigned firm resources |

### Firm-Based Access Control

- Users are associated with a **firm** (cabinet de recrutement)
- Resources (CVs, missions, adaptations) are scoped to firms
- Admins can access all firms
- `hasFirmAccess()` middleware enforces firm-level isolation

### Two-Factor Authentication (2FA)

- **TOTP-based**: Time-based One-Time Password using `speakeasy` library
- **RFC 6238 compliant**: Compatible with Google Authenticator, Authy, and other TOTP apps
- **Encrypted secrets**: TOTP secrets are encrypted with AES-256-GCM before storage
- **Backup codes**: 8 single-use backup codes generated and encrypted
- **Clock drift tolerance**: 60-second window (±2 steps) for code validation
- **Scope**: Applies to email/password login only (OAuth2/Google login uses Google's security)

---

## Content Security Policy (CSP)

### Current Configuration

```javascript
scriptSrc: [
    "'self'",
    "'unsafe-inline'",  // Required by TinyMCE
    "'unsafe-eval'",    // Required by TinyMCE and PDF.js
    "https://cdnjs.cloudflare.com",
    "https://unpkg.com",
    "blob:"
]
```

### Trade-offs & Risks

| Directive | Risk | Reason Required | Mitigation |
|-----------|------|-----------------|------------|
| `unsafe-inline` | XSS via inline scripts | TinyMCE uses inline event handlers | All user content sanitized with DOMPurify |
| `unsafe-eval` | Code injection via eval() | TinyMCE and PDF.js dynamic code | Limited to trusted libraries only |
| `blob:` | Blob URL attacks | PDF.js worker functionality | PDF processing limited to trusted sources |

### Mitigations

1. **Input Sanitization**: All user-generated HTML is sanitized with:
   - Frontend: `isomorphic-dompurify` with strict configuration
   - Backend: `sanitize-html` with allowlist approach

2. **Output Encoding**: React's JSX automatically escapes content

3. **Trusted Libraries Only**: External scripts limited to:
   - cdnjs.cloudflare.com (PDF.js worker)
   - unpkg.com (PDF.js fallback)

### Future Improvements

- Monitor TinyMCE updates for nonce-based CSP support
- Consider server-side PDF text extraction to reduce client-side PDF.js usage
- Implement Subresource Integrity (SRI) for external scripts

---

## Input Validation & Sanitization

### Backend Validation (Zod)

All API inputs are validated using Zod schemas:
- `signInSchema`: Email and password validation
- `registerSchema`: Registration data validation
- `createTemplateSchema`: Template content validation
- `updateResumeSchema`: Resume field validation

### Airtable Formula Injection Prevention

The `escapeAirtableFormula()` function prevents formula injection:
- Escapes special characters: `\ ' " { } ( ) ,`
- Neutralizes dangerous prefixes: `= + - @ \t \r \n`
- Logs potential injection attempts

### HTML Sanitization

**Frontend** (`sanitizer.frontend.ts`):
```typescript
// Strict mode for user content
sanitizeUserHtml(html) // Only allows: p, br, strong, em, u, ul, ol, li, a
```

**Backend** (`sanitizer.backend.js`):
```javascript
// Allowlist approach with safe tags only
sanitizeHtmlContent(content)
```

---

## Rate Limiting

### Multi-Layer Protection

| Layer | Limit | Window | Purpose | Implementation |
|-------|-------|--------|---------|----------------|
| **Global** | 1000 req | 15 min | DDoS protection | `express-rate-limit` |
| **Auth** | 20 req | 15 min | Brute-force prevention | Skip successful requests |
| **User** | 50 req | 15 min | Per-user abuse prevention | Custom middleware |
| **LLM** | 100 req | 1 hour | API cost protection | `express-rate-limit` |
| **Upload** | 50 req | 15 min | Storage abuse prevention | `express-rate-limit` |
| **Combined** | 30 req | 1 min | IP+User anti-bypass | Custom middleware |

### Admin Rate Limit Bonus

Administrators receive **3x the standard rate limits** to accommodate administrative tasks.

### Combined Rate Limiting

IP + User ID combined limiting prevents bypass via:
- Proxy/VPN rotation
- Multiple accounts from same IP
- Session hijacking attempts

### Rate Limit Headers

All rate-limited responses include:
- `X-RateLimit-Limit`: Maximum requests allowed
- `X-RateLimit-Remaining`: Requests remaining in window
- `X-RateLimit-Reset`: Window reset timestamp (ISO 8601)

### Automatic Cleanup

Rate limit stores are automatically cleaned every hour to prevent memory leaks.

---

## Secrets Management

### Required Secrets

| Secret | Min Length | Purpose |
|--------|------------|---------|
| `JWT_SECRET` | 32 chars | Access token signing |
| `CSRF_SECRET` | 32 chars | CSRF token generation |
| `REFRESH_TOKEN_SECRET` | 32 chars | Refresh token signing |

### Best Practices

1. **Never commit secrets** to version control
2. **Use strong random values**: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`
3. **Rotate regularly**: Every 90 days recommended
4. **Separate environments**: Different secrets for dev/staging/production
5. **Use secret managers** in production: AWS Secrets Manager, Azure Key Vault, etc.

---

## API Security

### CORS Configuration

- Strict origin checking with allowlist
- No wildcard origins in production
- Credentials included for cookie-based auth

### Request Headers

- `Cache-Control: no-store` on all API responses
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `Strict-Transport-Security` in production

---

## Security Logging

### Events Logged

| Event | Level | Description |
|-------|-------|-------------|
| `AUTH_SUCCESS` | INFO | Successful login |
| `AUTH_FAILURE` | SECURITY | Failed login attempt |
| `AUTH_BLOCKED` | SECURITY | Blocked login (inactive account) |
| `RATE_LIMIT_HIT` | SECURITY | Rate limit exceeded |
| `INVALID_TOKEN` | SECURITY | Invalid or expired token |
| `TOKEN_EXPIRED` | WARNING | Token expiration |
| `SUSPICIOUS_ACTIVITY` | SECURITY | Potential attack detected |
| `FILE_UPLOAD` | INFO | File upload event |
| `FILE_UPLOAD_REJECTED` | SECURITY | Rejected file upload |
| `LLM_REQUEST` | INFO | AI API usage tracking |
| `DATA_ACCESS` | INFO | Sensitive data access |

### Log Storage

#### In-Memory (Real-time)
- Optimized circular buffer (O(1) operations)
- Pre-allocated fixed-size array (configurable via `MAX_LOGS`)
- Last 1000 entries by default
- Accessible via `/api/admin/security-logs` (admin only)

#### File Persistence (Critical Events)
- Location: `logs/security.log`
- Format: JSON lines (one entry per line)
- Rotation: 10MB max file size, 5 rotated files kept
- Critical events automatically persisted:
  - `AUTH_FAILURE`, `AUTH_BLOCKED`
  - `RATE_LIMIT_HIT`, `INVALID_TOKEN`
  - `SUSPICIOUS_ACTIVITY`, `FILE_UPLOAD_REJECTED`
  - All `ERROR` and `SECURITY` level events

### Log Entry Structure

```json
{
  "timestamp": "2026-02-11T12:00:00.000Z",
  "level": "SECURITY",
  "event": "AUTH_FAILURE",
  "ip": "192.168.1.1",
  "email": "user@example.com",
  "endpoint": "/api/auth/login",
  "method": "POST",
  "message": "Invalid password"
}
```

---

## LLM API Security

### API Key Protection

- **Server-side only**: API keys (OpenAI, Anthropic) are never exposed to the frontend
- **Proxy endpoints**: All LLM calls go through backend proxy routes
  - `/api/llm/openai` - OpenAI proxy
  - `/api/llm/anthropic` - Anthropic proxy
- **Environment variables**: Keys stored in `.env`, never committed to version control

### LLM Request Validation

```javascript
// Zod schema for OpenAI requests
openaiRequestSchema = z.object({
  messages: z.array(messageSchema).min(1).max(50),
  model: z.string().optional(),
  max_tokens: z.number().min(1).max(16000).optional(),
  temperature: z.number().min(0).max(2).optional()
});
```

### Prompt Length Limits

- Maximum prompt length: Configurable via `MAX_PROMPT_LENGTH`
- Prevents abuse and excessive API costs

### LLM Metrics Tracking

All LLM requests are tracked in `llm_metrics` table:
- Model used
- Tokens consumed (input/output)
- Response time
- Cost estimation
- User/endpoint attribution

---

## Known Limitations

1. **Token Blacklist**: In-memory only, lost on restart
   - Mitigation: Short token expiration (1 hour)
   - Mitigation: User-level blacklist for account deactivation
   - Future: Redis-based blacklist for multi-instance

2. **Security Logs**: Partially in-memory
   - Mitigation: Critical events persisted to file
   - Mitigation: Log rotation (10MB, 5 files)
   - Future: External log aggregation service (ELK, Datadog)

3. **CSP Relaxations**: Required for TinyMCE
   - Mitigation: Strict input sanitization
   - Future: Nonce-based CSP when supported

4. **Single Instance**: Rate limits not shared across instances
   - Mitigation: Sticky sessions in load balancer
   - Future: Redis-based rate limiting

---

## Incident Response

### If Token Compromised

1. Identify affected user
2. Call `blacklistUser(userId, 'security_incident')`
3. Force password reset
4. Review security logs

### If API Key Exposed

1. Rotate affected key immediately
2. Review access logs for unauthorized usage
3. Update environment variables
4. Redeploy application

---

## Security Checklist

### Implemented ✅

- [x] JWT with explicit algorithm (HS256)
- [x] Separate access/refresh token secrets
- [x] Token blacklist for revocation (token + user level)
- [x] CSRF protection (double-submit cookie)
- [x] Rate limiting (6 layers: global, auth, user, LLM, upload, combined)
- [x] Input validation (Zod schemas)
- [x] HTML sanitization (DOMPurify frontend, sanitize-html backend)
- [x] Airtable formula injection prevention
- [x] Security event logging (memory + file persistence)
- [x] Graceful shutdown with cleanup
- [x] LLM API key protection (server-side proxy)
- [x] Firm-based access control (multi-tenant isolation)
- [x] Role-based access control (admin/user)
- [x] Token expiration headers for frontend
- [x] Admin rate limit bonus (3x)
- [x] Log file rotation (10MB, 5 files)
- [x] Automatic rate limit store cleanup

### Planned 📋

- [ ] Redis-based token blacklist (multi-instance support)
- [ ] Redis-based rate limiting (shared across instances)
- [ ] External log aggregation (ELK, Datadog)
- [ ] Nonce-based CSP (pending TinyMCE support)
- [ ] Two-factor authentication (2FA)
- [ ] Password complexity requirements
- [ ] Account lockout after failed attempts

---

## Files Reference

| File | Purpose |
|------|---------|
| `server/middleware/auth.middleware.js` | JWT authentication, role/firm access |
| `server/middleware/rateLimit.middleware.js` | All rate limiting logic |
| `server/middleware/csrf.middleware.js` | CSRF protection |
| `server/services/tokenBlacklist.service.js` | Token/user blacklisting |
| `server/services/security.service.js` | Security logging |
| `server/services/jwt.service.js` | JWT creation/verification |
| `server/utils/validation.js` | Zod schemas |
| `server/config/constants.js` | Security constants |

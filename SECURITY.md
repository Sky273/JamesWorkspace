# Security Documentation

## Overview

This document describes the security measures implemented in the ResumeConverter application, including trade-offs made for functionality and their mitigations.

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
  - Automatic cleanup of expired blacklisted tokens

### Session Management

- **httpOnly Cookies**: Tokens are stored in httpOnly cookies (not accessible via JavaScript)
- **Secure Flag**: Enabled in production (HTTPS only)
- **SameSite**: `lax` to prevent CSRF while allowing normal navigation
- **CSRF Protection**: Double-submit cookie pattern with `csrf-csrf` library

### User Status Verification

- User status is checked on every authenticated request
- Inactive users are immediately blocked
- Account deactivation triggers immediate token invalidation

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

| Layer | Limit | Window | Purpose |
|-------|-------|--------|---------|
| Global | 1000 req | 15 min | DDoS protection |
| Auth | 20 req | 15 min | Brute-force prevention |
| User | 50 req | 15 min | Per-user abuse prevention |
| LLM | 20 req | 1 hour | API cost protection |
| Upload | 50 req | 15 min | Storage abuse prevention |

### Combined Rate Limiting

IP + User ID combined limiting prevents bypass via:
- Proxy/VPN rotation
- Multiple accounts from same IP

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

- `AUTH_SUCCESS`: Successful login
- `AUTH_FAILURE`: Failed login attempt
- `AUTH_BLOCKED`: Blocked login (inactive account)
- `RATE_LIMIT_HIT`: Rate limit exceeded
- `SUSPICIOUS_ACTIVITY`: Potential attack detected
- `LLM_REQUEST`: AI API usage tracking

### Log Storage

- In-memory circular buffer (last 1000 entries)
- Console output for persistent logging
- Consider external log aggregation for production

---

## Known Limitations

1. **Token Blacklist**: In-memory only, lost on restart
   - Mitigation: Short token expiration (1 hour)
   - Future: Redis-based blacklist for multi-instance

2. **Security Logs**: In-memory only
   - Mitigation: Console logging for persistence
   - Future: External log aggregation service

3. **CSP Relaxations**: Required for TinyMCE
   - Mitigation: Strict input sanitization
   - Future: Nonce-based CSP when supported

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

- [x] JWT with explicit algorithm
- [x] Separate access/refresh token secrets
- [x] Token blacklist for revocation
- [x] CSRF protection
- [x] Rate limiting (multi-layer)
- [x] Input validation (Zod)
- [x] HTML sanitization (DOMPurify)
- [x] Airtable formula injection prevention
- [x] Security event logging
- [x] Graceful shutdown with cleanup
- [ ] Redis-based token blacklist (future)
- [ ] External log aggregation (future)
- [ ] Nonce-based CSP (pending TinyMCE support)

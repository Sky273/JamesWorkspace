export function createAuthSwaggerPaths({
    auth401,
    forbidden403,
    notFound404,
    validation400,
    error500,
    security,
    securityCsrf,
    paramId
}) {
    return {
        '/auth/signin': {
            post: {
                tags: ['Authentication'],
                summary: 'Sign in',
                description: 'Authenticate with email and password. Returns JWT tokens in httpOnly cookies.',
                requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/LoginRequest' } } } },
                responses: {
                    200: { description: 'Login successful (or requires 2FA)', content: { 'application/json': { schema: { $ref: '#/components/schemas/LoginResponse' } } } },
                    401: { description: 'Invalid credentials' },
                    403: { description: 'Account inactive' },
                    429: { description: 'Too many login attempts' },
                    500: error500
                }
            }
        },
        '/auth/register': {
            post: {
                tags: ['Authentication'],
                summary: 'Register new user',
                description: 'Create a new user account (status: pending until approved by admin)',
                requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['email', 'password', 'name'], properties: { email: { type: 'string', format: 'email' }, password: { type: 'string', minLength: 6 }, name: { type: 'string' } } } } } },
                responses: {
                    201: { description: 'User registered successfully' },
                    409: { description: 'Email already exists' },
                    429: { description: 'Rate limited' },
                    500: error500
                }
            }
        },
        '/auth/refresh': {
            post: {
                tags: ['Authentication'],
                summary: 'Refresh access token',
                description: 'Use refresh token cookie to get a new access token',
                responses: {
                    200: { description: 'Token refreshed', content: { 'application/json': { schema: { type: 'object', properties: { user: { $ref: '#/components/schemas/User' } } } } } },
                    401: { description: 'Invalid or expired refresh token' },
                    500: error500
                }
            }
        },
        '/auth/logout': {
            post: {
                tags: ['Authentication'],
                summary: 'Sign out',
                description: 'Revoke tokens and clear cookies',
                security,
                responses: {
                    200: { description: 'Signed out successfully' },
                    500: error500
                }
            }
        },
        '/auth/signout': {
            post: {
                tags: ['Authentication'],
                summary: 'Sign out (alias)',
                description: 'Alias of /auth/logout. Revoke tokens and clear cookies.',
                security,
                responses: {
                    200: { description: 'Signed out successfully' },
                    500: error500
                }
            }
        },
        '/auth/me': {
            get: {
                tags: ['Authentication'],
                summary: 'Get current user',
                description: 'Get the currently authenticated user profile',
                security,
                responses: {
                    200: { description: 'Current user', content: { 'application/json': { schema: { type: 'object', properties: { user: { $ref: '#/components/schemas/User' } } } } } },
                    401: auth401,
                    404: notFound404,
                    500: error500
                }
            }
        },
        '/auth/google': {
            get: {
                tags: ['Authentication'],
                summary: 'Initiate Google OAuth',
                description: 'Start Google OAuth flow for login or account linking',
                parameters: [
                    { name: 'action', in: 'query', schema: { type: 'string', enum: ['login', 'link'] } },
                    { name: 'returnUrl', in: 'query', schema: { type: 'string' } }
                ],
                responses: { 302: { description: 'Redirect to Google consent screen' } }
            }
        },
        '/auth/google/callback': {
            get: {
                tags: ['Authentication'],
                summary: 'Google OAuth callback',
                description: 'Handle Google OAuth callback after user consent',
                responses: { 302: { description: 'Redirect to application with auth result' } }
            }
        },
        '/auth/google/token': {
            post: {
                tags: ['Authentication'],
                summary: 'Sign in with Google ID token',
                description: 'Authenticate directly with a Google ID token and establish the application session.',
                requestBody: {
                    required: true,
                    content: {
                        'application/json': {
                            schema: {
                                type: 'object',
                                required: ['idToken'],
                                properties: {
                                    idToken: { type: 'string' }
                                }
                            }
                        }
                    }
                },
                responses: {
                    200: {
                        description: 'Authentication successful',
                        content: {
                            'application/json': {
                                schema: {
                                    type: 'object',
                                    properties: {
                                        user: { $ref: '#/components/schemas/User' }
                                    }
                                }
                            }
                        }
                    },
                    400: validation400,
                    401: { description: 'Invalid Google token or no matching account' },
                    403: { description: 'Account inactive' },
                    429: { description: 'Rate limited' },
                    500: error500
                }
            }
        },
        '/auth/google/status': {
            get: {
                tags: ['Authentication'],
                summary: 'Google link status',
                description: 'Check if current user has a linked Google account',
                security,
                responses: { 200: { description: 'Google link status' }, 401: auth401 }
            }
        },
        '/auth/google/unlink': {
            post: {
                tags: ['Authentication'],
                summary: 'Unlink Google account',
                security: securityCsrf,
                responses: { 200: { description: 'Google account unlinked' }, 401: auth401 }
            }
        },
        '/auth/forgot-password': {
            post: {
                tags: ['Authentication'],
                summary: 'Request password reset',
                requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['email'], properties: { email: { type: 'string', format: 'email' } } } } } },
                responses: { 200: { description: 'Reset email sent (always returns 200 for security)' } }
            }
        },
        '/auth/reset-password': {
            post: {
                tags: ['Authentication'],
                summary: 'Reset password with token',
                requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['token', 'password'], properties: { token: { type: 'string' }, password: { type: 'string', minLength: 6 } } } } } },
                responses: { 200: { description: 'Password reset successful' }, 400: { description: 'Invalid or expired token' } }
            }
        },
        '/auth/users': {
            post: {
                tags: ['Authentication'],
                summary: 'Create user (admin)',
                description: 'Admin creates a new user with specified role and firm',
                security: securityCsrf,
requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['email', 'password', 'name'], properties: { email: { type: 'string', format: 'email' }, password: { type: 'string' }, name: { type: 'string' }, role: { type: 'string', enum: ['admin', 'localAdmin', 'user'] }, firm_id: { type: 'string', format: 'uuid' } } } } } },
                responses: { 201: { description: 'User created' }, 401: auth401, 403: forbidden403, 409: { description: 'Email exists' } }
            }
        },
        '/auth/users/{id}': {
            put: {
                tags: ['Authentication'],
                summary: 'Update user (admin)',
                security: securityCsrf,
                parameters: [paramId],
                requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', properties: { name: { type: 'string' }, role: { type: 'string' }, status: { type: 'string' }, firm_id: { type: 'string' }, password: { type: 'string' } } } } } },
                responses: { 200: { description: 'User updated' }, 401: auth401, 403: forbidden403, 404: notFound404 }
            },
            delete: {
                tags: ['Authentication'],
                summary: 'Delete user (admin)',
                security: securityCsrf,
                parameters: [paramId],
                responses: { 200: { description: 'User deleted' }, 401: auth401, 403: forbidden403 }
            }
        },
        '/2fa/status': {
            get: {
                tags: ['Authentication'],
                summary: 'Get 2FA status',
                security,
                responses: { 200: { description: '2FA status for current user' }, 401: auth401 }
            }
        },
        '/2fa/setup': {
            post: {
                tags: ['Authentication'],
                summary: 'Setup 2FA',
                description: 'Generate TOTP secret and QR code',
                security: securityCsrf,
                responses: { 200: { description: 'TOTP secret and QR code' }, 401: auth401 }
            }
        },
        '/2fa/verify': {
            post: {
                tags: ['Authentication'],
                summary: 'Verify and enable 2FA',
                security: securityCsrf,
                requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['code'], properties: { code: { type: 'string', minLength: 6 } } } } } },
                responses: { 200: { description: '2FA enabled' }, 400: { description: 'Invalid code' }, 401: auth401 }
            }
        },
        '/2fa/disable': {
            post: {
                tags: ['Authentication'],
                summary: 'Disable 2FA',
                security: securityCsrf,
                requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['code'], properties: { code: { type: 'string' } } } } } },
                responses: { 200: { description: '2FA disabled' }, 401: auth401 }
            }
        },
        '/2fa/backup-codes/regenerate': {
            post: {
                tags: ['Authentication'],
                summary: 'Regenerate backup codes',
                security: securityCsrf,
                requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['code'], properties: { code: { type: 'string' } } } } } },
                responses: { 200: { description: 'New backup codes' }, 401: auth401 }
            }
        }
    };
}

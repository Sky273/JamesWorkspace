import { describe, expect, it } from 'vitest';

import { getResponseErrorMessage } from './apiInterceptor.responses';

describe('getResponseErrorMessage', () => {
  it('prefers Gemma provider debug details when present', async () => {
    const response = new Response(JSON.stringify({
      error: 'Gemma API error',
      providerError: 'Request contains an invalid argument.',
      providerDetails: 'Model gemma-4-31b-it does not support response_format=json_schema.',
      debug: {
        provider: 'gemma',
        statusCode: 400,
        providerStatus: 'INVALID_ARGUMENT'
      }
    }), {
      status: 400,
      headers: { 'content-type': 'application/json' }
    });

    await expect(getResponseErrorMessage(response, 'Fallback error')).resolves.toBe(
      'Request contains an invalid argument.\n\nDétails API: Model gemma-4-31b-it does not support response_format=json_schema.'
    );
  });

  it('falls back to nested error strings for standard JSON errors', async () => {
    const response = new Response(JSON.stringify({
      error: 'Validation failed'
    }), {
      status: 400,
      headers: { 'content-type': 'application/json' }
    });

    await expect(getResponseErrorMessage(response, 'Fallback error')).resolves.toBe('Validation failed');
  });

  it('surfaces the raw provider payload when Gemma exposes no structured message', async () => {
    const response = new Response(JSON.stringify({
      error: 'Gemma API error',
      providerPayload: '{"error":"Gemma API error","status":"INVALID_ARGUMENT"}'
    }), {
      status: 400,
      headers: { 'content-type': 'application/json' }
    });

    await expect(getResponseErrorMessage(response, 'Fallback error')).resolves.toBe(
      'Gemma API error\n\nPayload API: {"error":"Gemma API error","status":"INVALID_ARGUMENT"}'
    );
  });
});

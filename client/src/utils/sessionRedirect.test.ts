import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  setSessionExpiredHandler,
  triggerSessionExpiry,
  resetSessionRedirect,
  isSessionRedirectInProgress,
} from './sessionRedirect';

describe('sessionRedirect', () => {
  beforeEach(() => {
    resetSessionRedirect();
    setSessionExpiredHandler(null);
  });

  it('should trigger the registered handler once', () => {
    const handler = vi.fn();
    setSessionExpiredHandler(handler);

    triggerSessionExpiry();
    triggerSessionExpiry();

    expect(handler).toHaveBeenCalledTimes(1);
    expect(isSessionRedirectInProgress()).toBe(true);
  });

  it('should reset redirect state', () => {
    const handler = vi.fn();
    setSessionExpiredHandler(handler);

    triggerSessionExpiry();
    expect(isSessionRedirectInProgress()).toBe(true);

    resetSessionRedirect();
    expect(isSessionRedirectInProgress()).toBe(false);
  });
});

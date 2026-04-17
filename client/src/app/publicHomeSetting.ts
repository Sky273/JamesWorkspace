import { useEffect, useState } from 'react';

const DEFAULT_PUBLIC_HOME_ENABLED = import.meta.env.VITE_PUBLIC_HOME === 'true';

let cachedValue = DEFAULT_PUBLIC_HOME_ENABLED;
let hasCachedValue = false;
let pendingRequest: Promise<boolean | null> | null = null;

function shouldOptimisticallyEnablePublicHome(): boolean {
  if (typeof window === 'undefined') {
    return DEFAULT_PUBLIC_HOME_ENABLED;
  }

  // `/welcome` is a public route: render it immediately on first paint and let
  // the runtime settings fetch correct the state afterwards if needed.
  return window.location.pathname === '/welcome' || DEFAULT_PUBLIC_HOME_ENABLED;
}

async function fetchPublicHomeEnabledFromApi(): Promise<boolean | null> {
  if (hasCachedValue) {
    return cachedValue;
  }

  if (!pendingRequest) {
    const request = typeof fetch === 'function'
      ? fetch('/api/settings/public-home', {
        method: 'GET',
        credentials: 'include',
      })
      : null;

    if (!request || typeof request.then !== 'function') {
      return null;
    }

    pendingRequest = request
      .then(async (response) => {
        if (!response.ok) {
          return null;
        }

        const payload = await response.json() as { publicHomeEnabled?: boolean | null };
        if (typeof payload.publicHomeEnabled !== 'boolean') {
          return null;
        }

        cachedValue = payload.publicHomeEnabled;
        hasCachedValue = true;
        return payload.publicHomeEnabled;
      })
      .catch(() => null)
      .finally(() => {
        pendingRequest = null;
      });
  }

  return pendingRequest;
}

export function getDefaultPublicHomeEnabled(): boolean {
  return DEFAULT_PUBLIC_HOME_ENABLED;
}

export function setPublicHomeEnabledRuntimeValue(value: boolean): void {
  cachedValue = value;
  hasCachedValue = true;
}

export function resetPublicHomeEnabledRuntimeCache(): void {
  cachedValue = DEFAULT_PUBLIC_HOME_ENABLED;
  hasCachedValue = false;
  pendingRequest = null;
}

export function usePublicHomeEnabled(): boolean {
  const [enabled, setEnabled] = useState<boolean>(() => (
    hasCachedValue ? cachedValue : shouldOptimisticallyEnablePublicHome()
  ));

  useEffect(() => {
    let active = true;

    void fetchPublicHomeEnabledFromApi().then((value) => {
      if (active && typeof value === 'boolean') {
        setEnabled(value);
      }
    });

    return () => {
      active = false;
    };
  }, []);

  return enabled;
}

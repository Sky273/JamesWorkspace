import { useEffect, useState, type ReactNode } from 'react';

interface DeferredRenderProps {
  children: ReactNode;
  delayMs?: number;
}

export default function DeferredRender({ children, delayMs = 150 }: DeferredRenderProps) {
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    let idleId: number | null = null;

    const activate = () => setIsReady(true);

    if (typeof window === 'undefined') {
      activate();
      return undefined;
    }

    if ('requestIdleCallback' in window) {
      idleId = window.requestIdleCallback(activate, { timeout: delayMs * 4 });
      return () => {
        if (idleId !== null) {
          window.cancelIdleCallback(idleId);
        }
      };
    }

    timeoutId = globalThis.setTimeout(activate, delayMs);
    return () => {
      if (timeoutId !== null) {
        globalThis.clearTimeout(timeoutId);
      }
    };
  }, [delayMs]);

  return isReady ? <>{children}</> : null;
}

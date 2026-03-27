import { lazy, Suspense, useEffect, useRef, useState } from 'react';

const WebGLBackground = lazy(() => import('./WebGLBackground'));

interface DeferredWebGLBackgroundProps {
  className?: string;
}

export default function DeferredWebGLBackground({ className = '' }: DeferredWebGLBackgroundProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isVisible, setIsVisible] = useState(false);
  const [shouldRender, setShouldRender] = useState(false);

  useEffect(() => {
    const node = containerRef.current;
    if (!node || typeof IntersectionObserver === 'undefined') {
      setIsVisible(true);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: '160px 0px' }
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!isVisible || shouldRender || typeof window === 'undefined') {
      return;
    }

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      return;
    }

    if (window.innerWidth < 1024) {
      return;
    }

    const connection = (navigator as Navigator & {
      connection?: { saveData?: boolean };
    }).connection;
    if (connection?.saveData) {
      return;
    }

    const deviceMemory = (navigator as Navigator & { deviceMemory?: number }).deviceMemory;
    if (typeof deviceMemory === 'number' && deviceMemory <= 4) {
      return;
    }

    let cancelled = false;
    let timeoutId: number | null = null;
    let idleId: number | null = null;

    const enable = () => {
      if (!cancelled) {
        setShouldRender(true);
      }
    };

    if ('requestIdleCallback' in window && typeof window.requestIdleCallback === 'function') {
      idleId = window.requestIdleCallback(() => enable(), { timeout: 1200 });
    } else {
      timeoutId = window.setTimeout(enable, 600);
    }

    return () => {
      cancelled = true;
      if (idleId !== null && 'cancelIdleCallback' in window && typeof window.cancelIdleCallback === 'function') {
        window.cancelIdleCallback(idleId);
      }
      if (timeoutId !== null) {
        window.clearTimeout(timeoutId);
      }
    };
  }, [isVisible, shouldRender]);

  return (
    <div ref={containerRef} className="absolute inset-0 -z-10 overflow-hidden pointer-events-none" aria-hidden="true">
      {shouldRender ? (
        <Suspense fallback={null}>
          <WebGLBackground className={className} />
        </Suspense>
      ) : null}
    </div>
  );
}

import '@testing-library/jest-dom';
import { vi } from 'vitest';

const GLIB_GIO_WARNING_PATTERN = /GLib-GIO-WARNING|Failed to open application manifest .*Microsoft\.Limitless/i;
const HAPPY_DOM_ABORT_NOISE_PATTERN = /DOMException \[(AbortError|NetworkError)\]|happy-dom\/lib\/fetch\/Fetch\.js|happy-dom\/lib\/browser\/utilities\/BrowserFrameFactory\.js|Failed to execute "fetch\(\)" on "Window" with URL "http:\/\/localhost:3000\/api\/resumes\/.*\/preview"/i;
const PUNYCODE_DEPRECATION_PATTERN = /\[DEP0040\]|The `punycode` module is deprecated/i;
const stderrPatchFlag = Symbol.for('resumeconverter.vitest.stderrPatched');

if (!(process as typeof process & { [key: symbol]: boolean })[stderrPatchFlag]) {
  const originalWrite = process.stderr.write.bind(process.stderr);
  const patchedProcess = process as typeof process & { [key: symbol]: boolean };

  process.stderr.write = ((chunk: unknown, encoding?: BufferEncoding | ((error?: Error | null) => void), callback?: (error?: Error | null) => void) => {
    const text = typeof chunk === 'string' ? chunk : Buffer.isBuffer(chunk) ? chunk.toString('utf8') : String(chunk ?? '');
    if (
      GLIB_GIO_WARNING_PATTERN.test(text)
      || HAPPY_DOM_ABORT_NOISE_PATTERN.test(text)
      || PUNYCODE_DEPRECATION_PATTERN.test(text)
    ) {
      if (typeof encoding === 'function') {
        encoding();
      } else if (typeof callback === 'function') {
        callback();
      }
      return true;
    }
    return originalWrite(chunk as never, encoding as never, callback as never);
  }) as typeof process.stderr.write;

  patchedProcess[stderrPatchFlag] = true;
}

// Mock window.matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

// Mock ResizeObserver. Headless UI instantiates it with `new`, so keep it as a constructor.
class ResizeObserverMock {
  observe = vi.fn();
  unobserve = vi.fn();
  disconnect = vi.fn();
}
global.ResizeObserver = ResizeObserverMock;
globalThis.ResizeObserver = ResizeObserverMock;
Object.defineProperty(window, 'ResizeObserver', {
  configurable: true,
  writable: true,
  value: ResizeObserverMock,
});

// Mock IntersectionObserver
global.IntersectionObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}));

// Mock fetch
global.fetch = vi.fn();

// Prevent jsdom tests from delegating popup handling to the host OS
Object.defineProperty(window, 'open', {
  writable: true,
  value: vi.fn(() => null),
});

// Prevent happy-dom from delegating anchor navigation to the host OS on Windows
Object.defineProperty(HTMLAnchorElement.prototype, 'click', {
  configurable: true,
  writable: true,
  value: vi.fn(),
});

// Prevent happy-dom iframe navigation from issuing real fetches during tests.
Object.defineProperty(HTMLIFrameElement.prototype, 'src', {
  configurable: true,
  get() {
    return this.getAttribute('src') ?? '';
  },
  set(value: string) {
    this.setAttribute('src', value);
  },
});

// Mock localStorage
const localStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
};
Object.defineProperty(window, 'localStorage', { value: localStorageMock });

// Mock i18next
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: {
      changeLanguage: vi.fn(),
      language: 'fr',
    },
  }),
  Trans: ({ children }: { children: React.ReactNode }) => children,
  initReactI18next: {
    type: '3rdParty',
    init: vi.fn(),
  },
}));

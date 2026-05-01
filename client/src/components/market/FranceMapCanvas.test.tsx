import { render, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Map as MaplibreMap } from 'maplibre-gl';

import FranceMapCanvas from './FranceMapCanvas';
import { MAP_STYLES } from './franceMap.types';

const { mapConstructorMock, navigationControlConstructorMock, setWorkerUrlMock, mockMaps } = vi.hoisted(() => ({
  mapConstructorMock: vi.fn(),
  navigationControlConstructorMock: vi.fn(),
  setWorkerUrlMock: vi.fn(),
  mockMaps: [] as Array<{
    setStyle: ReturnType<typeof vi.fn>;
    remove: ReturnType<typeof vi.fn>;
  }>,
}));

vi.mock('maplibre-gl/dist/maplibre-gl-csp', () => ({
  default: {
    setWorkerUrl: setWorkerUrlMock,
    Map: class MockMap {
      handlers: Record<string, (() => void) | undefined> = {};
      oneTimeHandlers: Record<string, (() => void) | undefined> = {};
      addControl = vi.fn();
      on = vi.fn((event: string, callback: () => void) => {
        this.handlers[event] = callback;
      });
      off = vi.fn((event: string, callback: () => void) => {
        if (this.handlers[event] === callback) {
          delete this.handlers[event];
        }
      });
      once = vi.fn((event: string, callback: () => void) => {
        this.oneTimeHandlers[event] = callback;
      });
      setStyle = vi.fn((style: string) => {
        queueMicrotask(() => {
          this.oneTimeHandlers.styledata?.();
          delete this.oneTimeHandlers.styledata;
        });
        return style;
      });
      remove = vi.fn();

      constructor(options: unknown) {
        mapConstructorMock(options);
        mockMaps.push(this);
        queueMicrotask(() => {
          this.handlers.load?.();
        });
      }
    },
  },
  setWorkerUrl: setWorkerUrlMock,
  Marker: class MockMarker {
    setLngLat = vi.fn(() => this);
    addTo = vi.fn(() => this);
    remove = vi.fn();
  },
  Popup: class MockPopup {
    remove = vi.fn();
    setLngLat = vi.fn(() => this);
    setDOMContent = vi.fn(() => this);
    addTo = vi.fn(() => this);
  },
  NavigationControl: class MockNavigationControl {
    constructor(options: unknown) {
      navigationControlConstructorMock(options);
    }
  },
}));

vi.mock('maplibre-gl/dist/maplibre-gl-csp-worker.js?url', () => ({
  default: '/assets/maplibre-gl-csp-worker-test.js',
}));

vi.mock('maplibre-gl/dist/maplibre-gl.css?inline', () => ({
  default: '.maplibre-test-style {}',
}));

vi.mock('maplibre-gl/dist/maplibre-gl.css&inline', () => ({
  default: '.maplibre-test-style {}',
}));

describe('FranceMapCanvas', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockMaps.length = 0;
    document.getElementById('maplibre-gl-runtime-styles')?.remove();
  });

  it('does not recreate the MapLibre instance when readiness state or theme changes', async () => {
    const mapRef = { current: null as MaplibreMap | null };
    const onMapLoad = vi.fn();
    const props = {
      mapRef,
      isDarkMode: false,
      dataSource: 'offres' as const,
      selectedMetier: null,
      selectedRegion: null,
      hoveredRegion: null,
      currentRegionData: [],
      multiTypeRegionData: [],
      onMapLoad,
      onHoveredRegionChange: vi.fn(),
      onRegionSelect: vi.fn(),
      onDataSourceChange: vi.fn(),
      getBubbleSize: vi.fn(() => 24),
      getRegionColor: vi.fn(() => '#2563eb'),
      formatValue: vi.fn((value) => String(value ?? '')),
      getValueLabel: vi.fn(() => 'Value'),
    };

    const { rerender, unmount } = render(<FranceMapCanvas {...props} />);

    await waitFor(() => {
      expect(mapConstructorMock).toHaveBeenCalledTimes(1);
      expect(onMapLoad).toHaveBeenCalledTimes(1);
    });

    expect(setWorkerUrlMock).toHaveBeenCalledWith('/assets/maplibre-gl-csp-worker-test.js');

    rerender(<FranceMapCanvas {...props} isDarkMode />);

    await waitFor(() => {
      expect(mockMaps[0]?.setStyle).toHaveBeenCalledWith(MAP_STYLES.dark);
    });

    expect(mapConstructorMock).toHaveBeenCalledTimes(1);
    expect(navigationControlConstructorMock).toHaveBeenCalledTimes(1);

    unmount();

    expect(mockMaps[0]?.remove).toHaveBeenCalledTimes(1);
  });
});

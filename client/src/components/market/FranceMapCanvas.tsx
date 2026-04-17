/**
 * FranceMapCanvas - isolated MapLibre rendering for the France map tab
 */

import { useEffect, useRef, useState } from 'react';
import { Marker, Popup, type NavigationControl, type Map as MaplibreMap } from 'maplibre-gl';

import {
  MAP_STYLES,
  type DataSourceType,
  type RegionData,
  type TrendRegionData,
  type MultiTypeRegionData,
} from './franceMap.types';

interface FranceMapCanvasProps {
  mapRef: React.MutableRefObject<MaplibreMap | null>;
  isDarkMode: boolean;
  dataSource: DataSourceType;
  selectedMetier: string | null;
  selectedRegion: RegionData | TrendRegionData | null;
  hoveredRegion: string | null;
  currentRegionData: Array<RegionData | TrendRegionData>;
  multiTypeRegionData: MultiTypeRegionData[];
  onMapLoad: () => void;
  onHoveredRegionChange: (regionCode: string | null) => void;
  onRegionSelect: (region: RegionData | TrendRegionData | null) => void;
  onDataSourceChange: (nextDataSource: DataSourceType) => void;
  getBubbleSize: (value: number) => number;
  getRegionColor: (value: number) => string;
  formatValue: (value: number | string | undefined | null) => string;
  getValueLabel: () => string;
}

const MAPLIBRE_STYLE_ID = 'maplibre-gl-runtime-styles';

function createMarkerElement({
  size,
  backgroundColor,
  fontSize,
  text,
  title,
  hoverScaleClassName,
  extraInnerClassName = '',
}: {
  size: number;
  backgroundColor: string;
  fontSize: string;
  text: string;
  title: string;
  hoverScaleClassName: string;
  extraInnerClassName?: string;
}) {
  const wrapper = document.createElement('div');
  wrapper.style.width = `${size}px`;
  wrapper.style.height = `${size}px`;
  wrapper.style.display = 'flex';
  wrapper.style.alignItems = 'center';
  wrapper.style.justifyContent = 'center';

  const button = document.createElement('button');
  button.type = 'button';
  button.className = [
    'flex h-full w-full items-center justify-center rounded-full text-white font-bold shadow-lg',
    'transition-transform duration-200 focus:outline-none',
    'transform-gpu origin-center',
    hoverScaleClassName,
    extraInnerClassName,
  ].join(' ').trim();
  button.style.backgroundColor = backgroundColor;
  button.style.fontSize = fontSize;
  button.title = title;
  button.textContent = text;

  wrapper.appendChild(button);

  return { wrapper, button };
}

export default function FranceMapCanvas({
  mapRef,
  isDarkMode,
  dataSource,
  selectedMetier: _selectedMetier,
  selectedRegion,
  hoveredRegion,
  currentRegionData,
  multiTypeRegionData,
  onMapLoad,
  onHoveredRegionChange,
  onRegionSelect,
  onDataSourceChange,
  getBubbleSize,
  getRegionColor,
  formatValue,
  getValueLabel,
}: FranceMapCanvasProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const markersRef = useRef<Marker[]>([]);
  const regionButtonsRef = useRef<Map<string, HTMLButtonElement>>(new Map());
  const selectedRegionCodeRef = useRef<string | null>(null);
  const popupRef = useRef<Popup | null>(null);
  const navControlRef = useRef<NavigationControl | null>(null);
  const appliedStyleRef = useRef<string | null>(null);
  const initialStyleRef = useRef(isDarkMode ? MAP_STYLES.dark : MAP_STYLES.light);
  const [mapReady, setMapReady] = useState(false);

  useEffect(() => {
    selectedRegionCodeRef.current = selectedRegion?.code ?? null;
  }, [selectedRegion]);

  useEffect(() => {
    let cancelled = false;

    const ensureMaplibreCss = async () => {
      if (typeof document === 'undefined' || document.getElementById(MAPLIBRE_STYLE_ID)) {
        return;
      }

      const { default: maplibreCss } = await import('maplibre-gl/dist/maplibre-gl.css?inline');
      if (cancelled || document.getElementById(MAPLIBRE_STYLE_ID)) {
        return;
      }

      const styleElement = document.createElement('style');
      styleElement.id = MAPLIBRE_STYLE_ID;
      styleElement.textContent = maplibreCss;
      document.head.appendChild(styleElement);
    };

    void ensureMaplibreCss();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) {
      return undefined;
    }

    let cancelled = false;
    let mountedMap: MaplibreMap | null = null;
    const regionButtons = regionButtonsRef.current;
    const initializeMap = async () => {
      const { default: maplibregl, NavigationControl } = await import('maplibre-gl');

      if (cancelled || !containerRef.current || mapRef.current) {
        return;
      }

      const initialStyle = initialStyleRef.current;
      const map = new maplibregl.Map({
        container: containerRef.current,
        style: initialStyle,
        center: [2.5, 46.5],
        zoom: 5,
        attributionControl: false,
      });

      const navigationControl = new NavigationControl({ showCompass: false });
      navControlRef.current = navigationControl;
      map.addControl(navigationControl, 'top-right');
      map.on('load', onMapLoad);
      appliedStyleRef.current = initialStyle;
      mapRef.current = map;
      mountedMap = map;
      setMapReady(true);
    };

    void initializeMap();

    return () => {
      cancelled = true;
      popupRef.current?.remove();
      popupRef.current = null;
      markersRef.current.forEach((marker) => marker.remove());
      markersRef.current = [];
      regionButtons.clear();
      navControlRef.current = null;
      appliedStyleRef.current = null;
      mountedMap?.off('load', onMapLoad);
      mountedMap?.remove();
      if (mapRef.current === mountedMap) {
        mapRef.current = null;
      }
      setMapReady(false);
    };
  }, [mapRef, onMapLoad]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) {
      return;
    }

    const nextStyle = isDarkMode ? MAP_STYLES.dark : MAP_STYLES.light;
    if (appliedStyleRef.current === nextStyle) {
      return;
    }

    map.setStyle(nextStyle);
    appliedStyleRef.current = nextStyle;
    map.once('styledata', onMapLoad);
  }, [isDarkMode, mapReady, mapRef, onMapLoad]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) {
      return;
    }

    markersRef.current.forEach((marker) => marker.remove());
    markersRef.current = [];
    regionButtonsRef.current.clear();
    popupRef.current?.remove();
    popupRef.current = null;

    if (dataSource === 'all') {
      multiTypeRegionData.forEach((region) => {
        const bubbleCount = region.typeData.length;
        const radius = 0.4;

        region.typeData.forEach((typeInfo, index) => {
          const angle = (2 * Math.PI * index) / bubbleCount - Math.PI / 2;
          const offsetLng = bubbleCount > 1 ? Math.cos(angle) * radius : 0;
          const offsetLat = bubbleCount > 1 ? Math.sin(angle) * radius * 0.7 : 0;
          const size = 28;
          const colorHues = { indigo: 220, red: 0, blue: 210, teal: 175, purple: 270, violet: 280, gray: 220 };
          const hue = colorHues[typeInfo.color as keyof typeof colorHues] || 220;
          const valueLabel = typeInfo.type === 'offres'
            ? (Number.isNaN(typeInfo.value)
              ? '0'
              : typeInfo.value > 999
                ? Math.round(typeInfo.value / 1000) + 'k'
                : String(Math.round(typeInfo.value)))
            : (Number.isNaN(typeInfo.value) ? '0' : typeInfo.value.toFixed(1));

          const { wrapper, button } = createMarkerElement({
            size,
            backgroundColor: 'hsl(' + hue + ', 70%, 50%)',
            fontSize: '9px',
            text: valueLabel,
            title: region.regionName + ' - ' + typeInfo.label + ': ' + (typeInfo.type === 'offres'
            ? (Number.isNaN(typeInfo.value) ? '0' : typeInfo.value.toLocaleString())
            : (Number.isNaN(typeInfo.value) ? '0' : typeInfo.value.toFixed(1))),
            hoverScaleClassName: 'hover:scale-125',
            extraInnerClassName: 'border-2 border-white',
          });
          button.addEventListener('click', () => onDataSourceChange(typeInfo.type));
          button.addEventListener('mouseenter', () => onHoveredRegionChange(region.regionCode));
          button.addEventListener('mouseleave', () => onHoveredRegionChange(null));

          const marker = new Marker({ element: wrapper, anchor: 'center' })
            .setLngLat([region.coords[0] + offsetLng, region.coords[1] + offsetLat])
            .addTo(map);

          markersRef.current.push(marker);
        });
      });
      return;
    }

    currentRegionData.forEach((region) => {
      const size = getBubbleSize(region.value);
      const { wrapper, button } = createMarkerElement({
        size,
        backgroundColor: getRegionColor(region.value),
        fontSize: size > 40 ? '12px' : '10px',
        text: formatValue(region.value),
        title: region.name + ': ' + formatValue(region.value) + ' ' + getValueLabel(),
        hoverScaleClassName: 'hover:scale-110',
        extraInnerClassName: '',
      });
      button.addEventListener('click', () => onRegionSelect(selectedRegionCodeRef.current === region.code ? null : region));
      button.addEventListener('mouseenter', () => onHoveredRegionChange(region.code));
      button.addEventListener('mouseleave', () => onHoveredRegionChange(null));

      const marker = new Marker({ element: wrapper, anchor: 'center' })
        .setLngLat(region.coords)
        .addTo(map);

      markersRef.current.push(marker);
      regionButtonsRef.current.set(region.code, button);
    });
  }, [
    currentRegionData,
    dataSource,
    formatValue,
    getBubbleSize,
    getRegionColor,
    getValueLabel,
    mapReady,
    mapRef,
    multiTypeRegionData,
    onDataSourceChange,
    onHoveredRegionChange,
    onRegionSelect,
  ]);

  useEffect(() => {
    regionButtonsRef.current.forEach((button, regionCode) => {
      const isSelected = selectedRegion?.code === regionCode;
      button.classList.toggle('ring-4', isSelected);
      button.classList.toggle('ring-indigo-500', isSelected);
    });
  }, [selectedRegion]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) {
      return;
    }

    popupRef.current?.remove();
    popupRef.current = null;

    if (!hoveredRegion || selectedRegion) {
      return;
    }

    const hoveredData = currentRegionData.find((region) => region.code === hoveredRegion);
    if (!hoveredData) {
      return;
    }

    const container = document.createElement('div');
    container.className = 'p-1';

    const title = document.createElement('div');
    title.className = 'font-semibold text-gray-900';
    title.textContent = hoveredData.name;

    const value = document.createElement('div');
    value.className = 'text-indigo-600 font-bold';
    value.textContent = formatValue(hoveredData.value) + ' ' + getValueLabel();

    container.appendChild(title);
    container.appendChild(value);

    popupRef.current = new Popup({ closeButton: false, closeOnClick: false, anchor: 'bottom', offset: 20 })
      .setLngLat(hoveredData.coords)
      .setDOMContent(container)
      .addTo(map);
  }, [currentRegionData, formatValue, getValueLabel, hoveredRegion, mapReady, mapRef, selectedRegion]);

  return <div ref={containerRef} style={{ width: '100%', height: '500px' }} />;
}

/**
 * FranceMapCanvas - isolated MapLibre rendering for the France map tab
 */

import { useEffect, useRef } from 'react';
import maplibregl, { Marker, NavigationControl, Popup, type Map as MaplibreMap } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';

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

export default function FranceMapCanvas({
  mapRef,
  isDarkMode,
  dataSource,
  selectedMetier,
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
  const popupRef = useRef<Popup | null>(null);
  const navControlRef = useRef<NavigationControl | null>(null);
  const appliedStyleRef = useRef<string | null>(null);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) {
      return undefined;
    }

    const initialStyle = isDarkMode ? MAP_STYLES.dark : MAP_STYLES.light;
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

    return () => {
      popupRef.current?.remove();
      popupRef.current = null;
      markersRef.current.forEach((marker) => marker.remove());
      markersRef.current = [];
      navControlRef.current = null;
      appliedStyleRef.current = null;
      mapRef.current = null;
      map.remove();
    };
  }, [isDarkMode, mapRef, onMapLoad]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) {
      return;
    }

    const nextStyle = isDarkMode ? MAP_STYLES.dark : MAP_STYLES.light;
    if (appliedStyleRef.current === nextStyle) {
      return;
    }

    map.setStyle(nextStyle);
    appliedStyleRef.current = nextStyle;
    map.once('styledata', onMapLoad);
  }, [isDarkMode, mapRef, onMapLoad]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) {
      return;
    }

    markersRef.current.forEach((marker) => marker.remove());
    markersRef.current = [];
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

          const button = document.createElement('button');
          button.type = 'button';
          button.className = 'rounded-full flex items-center justify-center text-white font-bold shadow-lg transition-all duration-200 hover:scale-125 focus:outline-none border-2 border-white';
          button.style.width = size + 'px';
          button.style.height = size + 'px';
          button.style.backgroundColor = 'hsl(' + hue + ', 70%, 50%)';
          button.style.fontSize = '9px';
          button.title = region.regionName + ' - ' + typeInfo.label + ': ' + (typeInfo.type === 'offres'
            ? (Number.isNaN(typeInfo.value) ? '0' : typeInfo.value.toLocaleString())
            : (Number.isNaN(typeInfo.value) ? '0' : typeInfo.value.toFixed(1)));
          button.textContent = valueLabel;
          button.addEventListener('click', () => onDataSourceChange(typeInfo.type));
          button.addEventListener('mouseenter', () => onHoveredRegionChange(region.regionCode));
          button.addEventListener('mouseleave', () => onHoveredRegionChange(null));

          const marker = new Marker({ element: button, anchor: 'center' })
            .setLngLat([region.coords[0] + offsetLng, region.coords[1] + offsetLat])
            .addTo(map);

          markersRef.current.push(marker);
        });
      });
      return;
    }

    currentRegionData.forEach((region) => {
      const isSelected = selectedRegion?.code === region.code;
      const size = getBubbleSize(region.value);
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'rounded-full flex items-center justify-center text-white font-bold shadow-lg transition-all duration-200 hover:scale-110 focus:outline-none' + (isSelected ? ' ring-4 ring-indigo-500' : '');
      button.style.width = size + 'px';
      button.style.height = size + 'px';
      button.style.backgroundColor = getRegionColor(region.value);
      button.style.fontSize = size > 40 ? '12px' : '10px';
      button.title = region.name + ': ' + formatValue(region.value) + ' ' + getValueLabel();
      button.textContent = formatValue(region.value);
      button.addEventListener('click', () => onRegionSelect(isSelected ? null : region));
      button.addEventListener('mouseenter', () => onHoveredRegionChange(region.code));
      button.addEventListener('mouseleave', () => onHoveredRegionChange(null));

      const marker = new Marker({ element: button, anchor: 'center' })
        .setLngLat(region.coords)
        .addTo(map);

      markersRef.current.push(marker);
    });
  }, [
    currentRegionData,
    dataSource,
    formatValue,
    getBubbleSize,
    getRegionColor,
    getValueLabel,
    hoveredRegion,
    mapRef,
    multiTypeRegionData,
    onDataSourceChange,
    onHoveredRegionChange,
    onRegionSelect,
    selectedMetier,
    selectedRegion,
  ]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) {
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
  }, [currentRegionData, formatValue, getValueLabel, hoveredRegion, mapRef, selectedRegion]);

  return <div ref={containerRef} style={{ width: '100%', height: '500px' }} />;
}

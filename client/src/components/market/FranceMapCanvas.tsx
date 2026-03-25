/**
 * FranceMapCanvas - isolated MapLibre rendering for the France map tab
 */

import type { RefObject } from 'react';
import Map, { Marker, NavigationControl, Popup, type MapRef } from 'react-map-gl/maplibre';
import 'maplibre-gl/dist/maplibre-gl.css';

import {
  DATA_SOURCE_OPTIONS,
  MAP_STYLES,
  type DataSourceType,
  type RegionData,
  type TrendRegionData,
  type MultiTypeRegionData,
} from './franceMap.types';

interface FranceMapCanvasProps {
  mapRef: RefObject<MapRef | null>;
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
  return (
    <Map
      ref={mapRef}
      initialViewState={{ longitude: 2.5, latitude: 46.5, zoom: 5 }}
      style={{ width: '100%', height: '500px' }}
      mapStyle={isDarkMode ? MAP_STYLES.dark : MAP_STYLES.light}
      attributionControl={false}
      onLoad={onMapLoad}
    >
      <NavigationControl position="top-right" />

      {dataSource === 'all'
        ? multiTypeRegionData.flatMap((region) => {
            const bubbleCount = region.typeData.length;
            const radius = 0.4;
            return region.typeData.map((typeInfo, index) => {
              const angle = (2 * Math.PI * index) / bubbleCount - Math.PI / 2;
              const offsetLng = bubbleCount > 1 ? Math.cos(angle) * radius : 0;
              const offsetLat = bubbleCount > 1 ? Math.sin(angle) * radius * 0.7 : 0;
              const size = 28;
              const colorHues: Record<string, number> = { indigo: 220, red: 0, blue: 210, teal: 175, purple: 270, violet: 280, gray: 220 };
              const hue = colorHues[typeInfo.color] || 220;
              return (
                <Marker
                  key={`${region.regionCode}-${typeInfo.type}`}
                  longitude={region.coords[0] + offsetLng}
                  latitude={region.coords[1] + offsetLat}
                  anchor="center"
                >
                  <button
                    onClick={() => onDataSourceChange(typeInfo.type)}
                    onMouseEnter={() => onHoveredRegionChange(region.regionCode)}
                    onMouseLeave={() => onHoveredRegionChange(null)}
                    className="rounded-full flex items-center justify-center text-white font-bold shadow-lg transition-all duration-200 hover:scale-125 focus:outline-none border-2 border-white"
                    style={{ width: `${size}px`, height: `${size}px`, backgroundColor: `hsl(${hue}, 70%, 50%)`, fontSize: '9px' }}
                    title={`${region.regionName} - ${typeInfo.label}: ${typeInfo.type === 'offres' ? (Number.isNaN(typeInfo.value) ? '0' : typeInfo.value.toLocaleString()) : (Number.isNaN(typeInfo.value) ? '0' : typeInfo.value.toFixed(1))}`}
                  >
                    {typeInfo.type === 'offres'
                      ? Number.isNaN(typeInfo.value)
                        ? '0'
                        : typeInfo.value > 999
                          ? `${Math.round(typeInfo.value / 1000)}k`
                          : Math.round(typeInfo.value)
                      : Number.isNaN(typeInfo.value)
                        ? '0'
                        : typeInfo.value.toFixed(1)}
                  </button>
                </Marker>
              );
            });
          })
        : currentRegionData.map((region) => {
            const isSelected = selectedRegion?.code === region.code;
            const size = getBubbleSize(region.value);
            return (
              <Marker key={`${region.code}-${selectedMetier || 'all'}`} longitude={region.coords[0]} latitude={region.coords[1]} anchor="center">
                <button
                  onClick={() => onRegionSelect(isSelected ? null : region)}
                  onMouseEnter={() => onHoveredRegionChange(region.code)}
                  onMouseLeave={() => onHoveredRegionChange(null)}
                  className={`rounded-full flex items-center justify-center text-white font-bold shadow-lg transition-all duration-200 hover:scale-110 focus:outline-none ${isSelected ? 'ring-4 ring-indigo-500' : ''}`}
                  style={{ width: `${size}px`, height: `${size}px`, backgroundColor: getRegionColor(region.value), fontSize: size > 40 ? '12px' : '10px' }}
                  title={`${region.name}: ${formatValue(region.value)} ${getValueLabel()}`}
                >
                  {formatValue(region.value)}
                </button>
              </Marker>
            );
          })}

      {hoveredRegion && !selectedRegion && (() => {
        const hoveredData = currentRegionData.find((region) => region.code === hoveredRegion);
        if (!hoveredData) return null;
        return (
          <Popup longitude={hoveredData.coords[0]} latitude={hoveredData.coords[1]} closeButton={false} closeOnClick={false} anchor="bottom" offset={20}>
            <div className="p-1">
              <div className="font-semibold text-gray-900">{hoveredData.name}</div>
              <div className="text-indigo-600 font-bold">{formatValue(hoveredData.value)} {getValueLabel()}</div>
            </div>
          </Popup>
        );
      })()}
    </Map>
  );
}

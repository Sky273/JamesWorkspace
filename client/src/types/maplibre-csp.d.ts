declare module 'maplibre-gl/dist/maplibre-gl-csp' {
  export * from 'maplibre-gl';
  import maplibregl from 'maplibre-gl';
  export default maplibregl;
}

declare module 'maplibre-gl/dist/maplibre-gl-csp-worker.js?url' {
  const workerUrl: string;
  export default workerUrl;
}

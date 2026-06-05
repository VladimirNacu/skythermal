import { useEffect, useRef } from "react";
import maplibregl, { Map as MlMap, Marker, Popup } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { resolveStyle } from "./mapStyle";
import { WindParticleLayer } from "./WindParticleLayer";
import { useMapStore } from "@/state/mapState";
import { useSites } from "@/api/hooks";
import { Crosshair, Layers, Maximize, Mountain, Navigation, Plus, Minus } from "lucide-react";
import type { LaunchSite } from "@/api/types";

function dirToDeg(label: string): number {
  const map: Record<string, number> = {
    N: 0, NE: 45, E: 90, SE: 135, S: 180, SW: 225, W: 270, NW: 315,
  };
  return map[label] ?? 0;
}

function buildMarkerEl(site: LaunchSite, onClick: () => void): HTMLElement {
  const wrap = document.createElement("div");
  wrap.className = "st-marker";
  wrap.innerHTML = `
    <div class="st-marker-pin">
      <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
        <path d="M21 16v-2l-8-5V3.5A1.5 1.5 0 0 0 11.5 2A1.5 1.5 0 0 0 10 3.5V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1l3.5 1v-1.5L13 19v-5.5l8 2.5z"/>
      </svg>
    </div>
    <div class="st-marker-label">${site.name}</div>`;
  wrap.addEventListener("click", (e) => {
    e.stopPropagation();
    onClick();
  });
  return wrap;
}

export function MapShell() {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MlMap | null>(null);
  const particleRef = useRef<WindParticleLayer | null>(null);
  const markersRef = useRef<Marker[]>([]);

  const { data: sites } = useSites();
  const selectSite = useMapStore((s) => s.selectSite);
  const setPoint = useMapStore((s) => s.set);
  const view = useMapStore((s) => s.map);
  const overlay = useMapStore((s) => s.overlay);
  const particlesEnabled = useMapStore((s) => s.particlesEnabled);
  const airspaceEnabled = useMapStore((s) => s.airspaceEnabled);

  // init map once
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: resolveStyle(),
      center: view.center,
      zoom: view.zoom,
      bearing: view.bearing,
      pitch: view.pitch,
      attributionControl: { compact: true },
    });
    mapRef.current = map;

    map.on("load", () => {
      const layer = new WindParticleLayer("wind-particles", 6000, 0.92);
      particleRef.current = layer;
      map.addLayer(layer);
    });

    // click picker
    map.on("click", (e) => {
      setPoint({ selectedPoint: { lat: e.lngLat.lat, lon: e.lngLat.lng } });
      new Popup({ closeButton: true, className: "st-picker-popup" })
        .setLngLat(e.lngLat)
        .setHTML(
          `<div class="st-picker">
            <div class="st-picker-coords">${e.lngLat.lat.toFixed(3)}, ${e.lngLat.lng.toFixed(3)}</div>
            <div class="st-picker-hint">Point forecast &amp; nearest launch — coming with /v1/picker</div>
          </div>`,
        )
        .addTo(map);
    });

    // persist view on move
    map.on("moveend", () => {
      const c = map.getCenter();
      setPoint({
        map: {
          center: [c.lng, c.lat],
          zoom: map.getZoom(),
          bearing: map.getBearing(),
          pitch: map.getPitch(),
        },
      });
    });

    return () => {
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // (re)build markers when sites load
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !sites) return;
    markersRef.current.forEach((m) => m.remove());
    markersRef.current = sites.map((site) => {
      const el = buildMarkerEl(site, () => {
        selectSite(site.id);
        map.flyTo({ center: [site.lon, site.lat], zoom: Math.max(map.getZoom(), 9), speed: 0.8 });
      });
      return new maplibregl.Marker({ element: el, anchor: "bottom" })
        .setLngLat([site.lon, site.lat])
        .addTo(map);
    });
  }, [sites, selectSite]);

  // align particle field to dominant safe direction of first site
  useEffect(() => {
    if (sites?.length && particleRef.current) {
      const dir = sites[0].safe_directions[0];
      particleRef.current.fieldBearingDeg = dirToDeg(dir);
    }
  }, [sites]);

  // toggle particles
  useEffect(() => {
    if (particleRef.current) {
      particleRef.current.enabled = particlesEnabled;
      mapRef.current?.triggerRepaint();
    }
  }, [particlesEnabled, overlay]);

  function zoom(delta: number) {
    const map = mapRef.current;
    if (map) map.easeTo({ zoom: map.getZoom() + delta });
  }
  function resetNorth() {
    mapRef.current?.easeTo({ bearing: 0, pitch: 0 });
  }
  function locate() {
    navigator.geolocation?.getCurrentPosition((pos) => {
      mapRef.current?.flyTo({
        center: [pos.coords.longitude, pos.coords.latitude],
        zoom: 10,
      });
    });
  }

  return (
    <div className="st-map-shell">
      <div ref={containerRef} className="st-map-canvas" />

      {airspaceEnabled && (
        <>
          <div className="st-airspace st-airspace-1">TMA OSLO<br />SFC–FL095</div>
          <div className="st-airspace st-airspace-2">CTR FAGERNES<br />SFC–3500ft</div>
        </>
      )}

      <div className="st-map-controls">
        <button title="Reset north" onClick={resetNorth}><Navigation size={17} /></button>
        <button title="Zoom in" onClick={() => zoom(1)}><Plus size={18} /></button>
        <button title="Zoom out" onClick={() => zoom(-1)}><Minus size={18} /></button>
        <button title="Locate me" onClick={locate}><Crosshair size={17} /></button>
        <button title="Layers"><Layers size={17} /></button>
        <button title="Terrain"><Mountain size={17} /></button>
        <button title="Fullscreen" onClick={() => document.documentElement.requestFullscreen?.()}>
          <Maximize size={16} />
        </button>
      </div>
    </div>
  );
}

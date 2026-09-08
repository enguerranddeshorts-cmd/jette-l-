import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { fetchBinsInBounds } from "./data.js";

// Fond de carte gratuit, sans compte ni clé d'API : OpenFreeMap (openfreemap.org),
// un projet de tuiles vectorielles libres compatible MapLibre GL (fork open source
// de Mapbox GL). Remplace l'ancienne intégration Mapbox GL qui exigeait un compte
// avec carte bancaire enregistrée dès l'inscription.
const MAP_STYLE = "https://tiles.openfreemap.org/styles/liberty";

const CAT_COLOR = { corbeille: "#8B5E3C", tri: "#178C53", collecte: "#6B5B8E" };

let map;
let onBinClick = () => {};
let onEmptyClick = () => {};
let onBinsUpdate = () => {};
let currentBins = [];
let fetchToken = 0;

function toGeoJSON(bins) {
  return {
    type: "FeatureCollection",
    features: bins.map((b) => ({
      type: "Feature",
      properties: { id: b.id, category: b.category, commune: b.commune },
      geometry: { type: "Point", coordinates: [b.lon, b.lat] },
    })),
  };
}

async function refreshVisibleBins() {
  if (!map) return;
  const b = map.getBounds();
  const bounds = { west: b.getWest(), south: b.getSouth(), east: b.getEast(), north: b.getNorth() };
  const token = ++fetchToken;
  const bins = await fetchBinsInBounds(bounds);
  if (token !== fetchToken) return; // une requête plus récente est déjà partie
  currentBins = bins;
  const source = map.getSource("bins");
  if (source) source.setData(toGeoJSON(bins));
  onBinsUpdate(bins);
}

let debounceTimer = null;
function scheduleRefresh() {
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(refreshVisibleBins, 250);
}

export function initMap(container, { center = [-0.5, 49.1], zoom = 8, handlers = {} } = {}) {
  onBinClick = handlers.onBinClick || onBinClick;
  onEmptyClick = handlers.onEmptyClick || onEmptyClick;
  onBinsUpdate = handlers.onBinsUpdate || onBinsUpdate;

  map = new maplibregl.Map({
    container,
    style: MAP_STYLE,
    center, zoom,
  });
  map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");
  map.addControl(new maplibregl.GeolocateControl({ positionOptions: { enableHighAccuracy: true }, trackUserLocation: true }), "top-right");

  map.on("load", () => {
    map.addSource("bins", {
      type: "geojson",
      data: toGeoJSON([]),
      cluster: true,
      clusterMaxZoom: 15,
      clusterRadius: 40,
    });

    map.addLayer({
      id: "clusters", type: "circle", source: "bins", filter: ["has", "point_count"],
      paint: {
        "circle-color": "#178C53",
        "circle-radius": ["step", ["get", "point_count"], 16, 25, 22, 100, 28, 750, 34],
        "circle-opacity": 0.85,
      },
    });
    map.addLayer({
      id: "cluster-count", type: "symbol", source: "bins", filter: ["has", "point_count"],
      layout: { "text-field": ["get", "point_count_abbreviated"], "text-size": 12, "text-font": ["Noto Sans Bold"] },
      paint: { "text-color": "#ffffff" },
    });
    map.addLayer({
      id: "unclustered-point", type: "circle", source: "bins", filter: ["!", ["has", "point_count"]],
      paint: {
        "circle-radius": 7,
        "circle-color": [
          "match", ["get", "category"],
          "corbeille", CAT_COLOR.corbeille,
          "tri", CAT_COLOR.tri,
          "collecte", CAT_COLOR.collecte,
          "#999999",
        ],
        "circle-stroke-width": 1.5,
        "circle-stroke-color": "#ffffff",
      },
    });

    refreshVisibleBins();
    map.on("moveend", scheduleRefresh);

    map.on("click", "clusters", (e) => {
      const features = map.queryRenderedFeatures(e.point, { layers: ["clusters"] });
      const clusterId = features[0].properties.cluster_id;
      map.getSource("bins").getClusterExpansionZoom(clusterId, (err, zoom) => {
        if (err) return;
        map.easeTo({ center: features[0].geometry.coordinates, zoom });
      });
    });
    map.on("click", "unclustered-point", (e) => {
      const id = e.features[0].properties.id;
      onBinClick(id);
    });
    map.on("click", (e) => {
      const hits = map.queryRenderedFeatures(e.point, { layers: ["clusters", "unclustered-point"] });
      if (hits.length) return; // déjà géré par les handlers dédiés ci-dessus
      onEmptyClick(e.lngLat.lat, e.lngLat.lng);
    });
    map.on("mouseenter", "clusters", () => { map.getCanvas().style.cursor = "pointer"; });
    map.on("mouseleave", "clusters", () => { map.getCanvas().style.cursor = ""; });
    map.on("mouseenter", "unclustered-point", () => { map.getCanvas().style.cursor = "pointer"; });
    map.on("mouseleave", "unclustered-point", () => { map.getCanvas().style.cursor = ""; });
  });

  return map;
}

export function flyTo(lat, lon, zoom = 14) {
  if (map) map.flyTo({ center: [lon, lat], zoom });
}

export function refreshBinsNow() { return refreshVisibleBins(); }

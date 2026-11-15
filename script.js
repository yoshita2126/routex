"use strict";

// Keep provider endpoints and route preferences together so providers can be replaced independently.
const SERVICES = Object.freeze({
  geocoding: {
    baseUrl: "https://nominatim.openstreetmap.org/search",
    reverseUrl: "https://nominatim.openstreetmap.org/reverse",
    countryCodes: "",
  },
  routing: {
    baseUrl: "https://router.project-osrm.org/route/v1/driving",
    profile: "driving",
    alternatives: false,
  },
  map: {
    tileUrl: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    initialCenter: [20, 0],
    initialZoom: 2,
    maxZoom: 19,
  },
});

const elements = {
  form: document.querySelector("#route-form"),
  start: document.querySelector("#start-input"),
  destination: document.querySelector("#destination-input"),
  pinStart: document.querySelector('[data-endpoint="start"]'),
  pinDestination: document.querySelector('[data-endpoint="destination"]'),
  find: document.querySelector("#find-button"),
  mode: document.querySelector("#travel-mode"),
  location: document.querySelector("#location-button"),
  clear: document.querySelector("#clear-button"),
  feedback: document.querySelector("#feedback"),
  routeCard: document.querySelector("#route-card"),
  distance: document.querySelector("#distance-value"),
  duration: document.querySelector("#duration-value"),
  vehicle: document.querySelector("#vehicle-value"),
  startName: document.querySelector("#start-name"),
  destinationName: document.querySelector("#destination-name"),
  routeMeta: document.querySelector("#route-meta"),
  mapCaption: document.querySelector("#map-caption"),
};

const map = L.map("map", { zoomControl: false }).setView(SERVICES.map.initialCenter, SERVICES.map.initialZoom);
L.tileLayer(SERVICES.map.tileUrl, {
  attribution: SERVICES.map.attribution,
  maxZoom: SERVICES.map.maxZoom,
  crossOrigin: true,
}).addTo(map);
L.control.zoom({ position: "bottomright" }).addTo(map);

let routeLayer = null;
let endpointMarkers = [];
let cachedStart = null;
let activeMapPinTarget = null;
let mapPinMarker = null;
let startFromLiveLocation = false;

function setFeedback(message, kind = "error") {
  elements.feedback.textContent = message;
  elements.feedback.dataset.kind = kind;
  elements.feedback.hidden = !message;
}

function setLoading(isLoading) {
  elements.find.disabled = isLoading;
  elements.find.classList.toggle("is-loading", isLoading);
  elements.find.querySelector(".button-label").textContent = isLoading ? "Finding route..." : "Find Route";
}

// Resolve a human-readable place with Nominatim; only called after form submission or geolocation.
async function geocode(query) {
  const params = new URLSearchParams({ q: query, format: "jsonv2", limit: "1", addressdetails: "1" });
  if (SERVICES.geocoding.countryCodes) params.set("countrycodes", SERVICES.geocoding.countryCodes);
  const response = await fetch(`${SERVICES.geocoding.baseUrl}?${params}`, { headers: { Accept: "application/json" } });
  if (!response.ok) throw new Error("network");
  const results = await response.json();
  if (!results.length) throw new Error("not-found");
  return { lat: Number(results[0].lat), lon: Number(results[0].lon), name: results[0].display_name };
}

// Ask OSRM for a real driving route and its GeoJSON geometry, distance, and duration.
function getModeProfile(mode) {
  const profiles = {
    driving: "driving",
    cycling: "cycling",
    walking: "walking",
    bus: "driving",
  };
  return profiles[mode] || "driving";
}

function getModeLabel(mode) {
  const labels = {
    driving: "Car",
    cycling: "Bike",
    walking: "Walking",
    bus: "Bus",
  };
  return labels[mode] || "Car";
}

async function requestRoute(start, destination, mode = "driving") {
  const coordinates = `${start.lon},${start.lat};${destination.lon},${destination.lat}`;
  const profile = getModeProfile(mode);
  const params = new URLSearchParams({ overview: "full", geometries: "geojson", steps: "false", alternatives: String(SERVICES.routing.alternatives) });
  const response = await fetch(`${SERVICES.routing.baseUrl.replace("driving", profile)}/${coordinates}?${params}`, { headers: { Accept: "application/json" } });
  if (!response.ok) throw new Error("network");
  const data = await response.json();
  if (data.code !== "Ok" || !data.routes?.length) throw new Error("unavailable");
  return data.routes[0];
}

function makeMarkerIcon(kind) {
  const color = kind === "start" ? "#315e49" : "#df7953";
  return L.divIcon({
    className: "route-marker-icon",
    html: `<span class="map-marker"><svg viewBox="0 0 30 38" aria-hidden="true"><path d="M15 1.5C7.9 1.5 2.5 6.8 2.5 13.5c0 9 12.5 23 12.5 23s12.5-14 12.5-23C27.5 6.8 22.1 1.5 15 1.5Z" fill="${color}"/><circle cx="15" cy="13.5" r="5" fill="white"/><circle cx="15" cy="13.5" r="2.1" fill="${color}"/></svg></span>`,
    iconSize: [30, 38],
    iconAnchor: [15, 37],
  });
}

function formatDistance(meters) {
  const kilometers = meters / 1000;
  return kilometers >= 100 ? `${Math.round(kilometers)} km` : `${kilometers.toFixed(1)} km`;
}

function formatDuration(seconds) {
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${Math.max(1, minutes)} min`;
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return remainingMinutes ? `${hours} hr ${remainingMinutes} min` : `${hours} hr`;
}

// Replace the previous map result and fit both the route and its endpoint markers into view.
function renderRoute(start, destination, route, mode = "driving") {
  clearMapPinSelection();
  if (routeLayer) map.removeLayer(routeLayer);
  endpointMarkers.forEach((marker) => map.removeLayer(marker));
  routeLayer = L.geoJSON(route.geometry, {
    style: { color: "#315e49", weight: 5, opacity: 0.86, lineCap: "round", lineJoin: "round" },
  }).addTo(map);
  endpointMarkers = [
    L.marker([start.lat, start.lon], { icon: makeMarkerIcon("start"), title: "Starting location" }).addTo(map),
    L.marker([destination.lat, destination.lon], { icon: makeMarkerIcon("destination"), title: "Destination" }).addTo(map),
  ];
  const bounds = routeLayer.getBounds().extend([start.lat, start.lon]).extend([destination.lat, destination.lon]);
  map.fitBounds(bounds, { padding: [58, 58], maxZoom: 15 });
  const label = getModeLabel(mode);
  elements.distance.textContent = formatDistance(route.distance);
  elements.duration.textContent = formatDuration(route.duration);
  elements.vehicle.textContent = label;
  elements.startName.textContent = start.name;
  elements.destinationName.textContent = destination.name;
  elements.routeMeta.textContent = startFromLiveLocation ? "Live location start" : "Route from selected location";
  elements.mapCaption.textContent = `${formatDistance(route.distance)} route · ${formatDuration(route.duration)} · ${label}`;
  elements.routeCard.hidden = false;
}

function showFriendlyError(error) {
  const messages = {
    "not-found": "We couldn't find that place. Try adding a city or region to make it more specific.",
    unavailable: "A drivable route wasn't found between those places. Try nearby locations or another destination.",
    network: "We couldn't reach the map services just now. Check your connection and try again.",
  };
  setFeedback(messages[error.message] || "Something went wrong while planning your route. Please try again.");
}

async function reverseGeocode(lat, lon) {
  const params = new URLSearchParams({ lat: String(lat), lon: String(lon), format: "jsonv2" });
  const response = await fetch(`${SERVICES.geocoding.reverseUrl}?${params}`, { headers: { Accept: "application/json" } });
  if (!response.ok) throw new Error("network");
  const result = await response.json();
  if (!result.display_name) throw new Error("not-found");
  return { lat, lon, name: result.display_name };
}

function clearMapPinSelection() {
  activeMapPinTarget = null;
  elements.pinStart.classList.remove("is-active");
  elements.pinDestination.classList.remove("is-active");
  if (mapPinMarker) {
    map.removeLayer(mapPinMarker);
    mapPinMarker = null;
  }
}

function setMapPinTarget(target) {
  activeMapPinTarget = target;
  elements.pinStart.classList.toggle("is-active", target === "start");
  elements.pinDestination.classList.toggle("is-active", target === "destination");
  const label = target === "start" ? "starting point" : "destination";
  setFeedback(`Click the map to pin the ${label}.`, "success");
}

function setPinnedMapLocation(target, place) {
  const input = target === "start" ? elements.start : elements.destination;
  input.value = place.name;
  if (target === "start") {
    cachedStart = { query: place.name, place };
    startFromLiveLocation = false;
  }
  if (mapPinMarker) map.removeLayer(mapPinMarker);
  mapPinMarker = L.marker([place.lat, place.lon], {
    icon: makeMarkerIcon(target),
    title: target === "start" ? "Starting location" : "Destination",
  }).addTo(map);
  map.setView([place.lat, place.lon], Math.max(map.getZoom(), 12));
  activeMapPinTarget = null;
  elements.pinStart.classList.remove("is-active");
  elements.pinDestination.classList.remove("is-active");
}

map.on("click", async (event) => {
  if (!activeMapPinTarget) return;
  try {
    const place = await reverseGeocode(event.latlng.lat, event.latlng.lng);
    setPinnedMapLocation(activeMapPinTarget, place);
    setFeedback(`${activeMapPinTarget === "start" ? "Starting point" : "Destination"} pinned from the map.`, "success");
  } catch (error) {
    showFriendlyError(error);
  }
});

// Geocode both places, request the route, and update the map and summary as one user action.
async function findRoute(event) {
  event.preventDefault();
  const startQuery = elements.start.value.trim();
  const destinationQuery = elements.destination.value.trim();
  if (!startQuery || !destinationQuery) {
    setFeedback("Add both a starting location and a destination to find your route.");
    (startQuery ? elements.destination : elements.start).focus();
    return;
  }

  setFeedback("");
  setLoading(true);
  try {
    const mode = elements.mode.value;
    const start = cachedStart && cachedStart.query === startQuery ? cachedStart.place : await geocode(startQuery);
    const destination = await geocode(destinationQuery);
    const route = await requestRoute(start, destination, mode);
    renderRoute(start, destination, route, mode);
    setFeedback(`Your ${getModeLabel(mode).toLowerCase()} route is ready. Have a good journey.`, "success");
  } catch (error) {
    showFriendlyError(error);
  } finally {
    setLoading(false);
  }
}

// Use browser geolocation, then reverse-geocode the coordinates for a readable starting point.
async function useCurrentLocation() {
  if (!navigator.geolocation) {
    setFeedback("Location sharing isn't available in this browser. Enter your starting place instead.");
    return;
  }
  elements.location.disabled = true;
  elements.location.setAttribute("aria-busy", "true");
  setFeedback("Finding your current location...", "success");
  navigator.geolocation.getCurrentPosition(async ({ coords }) => {
    try {
      const place = await reverseGeocode(coords.latitude, coords.longitude);
      elements.start.value = place.name;
      cachedStart = { query: place.name, place };
      startFromLiveLocation = true;
      if (mapPinMarker) map.removeLayer(mapPinMarker);
      mapPinMarker = L.marker([place.lat, place.lon], {
        icon: makeMarkerIcon("start"),
        title: "Starting location",
      }).addTo(map);
      map.setView([place.lat, place.lon], Math.max(map.getZoom(), 12));
      setFeedback("Starting point set to your current location.", "success");
      elements.destination.focus();
    } catch (error) {
      showFriendlyError(error);
    } finally {
      elements.location.disabled = false;
      elements.location.removeAttribute("aria-busy");
    }
  }, (error) => {
    const message = error.code === error.PERMISSION_DENIED
      ? "Location permission was denied. Enter your starting place manually."
      : "We couldn't determine your location. Enter your starting place manually.";
    setFeedback(message);
    elements.location.disabled = false;
    elements.location.removeAttribute("aria-busy");
  }, { enableHighAccuracy: false, timeout: 12000, maximumAge: 60000 });
}

function clearPlanner() {
  elements.form.reset();
  cachedStart = null;
  startFromLiveLocation = false;
  elements.routeCard.hidden = true;
  setFeedback("");
  clearMapPinSelection();
  if (routeLayer) map.removeLayer(routeLayer);
  endpointMarkers.forEach((marker) => map.removeLayer(marker));
  routeLayer = null;
  endpointMarkers = [];
  elements.mapCaption.textContent = "Search a place to get started";
  map.setView(SERVICES.map.initialCenter, SERVICES.map.initialZoom);
  elements.start.focus();
}

elements.form.addEventListener("submit", findRoute);
elements.location.addEventListener("click", useCurrentLocation);
elements.clear.addEventListener("click", clearPlanner);
elements.pinStart.addEventListener("click", () => setMapPinTarget("start"));
elements.pinDestination.addEventListener("click", () => setMapPinTarget("destination"));
elements.start.addEventListener("input", () => {
  startFromLiveLocation = false;
  if (cachedStart && elements.start.value.trim() !== cachedStart.query) cachedStart = null;
});

window.addEventListener("load", () => map.invalidateSize());
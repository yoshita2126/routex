import React, { useState, useEffect, useRef } from 'react';
import L from 'leaflet';
import { useAuth } from '../context/AuthContext';

const SERVICES = Object.freeze({
  geocoding: {
    baseUrl: 'https://nominatim.openstreetmap.org/search',
    reverseUrl: 'https://nominatim.openstreetmap.org/reverse',
  },
  routing: {
    baseUrl: 'https://router.project-osrm.org/route/v1/driving',
  },
  map: {
    // Direct tile server without deprecated subdomains
    tileUrl: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
    fallbackTileUrl: 'https://basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a> contributors',
    initialCenter: [20, 0],
    initialZoom: 2,
    maxZoom: 19,
  },
});

export default function Planner({ setCurrentView, initialRouteToLoad }) {
  const { user, token, isAuthenticated, updateUserStats } = useAuth();

  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const routeLayerRef = useRef(null);
  const markersRef = useRef([]);
  const activePinRef = useRef(null);
  const mapPinMarkerRef = useRef(null);
  const tileLayersRef = useRef({});

  const [startQuery, setStartQuery] = useState('');
  const [destinationQuery, setDestinationQuery] = useState('');
  const [travelMode, setTravelMode] = useState('driving');
  const [isLoading, setIsLoading] = useState(false);
  const [feedback, setFeedback] = useState({ text: '', type: 'error' });
  const [activePinTarget, setActivePinTarget] = useState(null);
  const [currentRoute, setCurrentRoute] = useState(null);
  const [mapStyle, setMapStyle] = useState('streets'); // 'streets' | 'satellite' | 'hybrid'
  const [turnSteps, setTurnSteps] = useState([]);
  const [showSteps, setShowSteps] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [liveLocationStart, setLiveLocationStart] = useState(false);
  const [mapCaption, setMapCaption] = useState('Search a place to get started');

  // Keep ref synchronized with state
  useEffect(() => {
    activePinRef.current = activePinTarget;
  }, [activePinTarget]);

  // Marker icon builder
  const createMarkerIcon = (kind) => {
    const color = kind === 'start' ? '#315e49' : '#df7953';
    return L.divIcon({
      className: 'route-marker-icon',
      html: `<span class="map-marker"><svg viewBox="0 0 30 38" aria-hidden="true"><path d="M15 1.5C7.9 1.5 2.5 6.8 2.5 13.5c0 9 12.5 23 12.5 23s12.5-14 12.5-23C27.5 6.8 22.1 1.5 15 1.5Z" fill="${color}"/><circle cx="15" cy="13.5" r="5" fill="white"/><circle cx="15" cy="13.5" r="2.1" fill="${color}"/></svg></span>`,
      iconSize: [30, 38],
      iconAnchor: [15, 37],
    });
  };

  // Initialize Map
  useEffect(() => {
    if (!mapContainerRef.current || mapInstanceRef.current) return;

    const map = L.map(mapContainerRef.current, {
      zoomControl: false,
    }).setView(SERVICES.map.initialCenter, SERVICES.map.initialZoom);

    // 1. Primary OpenStreetMap Streets layer
    const osmLayer = L.tileLayer(SERVICES.map.tileUrl, {
      attribution: SERVICES.map.attribution,
      maxZoom: SERVICES.map.maxZoom,
    });

    osmLayer.on('tileerror', (error, tile) => {
      if (tile && tile.src && !tile.src.includes('cartocdn')) {
        const { z, x, y } = error.coords;
        tile.src = `https://basemaps.cartocdn.com/rastertiles/voyager/${z}/${x}/${y}.png`;
      }
    });

    // 2. High-resolution Satellite Imagery (Esri World Imagery)
    const satLayer = L.tileLayer(
      'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
      {
        attribution:
          'Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community',
        maxZoom: 19,
      }
    );

    // 3. Roads & Places Reference Labels for Hybrid view
    const labelLayer = L.tileLayer(
      'https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}',
      {
        maxZoom: 19,
        pane: 'overlayPane',
      }
    );

    tileLayersRef.current = {
      streets: osmLayer,
      satellite: satLayer,
      labels: labelLayer,
    };

    // Add default streets view
    osmLayer.addTo(map);

    L.control.zoom({ position: 'bottomright' }).addTo(map);

    map.on('click', async (e) => {
      const target = activePinRef.current;
      if (!target) return;

      try {
        setFeedback({ text: 'Resolving address from map...', type: 'success' });
        const place = await reverseGeocode(e.latlng.lat, e.latlng.lng);

        if (target === 'start') {
          setStartQuery(place.name);
          setLiveLocationStart(false);
        } else {
          setDestinationQuery(place.name);
        }

        if (mapPinMarkerRef.current) {
          map.removeLayer(mapPinMarkerRef.current);
        }

        mapPinMarkerRef.current = L.marker([place.lat, place.lon], {
          icon: createMarkerIcon(target),
          title: target === 'start' ? 'Starting location' : 'Destination',
        }).addTo(map);

        map.setView([place.lat, place.lon], Math.max(map.getZoom(), 12));
        setActivePinTarget(null);
        setFeedback({
          text: `${target === 'start' ? 'Starting point' : 'Destination'} pinned successfully.`,
          type: 'success',
        });
      } catch (err) {
        setFeedback({
          text: "Couldn't resolve address at that point. Please try another spot.",
          type: 'error',
        });
      }
    });

    mapInstanceRef.current = map;

    // Invalidate size to ensure all tiles render cleanly
    const timer1 = setTimeout(() => map.invalidateSize(), 100);
    const timer2 = setTimeout(() => map.invalidateSize(), 300);

    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  const switchMapStyle = (style) => {
    setMapStyle(style);
    const map = mapInstanceRef.current;
    const layers = tileLayersRef.current;
    if (!map || !layers.streets) return;

    if (map.hasLayer(layers.streets)) map.removeLayer(layers.streets);
    if (map.hasLayer(layers.satellite)) map.removeLayer(layers.satellite);
    if (map.hasLayer(layers.labels)) map.removeLayer(layers.labels);

    if (style === 'streets') {
      layers.streets.addTo(map);
    } else if (style === 'satellite') {
      layers.satellite.addTo(map);
    } else if (style === 'hybrid') {
      layers.satellite.addTo(map);
      layers.labels.addTo(map);
    }

    map.invalidateSize();
  };

  // Handle pre-loaded route from SavedRoutes
  useEffect(() => {
    if (initialRouteToLoad && mapInstanceRef.current) {
      setStartQuery(initialRouteToLoad.origin.name);
      setDestinationQuery(initialRouteToLoad.destination.name);
      setTravelMode(initialRouteToLoad.mode || 'driving');

      const timer = setTimeout(() => {
        if (mapInstanceRef.current) {
          mapInstanceRef.current.invalidateSize();
          executeRouteSearch(
            initialRouteToLoad.origin,
            initialRouteToLoad.destination,
            initialRouteToLoad.mode || 'driving'
          );
        }
      }, 150);

      return () => clearTimeout(timer);
    }
  }, [initialRouteToLoad]);

  const geocode = async (query) => {
    const params = new URLSearchParams({
      q: query,
      format: 'jsonv2',
      limit: '1',
      addressdetails: '1',
    });
    const response = await fetch(`${SERVICES.geocoding.baseUrl}?${params}`, {
      headers: { Accept: 'application/json' },
    });
    if (!response.ok) throw new Error('network');
    const results = await response.json();
    if (!results.length) throw new Error('not-found');
    return {
      lat: Number(results[0].lat),
      lon: Number(results[0].lon),
      name: results[0].display_name,
    };
  };

  const reverseGeocode = async (lat, lon) => {
    const params = new URLSearchParams({
      lat: String(lat),
      lon: String(lon),
      format: 'jsonv2',
    });
    const response = await fetch(`${SERVICES.geocoding.reverseUrl}?${params}`, {
      headers: { Accept: 'application/json' },
    });
    if (!response.ok) throw new Error('network');
    const result = await response.json();
    if (!result.display_name) throw new Error('not-found');
    return { lat, lon, name: result.display_name };
  };

  const getModeProfile = (mode) => {
    const map = { driving: 'driving', cycling: 'cycling', walking: 'walking', bus: 'driving' };
    return map[mode] || 'driving';
  };

  const getModeLabel = (mode) => {
    const labels = { driving: 'Car', cycling: 'Bike', walking: 'Walking', bus: 'Bus' };
    return labels[mode] || 'Car';
  };

  const requestRoute = async (start, destination, mode) => {
    const coordinates = `${start.lon},${start.lat};${destination.lon},${destination.lat}`;
    const profile = getModeProfile(mode);
    const params = new URLSearchParams({
      overview: 'full',
      geometries: 'geojson',
      steps: 'true', // Retrieve turn-by-turn steps
      alternatives: 'false',
    });
    const response = await fetch(
      `${SERVICES.routing.baseUrl.replace('driving', profile)}/${coordinates}?${params}`,
      { headers: { Accept: 'application/json' } }
    );
    if (!response.ok) throw new Error('network');
    const data = await response.json();
    if (data.code !== 'Ok' || !data.routes?.length) throw new Error('unavailable');
    return data.routes[0];
  };

  const renderRouteOnMap = (start, destination, route, mode) => {
    const map = mapInstanceRef.current;
    if (!map) return;

    map.invalidateSize();

    if (mapPinMarkerRef.current) {
      map.removeLayer(mapPinMarkerRef.current);
      mapPinMarkerRef.current = null;
    }
    if (routeLayerRef.current) {
      map.removeLayer(routeLayerRef.current);
    }
    markersRef.current.forEach((marker) => map.removeLayer(marker));

    const layer = L.geoJSON(route.geometry, {
      style: { color: '#315e49', weight: 5, opacity: 0.88, lineCap: 'round', lineJoin: 'round' },
    }).addTo(map);
    routeLayerRef.current = layer;

    const startMarker = L.marker([start.lat, start.lon], {
      icon: createMarkerIcon('start'),
      title: 'Starting location',
    }).addTo(map);
    const destMarker = L.marker([destination.lat, destination.lon], {
      icon: createMarkerIcon('destination'),
      title: 'Destination',
    }).addTo(map);
    markersRef.current = [startMarker, destMarker];

    const bounds = layer.getBounds().extend([start.lat, start.lon]).extend([destination.lat, destination.lon]);
    map.fitBounds(bounds, { padding: [58, 58], maxZoom: 15 });

    // Extract turn steps if available
    const steps = [];
    if (route.legs && route.legs[0] && route.legs[0].steps) {
      route.legs[0].steps.forEach((step) => {
        if (step.maneuver && step.maneuver.type !== 'arrive') {
          const type = step.maneuver.type || 'continue';
          const modifier = step.maneuver.modifier ? ` ${step.maneuver.modifier}` : '';
          const instruction = step.name
            ? `${capitalize(type + modifier)} onto ${step.name}`
            : capitalize(type + modifier);
          steps.push({
            instruction,
            distance: step.distance,
            duration: step.duration,
          });
        }
      });
    }
    setTurnSteps(steps);

    const routeData = {
      start,
      destination,
      route,
      mode,
      distance: route.distance,
      duration: route.duration,
    };
    setCurrentRoute(routeData);
    setSaveSuccess(false);

    const label = getModeLabel(mode);
    setMapCaption(`${formatDistance(route.distance)} route · ${formatDuration(route.duration)} · ${label}`);

    // Re-invalidate size once fitted to ensure all tiles cover the area
    setTimeout(() => map.invalidateSize(), 200);
  };

  const capitalize = (str) => {
    if (!str) return '';
    return str.charAt(0).toUpperCase() + str.slice(1);
  };

  const executeRouteSearch = async (startObj, destObj, mode) => {
    setIsLoading(true);
    setFeedback({ text: '', type: 'error' });
    try {
      const route = await requestRoute(startObj, destObj, mode);
      renderRouteOnMap(startObj, destObj, route, mode);
      setFeedback({
        text: `Your ${getModeLabel(mode).toLowerCase()} route is ready. Have a safe journey!`,
        type: 'success',
      });
    } catch (err) {
      handleFriendlyError(err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const startStr = startQuery.trim();
    const destStr = destinationQuery.trim();

    if (!startStr || !destStr) {
      setFeedback({
        text: 'Please add both a starting location and a destination to plan your route.',
        type: 'error',
      });
      return;
    }

    setIsLoading(true);
    setFeedback({ text: '', type: 'error' });

    try {
      const start = await geocode(startStr);
      const destination = await geocode(destStr);
      await executeRouteSearch(start, destination, travelMode);
    } catch (err) {
      handleFriendlyError(err);
      setIsLoading(false);
    }
  };

  const handleSwapLocations = () => {
    const prevStart = startQuery;
    const prevDest = destinationQuery;
    setStartQuery(prevDest);
    setDestinationQuery(prevStart);
    setLiveLocationStart(false);

    if (currentRoute) {
      executeRouteSearch(currentRoute.destination, currentRoute.start, travelMode);
    }
  };

  const handleFriendlyError = (err) => {
    const errorMap = {
      'not-found': "We couldn't find that location. Try specifying a city, state, or postal code.",
      unavailable: "A drivable route wasn't found between those two places. Try nearby landmarks.",
      network: "Couldn't reach map routing service. Check your internet connection.",
    };
    setFeedback({
      text: errorMap[err.message] || 'An unexpected error occurred while finding your route.',
      type: 'error',
    });
  };

  const useCurrentLocation = () => {
    if (!navigator.geolocation) {
      setFeedback({
        text: "Browser geolocation isn't supported in this browser.",
        type: 'error',
      });
      return;
    }

    setFeedback({ text: 'Detecting your GPS location...', type: 'success' });

    navigator.geolocation.getCurrentPosition(
      async ({ coords }) => {
        try {
          const place = await reverseGeocode(coords.latitude, coords.longitude);
          setStartQuery(place.name);
          setLiveLocationStart(true);

          if (mapInstanceRef.current) {
            if (mapPinMarkerRef.current) mapInstanceRef.current.removeLayer(mapPinMarkerRef.current);
            mapPinMarkerRef.current = L.marker([place.lat, place.lon], {
              icon: createMarkerIcon('start'),
              title: 'Current Location',
            }).addTo(mapInstanceRef.current);
            mapInstanceRef.current.setView([place.lat, place.lon], 13);
          }

          setFeedback({
            text: 'Starting location set to your current position.',
            type: 'success',
          });
        } catch (err) {
          setFeedback({ text: "Could not geocode your current GPS coordinates.", type: 'error' });
        }
      },
      () => {
        setFeedback({
          text: 'Location permission was denied. Enter starting place manually.',
          type: 'error',
        });
      },
      { enableHighAccuracy: false, timeout: 12000, maximumAge: 60000 }
    );
  };

  const togglePinTarget = (target) => {
    if (activePinTarget === target) {
      setActivePinTarget(null);
      setFeedback({ text: '', type: 'error' });
    } else {
      setActivePinTarget(target);
      setFeedback({
        text: `Click anywhere on the map to pin your ${target === 'start' ? 'starting point' : 'destination'}.`,
        type: 'success',
      });
    }
  };

  const handleSaveRoute = async () => {
    if (!isAuthenticated) {
      setCurrentView('login');
      return;
    }

    if (!currentRoute) return;

    setIsSaving(true);
    try {
      const response = await fetch('/api/routes', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          origin: currentRoute.start,
          destination: currentRoute.destination,
          distance: currentRoute.distance,
          duration: currentRoute.duration,
          mode: currentRoute.mode,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to save route to database');
      }

      setSaveSuccess(true);
      if (user?.savedRoutesCount !== undefined) {
        updateUserStats(user.savedRoutesCount + 1);
      }
      setFeedback({
        text: 'Route successfully saved to your MongoDB account!',
        type: 'success',
      });
    } catch (err) {
      setFeedback({
        text: 'Could not save route to MongoDB. Please try again.',
        type: 'error',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const clearPlanner = () => {
    setStartQuery('');
    setDestinationQuery('');
    setCurrentRoute(null);
    setTurnSteps([]);
    setShowSteps(false);
    setSaveSuccess(false);
    setFeedback({ text: '', type: 'error' });
    setActivePinTarget(null);
    setLiveLocationStart(false);
    setMapCaption('Search a place to get started');

    const map = mapInstanceRef.current;
    if (map) {
      if (routeLayerRef.current) map.removeLayer(routeLayerRef.current);
      markersRef.current.forEach((m) => map.removeLayer(m));
      if (mapPinMarkerRef.current) map.removeLayer(mapPinMarkerRef.current);
      routeLayerRef.current = null;
      markersRef.current = [];
      mapPinMarkerRef.current = null;
      map.setView(SERVICES.map.initialCenter, SERVICES.map.initialZoom);
      map.invalidateSize();
    }
  };

  const formatDistance = (meters) => {
    const km = meters / 1000;
    return km >= 100 ? `${Math.round(km)} km` : `${km.toFixed(1)} km`;
  };

  const formatDuration = (seconds) => {
    const min = Math.round(seconds / 60);
    if (min < 60) return `${Math.max(1, min)} min`;
    const hrs = Math.floor(min / 60);
    const remMin = min % 60;
    return remMin ? `${hrs} hr ${remMin} min` : `${hrs} hr`;
  };

  return (
    <main className="workspace">
      <div className="sidebar-column">
        <aside className="planner-panel" aria-label="Route planner">
          <div className="panel-heading">
            <span className="eyebrow">YOUR NEXT JOURNEY</span>
            <h1>Where to next?</h1>
            <p>Find the smartest route powered by OSRM &amp; OpenStreetMap.</p>
          </div>

          <form onSubmit={handleSubmit} className="route-form" noValidate>
            <div className="location-fields">
              <span className="journey-line" aria-hidden="true"></span>

              <label className="field-group" htmlFor="start-input">
                <span className="field-marker start-marker" aria-hidden="true"></span>
                <span className="field-content">
                  <span className="field-label">STARTING POINT</span>
                  <div className="field-with-action">
                    <input
                      id="start-input"
                      type="text"
                      placeholder="Enter starting location"
                      value={startQuery}
                      onChange={(e) => {
                        setStartQuery(e.target.value);
                        setLiveLocationStart(false);
                      }}
                      autoComplete="street-address"
                    />
                    <button
                      className={`pin-button ${activePinTarget === 'start' ? 'is-active' : ''}`}
                      type="button"
                      onClick={() => togglePinTarget('start')}
                      title="Click then select point on map"
                    >
                      {activePinTarget === 'start' ? 'Click Map' : 'Pin on map'}
                    </button>
                  </div>
                </span>
              </label>

              <div className="swap-row">
                <span className="swap-line" aria-hidden="true"></span>
                <button
                  type="button"
                  className="swap-button"
                  onClick={handleSwapLocations}
                  title="Swap Starting point and Destination"
                  aria-label="Swap Starting point and Destination"
                >
                  <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" width="16" height="16">
                    <path
                      d="M7 16V4m0 0L3 8m4-4l4 4m6-4v12m0 0l4-4m-4 4l-4-4"
                      strokeWidth="2.2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                  <span>Swap Locations</span>
                </button>
                <span className="swap-line" aria-hidden="true"></span>
              </div>

              <label className="field-group" htmlFor="destination-input">
                <span className="field-marker end-marker" aria-hidden="true"></span>
                <span className="field-content">
                  <span className="field-label">DESTINATION</span>
                  <div className="field-with-action">
                    <input
                      id="destination-input"
                      type="text"
                      placeholder="Enter destination"
                      value={destinationQuery}
                      onChange={(e) => setDestinationQuery(e.target.value)}
                      autoComplete="street-address"
                    />
                    <button
                      className={`pin-button ${activePinTarget === 'destination' ? 'is-active' : ''}`}
                      type="button"
                      onClick={() => togglePinTarget('destination')}
                      title="Click then select point on map"
                    >
                      {activePinTarget === 'destination' ? 'Click Map' : 'Pin on map'}
                    </button>
                  </div>
                </span>
              </label>
            </div>

            <div className="travel-mode-row">
              <label className="mode-picker" htmlFor="travel-mode">
                <span className="mode-label">Mode</span>
                <select
                  id="travel-mode"
                  value={travelMode}
                  onChange={(e) => setTravelMode(e.target.value)}
                >
                  <option value="driving">Car</option>
                  <option value="cycling">Bike</option>
                  <option value="walking">Walking</option>
                  <option value="bus">Bus</option>
                </select>
              </label>
            </div>

            <button className="primary-button" type="submit" disabled={isLoading}>
              <span className="button-label">
                {isLoading ? 'Finding route...' : 'Find Route'}
              </span>
              {isLoading ? (
                <span className="spinner" aria-hidden="true"></span>
              ) : (
                <svg className="button-arrow" viewBox="0 0 20 20" fill="none" aria-hidden="true">
                  <path
                    d="M4 10h11m-4-4 4 4-4 4"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              )}
            </button>

            <div className="secondary-actions">
              <button
                className="text-button"
                type="button"
                onClick={useCurrentLocation}
              >
                <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
                  <path
                    d="M10 17s5-4.6 5-9a5 5 0 1 0-10 0c0 4.4 5 9 5 9Z"
                    stroke="currentColor"
                    strokeWidth="1.5"
                  />
                  <circle cx="10" cy="8" r="1.7" stroke="currentColor" strokeWidth="1.5" />
                </svg>
                Use my location
              </button>
              <button
                className="text-button clear-button"
                type="button"
                onClick={clearPlanner}
              >
                Clear
              </button>
            </div>
          </form>

          {feedback.text && (
            <div
              className={`feedback ${feedback.type}`}
              role="status"
              aria-live="polite"
            >
              {feedback.text}
            </div>
          )}

          <div className="panel-footnote">
            <span className="footnote-icon" aria-hidden="true">✳</span>
            <span>Live OpenStreetMap tile engine + MongoDB cloud cache.</span>
          </div>
        </aside>

        {currentRoute && (
          <section className="route-card" aria-labelledby="route-card-title">
            <div className="route-card-heading">
              <div>
                <span className="eyebrow">YOUR ROUTE</span>
                <h2 id="route-card-title">Journey details</h2>
              </div>
              <span className="status-pill">
                <span className="status-dot"></span> Route ready
              </span>
            </div>

            <div className="route-stats">
              <div className="stat-block">
                <span className="stat-icon distance-icon" aria-hidden="true">↗</span>
                <span className="stat-label">DISTANCE</span>
                <strong>{formatDistance(currentRoute.distance)}</strong>
              </div>
              <div className="stat-block">
                <span className="stat-icon time-icon" aria-hidden="true">◷</span>
                <span className="stat-label">EST. TRAVEL TIME</span>
                <strong>{formatDuration(currentRoute.duration)}</strong>
              </div>
              <div className="stat-block vehicle-block">
                <span className="stat-icon vehicle-icon" aria-hidden="true">⬢</span>
                <span className="stat-label">VEHICLE</span>
                <strong>{getModeLabel(currentRoute.mode)}</strong>
              </div>
            </div>

            <div className="route-places">
              <div className="place-row">
                <span className="place-dot start-dot" aria-hidden="true"></span>
                <div>
                  <span className="place-label">FROM</span>
                  <strong title={currentRoute.start.name}>{currentRoute.start.name}</strong>
                </div>
              </div>
              <div className="place-row">
                <span className="place-dot end-dot" aria-hidden="true"></span>
                <div>
                  <span className="place-label">TO</span>
                  <strong title={currentRoute.destination.name}>
                    {currentRoute.destination.name}
                  </strong>
                </div>
              </div>
            </div>

            {turnSteps.length > 0 && (
              <div className="turn-steps-wrapper">
                <button
                  type="button"
                  className="btn-toggle-steps"
                  onClick={() => setShowSteps(!showSteps)}
                >
                  <span>{showSteps ? 'Hide' : 'Show'} Turn-by-Turn Directions ({turnSteps.length})</span>
                  <span className="arrow-indicator">{showSteps ? '▲' : '▼'}</span>
                </button>

                {showSteps && (
                  <ol className="steps-list">
                    {turnSteps.map((s, idx) => (
                      <li key={idx} className="step-item">
                        <span className="step-num">{idx + 1}</span>
                        <div className="step-details">
                          <span className="step-instruction">{s.instruction}</span>
                          {s.distance > 0 && (
                            <span className="step-dist">
                              {s.distance >= 1000 ? `${(s.distance / 1000).toFixed(1)} km` : `${Math.round(s.distance)} m`}
                            </span>
                          )}
                        </div>
                      </li>
                    ))}
                  </ol>
                )}
              </div>
            )}

            <div className="route-actions-bar">
              {isAuthenticated ? (
                <button
                  type="button"
                  className={`btn-save-route ${saveSuccess ? 'saved' : ''}`}
                  onClick={handleSaveRoute}
                  disabled={isSaving || saveSuccess}
                >
                  {saveSuccess ? (
                    <>
                      <span>✓</span> Saved to MongoDB
                    </>
                  ) : isSaving ? (
                    'Saving to Database...'
                  ) : (
                    <>
                      <span>⭐</span> Save Route to Account
                    </>
                  )}
                </button>
              ) : (
                <div className="auth-save-callout">
                  <span>Sign in to save this route to MongoDB</span>
                  <button
                    type="button"
                    className="btn-outline-xs"
                    onClick={() => setCurrentView('login')}
                  >
                    Log In
                  </button>
                </div>
              )}
            </div>

            <div className="route-meta">
              {liveLocationStart ? 'Live location origin' : 'Custom starting point'}
            </div>
          </section>
        )}
      </div>

      <section className={`map-panel ${activePinTarget ? 'is-pinning' : ''}`} aria-label="Route map">
        <div className="map-topline">
          <span className="map-heading">EXPLORE THE MAP</span>
          <span className="map-coordinates">{mapCaption}</span>
        </div>

        {/* Satellite / Streets View Switcher */}
        <div className="map-style-switcher" role="group" aria-label="Map style switcher">
          <button
            type="button"
            className={`style-pill-btn ${mapStyle === 'streets' ? 'active' : ''}`}
            onClick={() => switchMapStyle('streets')}
            title="Standard street map view"
          >
            <span className="pill-emoji">🗺️</span>
            <span>Streets</span>
          </button>
          <button
            type="button"
            className={`style-pill-btn ${mapStyle === 'satellite' ? 'active' : ''}`}
            onClick={() => switchMapStyle('satellite')}
            title="High-resolution satellite photography"
          >
            <span className="pill-emoji">🛰️</span>
            <span>Satellite</span>
          </button>
          <button
            type="button"
            className={`style-pill-btn ${mapStyle === 'hybrid' ? 'active' : ''}`}
            onClick={() => switchMapStyle('hybrid')}
            title="Satellite with street names and places"
          >
            <span className="pill-emoji">🏷️</span>
            <span>Hybrid</span>
          </button>
        </div>

        <div
          ref={mapContainerRef}
          id="map"
          role="application"
          aria-label="Interactive map showing your route"
        ></div>
        <div className="map-legend" aria-label="Map legend">
          <span>
            <i className="legend-dot origin"></i>Start
          </span>
          <span>
            <i className="legend-dot destination"></i>Destination
          </span>
        </div>
        <div className="map-credit">
          Map data ©{' '}
          <a
            href="https://www.openstreetmap.org/copyright"
            target="_blank"
            rel="noreferrer"
          >
            OpenStreetMap
          </a>{' '}
          contributors
        </div>
      </section>
    </main>
  );
}

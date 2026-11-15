import React, { useState, useEffect, useRef } from 'react';
import L from 'leaflet';
import { useAuth } from '../context/AuthContext';

const TILE_URL = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
const TILE_FALLBACK = 'https://basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png';

export default function SavedRoutes({ setCurrentView, onLoadRoute }) {
  const { token, updateUserStats } = useAuth();
  const [routes, setRoutes] = useState([]);
  const [selectedRouteId, setSelectedRouteId] = useState(null);
  const [mapStyle, setMapStyle] = useState('streets');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const activeLayersRef = useRef([]);
  const tileLayersRef = useRef({});

  // Fetch saved routes from MongoDB
  const fetchSavedRoutes = async () => {
    setIsLoading(true);
    setError('');
    try {
      const response = await fetch('/api/routes', {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error('Failed to load saved routes from database.');
      }

      const data = await response.json();
      const loaded = data.routes || [];
      setRoutes(loaded);
      updateUserStats(loaded.length);

      if (loaded.length > 0) {
        setSelectedRouteId(loaded[0]._id);
      }
    } catch (err) {
      setError(err.message || 'Error fetching routes from database.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchSavedRoutes();
  }, [token]);

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

  // Initialize Map in SavedRoutes
  useEffect(() => {
    if (!mapContainerRef.current || mapInstanceRef.current) return;

    const map = L.map(mapContainerRef.current, {
      zoomControl: false,
    }).setView([40.75, -73.98], 11);

    // 1. Streets layer
    const osmLayer = L.tileLayer(TILE_URL, {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a> contributors',
      maxZoom: 19,
    });

    osmLayer.on('tileerror', (err, tile) => {
      if (tile && tile.src && !tile.src.includes('cartocdn')) {
        const { z, x, y } = err.coords;
        tile.src = `https://basemaps.cartocdn.com/rastertiles/voyager/${z}/${x}/${y}.png`;
      }
    });

    // 2. High-res Satellite Imagery
    const satLayer = L.tileLayer(
      'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
      {
        attribution:
          'Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community',
        maxZoom: 19,
      }
    );

    // 3. Roads & Places Reference Labels
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

    osmLayer.addTo(map);

    L.control.zoom({ position: 'bottomright' }).addTo(map);
    mapInstanceRef.current = map;

    const timer1 = setTimeout(() => map.invalidateSize(), 150);
    const timer2 = setTimeout(() => map.invalidateSize(), 400);

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

  // Whenever selected route or routes list changes, render on the Saved Routes map!
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    // Clear previous layers
    activeLayersRef.current.forEach((l) => map.removeLayer(l));
    activeLayersRef.current = [];

    const selectedRoute = routes.find((r) => r._id === selectedRouteId) || routes[0];
    if (!selectedRoute) return;

    const { origin, destination } = selectedRoute;
    if (!origin?.lat || !destination?.lat) return;

    map.invalidateSize();

    // Add start and destination markers
    const startM = L.marker([origin.lat, origin.lon], {
      icon: createMarkerIcon('start'),
      title: origin.name,
    }).addTo(map).bindPopup(`<strong>Origin:</strong> ${origin.name}`);

    const destM = L.marker([destination.lat, destination.lon], {
      icon: createMarkerIcon('destination'),
      title: destination.name,
    }).addTo(map).bindPopup(`<strong>Destination:</strong> ${destination.name}`);

    activeLayersRef.current.push(startM, destM);

    // Fetch the route line from OSRM to render live on this map
    const coords = `${origin.lon},${origin.lat};${destination.lon},${destination.lat}`;
    const mode = selectedRoute.mode || 'driving';
    fetch(`https://router.project-osrm.org/route/v1/${mode}/${coords}?overview=full&geometries=geojson`)
      .then((res) => res.json())
      .then((data) => {
        if (data.routes && data.routes[0]) {
          const lineLayer = L.geoJSON(data.routes[0].geometry, {
            style: { color: '#315e49', weight: 5, opacity: 0.88, lineCap: 'round', lineJoin: 'round' },
          }).addTo(map);
          activeLayersRef.current.push(lineLayer);

          const bounds = lineLayer.getBounds().extend([origin.lat, origin.lon]).extend([destination.lat, destination.lon]);
          map.fitBounds(bounds, { padding: [40, 40], maxZoom: 14 });
        } else {
          const bounds = L.latLngBounds([
            [origin.lat, origin.lon],
            [destination.lat, destination.lon],
          ]);
          map.fitBounds(bounds, { padding: [50, 50], maxZoom: 13 });
        }
      })
      .catch(() => {
        const bounds = L.latLngBounds([
          [origin.lat, origin.lon],
          [destination.lat, destination.lon],
        ]);
        map.fitBounds(bounds, { padding: [50, 50], maxZoom: 13 });
      });

    setTimeout(() => map.invalidateSize(), 200);
  }, [selectedRouteId, routes]);

  const handleDelete = async (routeId) => {
    if (!window.confirm('Are you sure you want to delete this saved route?')) return;

    try {
      const response = await fetch(`/api/routes/${routeId}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/json',
        },
      });

      if (response.ok) {
        const remaining = routes.filter((r) => r._id !== routeId);
        setRoutes(remaining);
        updateUserStats(remaining.length);
        if (selectedRouteId === routeId) {
          setSelectedRouteId(remaining.length > 0 ? remaining[0]._id : null);
        }
      } else {
        alert('Could not delete route.');
      }
    } catch (err) {
      alert('Error deleting route.');
    }
  };

  const handleOpenInPlanner = (route) => {
    if (onLoadRoute) {
      onLoadRoute(route);
      setCurrentView('planner');
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

  const selectedRoute = routes.find((r) => r._id === selectedRouteId) || routes[0];

  return (
    <div className="saved-routes-page">
      <div className="saved-routes-header">
        <div>
          <span className="eyebrow">STORED IN MONGODB</span>
          <h1 className="page-title">Saved Journeys &amp; Map</h1>
          <p className="page-subtitle">
            Browse and inspect your saved routes directly on the interactive map.
          </p>
        </div>
        <button
          type="button"
          className="btn-primary-sm"
          onClick={() => setCurrentView('planner')}
        >
          + Plan New Route
        </button>
      </div>

      {error && (
        <div className="feedback-banner error" role="alert">
          <span>{error}</span>
        </div>
      )}

      {isLoading ? (
        <div className="loading-state">
          <span className="spinner-large" aria-hidden="true"></span>
          <p>Loading your routes from MongoDB...</p>
        </div>
      ) : routes.length === 0 ? (
        <div className="empty-state-card">
          <div className="empty-icon">🗺️</div>
          <h3>No saved routes yet</h3>
          <p>
            When you plan a journey on the map, click "Save Route to My Account"
            to store it in your MongoDB database.
          </p>
          <button
            type="button"
            className="primary-button"
            onClick={() => setCurrentView('planner')}
          >
            Start Planning Now
          </button>
        </div>
      ) : (
        <div className="saved-routes-layout">
          {/* Left Column: Routes List */}
          <div className="saved-routes-list">
            <div className="list-heading">
              <span>{routes.length} SAVED {routes.length === 1 ? 'ROUTE' : 'ROUTES'}</span>
              <span className="list-hint">Click any route to view on map</span>
            </div>

            <div className="cards-scroll-container">
              {routes.map((route) => {
                const isSelected = route._id === selectedRouteId;
                return (
                  <div
                    key={route._id}
                    className={`saved-route-card-item ${isSelected ? 'is-selected' : ''}`}
                    onClick={() => setSelectedRouteId(route._id)}
                  >
                    <div className="card-top">
                      <span className="mode-pill capitalize">{route.mode || 'driving'}</span>
                      <span className="card-date">
                        {new Date(route.createdAt).toLocaleDateString(undefined, {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        })}
                      </span>
                    </div>

                    <div className="places-flow">
                      <div className="flow-item">
                        <span className="flow-dot start"></span>
                        <div className="flow-content">
                          <span className="flow-label">FROM</span>
                          <strong className="place-name" title={route.origin.name}>
                            {route.origin.name}
                          </strong>
                        </div>
                      </div>
                      <div className="flow-divider"></div>
                      <div className="flow-item">
                        <span className="flow-dot end"></span>
                        <div className="flow-content">
                          <span className="flow-label">TO</span>
                          <strong className="place-name" title={route.destination.name}>
                            {route.destination.name}
                          </strong>
                        </div>
                      </div>
                    </div>

                    <div className="card-stats">
                      <div className="card-stat">
                        <span>DISTANCE</span>
                        <strong>{formatDistance(route.distance)}</strong>
                      </div>
                      <div className="card-stat">
                        <span>EST. TIME</span>
                        <strong>{formatDuration(route.duration)}</strong>
                      </div>
                    </div>

                    <div className="card-actions">
                      <button
                        type="button"
                        className="btn-open-route"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleOpenInPlanner(route);
                        }}
                      >
                        Open in Route Planner →
                      </button>
                      <button
                        type="button"
                        className="btn-delete-route"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDelete(route._id);
                        }}
                        title="Delete saved route"
                        aria-label="Delete saved route"
                      >
                        <svg viewBox="0 0 20 20" fill="currentColor" width="16" height="16">
                          <path
                            fillRule="evenodd"
                            d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z"
                            clipRule="evenodd"
                          />
                        </svg>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Right Column: Live Interactive Map */}
          <div className="saved-map-panel">
            <div className="saved-map-topline">
              <span className="map-heading">SAVED ROUTE PREVIEW</span>
              {selectedRoute && (
                <span className="selected-route-caption">
                  {formatDistance(selectedRoute.distance)} · {formatDuration(selectedRoute.duration)} ({selectedRoute.mode || 'driving'})
                </span>
              )}
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
              id="saved-map"
              role="application"
              aria-label="Saved Route Map"
            ></div>

            <div className="map-legend">
              <span><i className="legend-dot origin"></i>Start</span>
              <span><i className="legend-dot destination"></i>Destination</span>
            </div>

            <div className="map-credit">
              Map data © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a> contributors
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

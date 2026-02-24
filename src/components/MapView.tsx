import { useEffect, useState, useCallback } from "react";
import { MapContainer, TileLayer, Marker, Popup, Circle, Polyline, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { useStore, User } from "../store";
import { getDistance } from "../utils";

// Fix for default marker icons in react-leaflet
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png",
  iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png",
});

const driverIcon = new L.Icon({
  iconUrl: "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

const passengerIcon = new L.Icon({
  iconUrl: "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

const destinationIcon = new L.Icon({
  iconUrl: "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

// Helper component to center map on user
function MapUpdater({ center }: { center: [number, number] }) {
  const map = useMap();
  useEffect(() => {
    map.setView(center, map.getZoom());
  }, [center, map]);
  return null;
}

// Fit map bounds to show entire route
function RouteFitter({ from, to }: { from: [number, number]; to: [number, number] }) {
  const map = useMap();
  useEffect(() => {
    const bounds = L.latLngBounds([L.latLng(from[0], from[1]), L.latLng(to[0], to[1])]);
    map.fitBounds(bounds, { padding: [60, 60] });
  }, [map, from, to]);
  return null;
}

interface RouteStep {
  instruction: string;
  distance: number; // meters
  duration: number; // seconds
}

interface RouteData {
  coordinates: [number, number][];
  totalDistance: number; // km
  totalDuration: number; // minutes
  steps: RouteStep[];
}

// Fetch route from OSRM (free, no API key needed)
async function fetchRoute(
  from: [number, number],
  to: [number, number]
): Promise<RouteData | null> {
  try {
    const url = `https://router.project-osrm.org/route/v1/driving/${from[1]},${from[0]};${to[1]},${to[0]}?overview=full&geometries=geojson&steps=true`;
    const response = await fetch(url);

    if (!response.ok) throw new Error("OSRM request failed");

    const data = await response.json();

    if (data.code !== "Ok" || !data.routes?.length) {
      throw new Error("No route found");
    }

    const route = data.routes[0];
    const coordinates: [number, number][] = route.geometry.coordinates.map(
      (c: [number, number]) => [c[1], c[0]] // GeoJSON is [lng, lat], Leaflet needs [lat, lng]
    );

    const steps: RouteStep[] = route.legs[0].steps.map((step: any) => ({
      instruction: step.maneuver.type === "depart"
        ? "Start"
        : step.maneuver.type === "arrive"
          ? "Arrive at destination"
          : `${capitalize(step.maneuver.type)}${step.maneuver.modifier ? " " + step.maneuver.modifier : ""} — ${step.name || "unnamed road"}`,
      distance: step.distance,
      duration: step.duration,
    }));

    return {
      coordinates,
      totalDistance: route.distance / 1000, // meters → km
      totalDuration: route.duration / 60, // seconds → minutes
      steps,
    };
  } catch (err) {
    console.error("Route fetch error:", err);
    return null;
  }
}

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1).replace(/-/g, " ");
}

function formatDuration(minutes: number): string {
  if (minutes < 1) return "< 1 min";
  if (minutes < 60) return `${Math.round(minutes)} min`;
  const hours = Math.floor(minutes / 60);
  const mins = Math.round(minutes % 60);
  return `${hours}h ${mins}m`;
}

function formatDistance(meters: number): string {
  if (meters < 1000) return `${Math.round(meters)} m`;
  return `${(meters / 1000).toFixed(1)} km`;
}

export default function MapView({ onSelectUser }: { onSelectUser: (user: User) => void }) {
  const { currentUser, users } = useStore();

  // Navigation state
  const [routeTo, setRouteTo] = useState<[number, number] | null>(null);
  const [routeData, setRouteData] = useState<RouteData | null>(null);
  const [routeLoading, setRouteLoading] = useState(false);
  const [routeError, setRouteError] = useState<string | null>(null);
  const [showSteps, setShowSteps] = useState(false);

  const startNavigation = useCallback(async (from: [number, number], to: [number, number]) => {
    setRouteTo(to);
    setRouteLoading(true);
    setRouteError(null);
    setRouteData(null);
    setShowSteps(false);

    const data = await fetchRoute(from, to);
    if (data) {
      setRouteData(data);
    } else {
      setRouteError("Could not find a route. Please try again.");
    }
    setRouteLoading(false);
  }, []);

  const endNavigation = useCallback(() => {
    setRouteTo(null);
    setRouteData(null);
    setRouteLoading(false);
    setRouteError(null);
    setShowSteps(false);
  }, []);

  if (!currentUser || !currentUser.location) {
    return (
      <div className="h-full w-full flex items-center justify-center bg-gray-100">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4"></div>
          <p className="text-gray-500">Acquiring GPS signal...</p>
        </div>
      </div>
    );
  }

  const position: [number, number] = [currentUser.location.lat, currentUser.location.lng];
  const visibilityRadius = currentUser.isPremium ? 5 : 1; // km

  // Filter users based on role, distance, and online status
  const visibleUsers = users.filter((u) => {
    if (u.id === currentUser.id) return false;
    if (!u.isOnline) return false;
    if (!u.location) return false;
    if (u.role === currentUser.role) return false;

    const distance = getDistance(
      position[0],
      position[1],
      u.location.lat,
      u.location.lng
    );

    return distance <= visibilityRadius;
  });

  return (
    <div className="h-full w-full relative">
      <MapContainer
        center={position}
        zoom={14}
        style={{ height: "100%", width: "100%" }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {/* Center on user only when NOT navigating */}
        {!routeTo && <MapUpdater center={position} />}

        {/* Fit view to show entire route when navigating */}
        {routeTo && routeData && <RouteFitter from={position} to={routeTo} />}

        {/* Current User Marker */}
        <Marker position={position} icon={currentUser.role === 'driver' ? driverIcon : passengerIcon}>
          <Popup>
            <div className="text-center">
              <strong>You ({currentUser.name})</strong>
              <br />
              {currentUser.role}
            </div>
          </Popup>
        </Marker>

        {/* Visibility Circle */}
        {!routeTo && (
          <Circle
            center={position}
            radius={visibilityRadius * 1000}
            pathOptions={{
              color: currentUser.isPremium ? "#4f46e5" : "#9ca3af",
              fillColor: currentUser.isPremium ? "#4f46e5" : "#9ca3af",
              fillOpacity: 0.1,
            }}
          />
        )}

        {/* Other Users Markers — clicking only opens the popup */}
        {visibleUsers.map((u) => {
          const distance = getDistance(
            position[0],
            position[1],
            u.location!.lat,
            u.location!.lng
          ).toFixed(2);

          return (
            <Marker
              key={u.id}
              position={[u.location!.lat, u.location!.lng]}
              icon={u.role === 'driver' ? driverIcon : passengerIcon}
            >
              <Popup>
                <div className="text-center min-w-[150px]">
                  <strong className="text-lg block mb-1">{u.name}</strong>
                  <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 uppercase tracking-wide">
                    {u.role}
                  </span>

                  <div className="my-3 text-gray-600 font-medium flex items-center justify-center gap-1">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
                    </svg>
                    {distance} km away
                  </div>

                  <div className="flex gap-2 mt-2">
                    {/* Direction button — fetches route and draws on map */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        startNavigation(position, [u.location!.lat, u.location!.lng]);
                      }}
                      className="flex-1 px-3 py-2 bg-white border border-gray-300 text-gray-700 text-xs font-bold rounded-lg hover:bg-gray-50 transition-colors flex items-center justify-center gap-1"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M12.293 5.293a1 1 0 011.414 0l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-2.293-2.293a1 1 0 010-1.414z" clipRule="evenodd" />
                      </svg>
                      Direction
                    </button>
                    {/* Message button — opens chat sidebar */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectUser(u);
                      }}
                      className="flex-1 px-3 py-2 bg-indigo-600 text-white text-xs font-bold rounded-lg hover:bg-indigo-700 transition-colors flex items-center justify-center gap-1"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M18 5v8a2 2 0 01-2 2h-5l-5 4v-4H4a2 2 0 01-2-2V5a2 2 0 012-2h12a2 2 0 012 2zM7 8H5v2h2V8zm2 0h2v2H9V8zm6 0h-2v2h2V8z" clipRule="evenodd" />
                      </svg>
                      Message
                    </button>
                  </div>
                </div>
              </Popup>
            </Marker>
          );
        })}

        {/* Route polyline */}
        {routeData && (
          <Polyline
            positions={routeData.coordinates}
            pathOptions={{
              color: "#4f46e5",
              weight: 5,
              opacity: 0.85,
              lineCap: "round",
              lineJoin: "round",
            }}
          />
        )}

        {/* Destination marker */}
        {routeTo && (
          <Marker position={routeTo} icon={destinationIcon}>
            <Popup>
              <div className="text-center">
                <strong>Destination</strong>
                {routeData && (
                  <>
                    <br />
                    {routeData.totalDistance.toFixed(1)} km · {formatDuration(routeData.totalDuration)}
                  </>
                )}
              </div>
            </Popup>
          </Marker>
        )}
      </MapContainer>

      {/* Navigation Panel Overlay */}
      {routeTo && (
        <div className="absolute bottom-0 left-0 right-0 z-[1100] flex flex-col max-h-[50%]">
          {/* Navigation header bar */}
          <div className="bg-white/95 backdrop-blur-sm border-t border-gray-200 shadow-[0_-4px_20px_rgba(0,0,0,0.1)] rounded-t-2xl px-4 pt-4 pb-3">
            {/* Loading state */}
            {routeLoading && (
              <div className="flex items-center gap-3 mb-3">
                <div className="animate-spin rounded-full h-5 w-5 border-2 border-indigo-600 border-t-transparent"></div>
                <span className="text-sm font-medium text-gray-600">Finding best route...</span>
              </div>
            )}

            {/* Error state */}
            {routeError && (
              <div className="flex items-center gap-3 mb-3 px-3 py-2 bg-red-50 rounded-lg">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-red-500 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
                <span className="text-sm text-red-700">{routeError}</span>
              </div>
            )}

            {/* Route summary */}
            {routeData && (
              <div className="flex items-center gap-4 mb-3">
                <div className="flex items-center gap-2 px-3 py-2 bg-indigo-50 rounded-xl">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-indigo-600" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
                  </svg>
                  <span className="text-sm font-bold text-indigo-700">{routeData.totalDistance.toFixed(1)} km</span>
                </div>
                <div className="flex items-center gap-2 px-3 py-2 bg-green-50 rounded-xl">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-green-600" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.828a1 1 0 101.415-1.414L11 9.586V6z" clipRule="evenodd" />
                  </svg>
                  <span className="text-sm font-bold text-green-700">{formatDuration(routeData.totalDuration)}</span>
                </div>
                {routeData.steps.length > 0 && (
                  <button
                    onClick={() => setShowSteps(!showSteps)}
                    className="ml-auto px-3 py-2 text-xs font-bold text-indigo-600 bg-indigo-50 rounded-xl hover:bg-indigo-100 transition-colors"
                  >
                    {showSteps ? "Hide Steps" : `${routeData.steps.length} Steps`}
                  </button>
                )}
              </div>
            )}

            {/* End navigation button */}
            <button
              onClick={endNavigation}
              className="w-full py-3 bg-red-500 text-white text-sm font-bold rounded-xl hover:bg-red-600 transition-colors shadow-sm flex items-center justify-center gap-2"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
              End Navigation
            </button>
          </div>

          {/* Expandable step-by-step directions */}
          {showSteps && routeData && (
            <div className="bg-white border-t border-gray-100 overflow-y-auto px-4 py-3">
              <div className="space-y-2">
                {routeData.steps.map((step, i) => (
                  <div key={i} className="flex items-start gap-3 py-2">
                    <div className="flex-shrink-0 w-7 h-7 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center text-xs font-bold">
                      {i + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-gray-800 font-medium">{step.instruction}</p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {formatDistance(step.distance)} · {formatDuration(step.duration / 60)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Legend / Info Overlay — hidden during navigation */}
      {!routeTo && (
        <div className="absolute top-4 right-4 bg-white p-3 rounded-xl shadow-lg z-[1000] text-sm border border-gray-100">
          <h4 className="font-semibold mb-2 text-gray-900">Nearby {currentUser.role === 'driver' ? 'Passengers' : 'Drivers'}</h4>
          <div className="flex items-center gap-2 mb-1">
            <div className="w-3 h-3 rounded-full bg-red-500"></div>
            <span className="text-gray-600">Driver</span>
          </div>
          <div className="flex items-center gap-2 mb-3">
            <div className="w-3 h-3 rounded-full bg-blue-500"></div>
            <span className="text-gray-600">Passenger</span>
          </div>
          <div className="text-xs text-gray-400 font-medium">
            Showing within {visibilityRadius}km
          </div>
        </div>
      )}
    </div>
  );
}

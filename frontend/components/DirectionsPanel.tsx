"use client";
import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { MapContainer, TileLayer, Marker, Polyline, CircleMarker, useMap } from "react-leaflet";
import type { LatLngBoundsExpression } from "leaflet";

export interface DirectionsDest {
  name: string;
  lat: number;
  lng: number;
  icon: string;
  accent: string;
  meta: string;
}

interface Props extends DirectionsDest {
  onClose: () => void;
}

type Mode = "driving" | "cycling" | "foot";

interface RouteResult {
  distance: number;
  duration: number;
  coords: [number, number][];
  steps: { text: string; dist: number; type: string; modifier: string }[];
}

function fmtDist(m: number) {
  return m >= 1000 ? `${(m / 1000).toFixed(1)} km` : `${Math.round(m)} m`;
}

function fmtEta(secs: number) {
  const mins = Math.round(secs / 60);
  return mins < 60 ? `${mins} min` : `${Math.floor(mins / 60)}h ${mins % 60}m`;
}

function stepIcon(type: string, modifier: string) {
  if (type === "arrive") return "📍";
  if (type === "depart") return "🔵";
  if (modifier === "uturn") return "↩";
  if (modifier === "right" || modifier === "sharp right") return "→";
  if (modifier === "left" || modifier === "sharp left") return "←";
  if (modifier === "slight right") return "↗";
  if (modifier === "slight left") return "↖";
  return "↑";
}

function buildText(type: string, modifier: string, name: string): string {
  const n = name ? ` onto ${name}` : "";
  if (type === "arrive") return "Arrive at destination";
  if (type === "depart") return `Head ${modifier || "forward"}${name ? ` on ${name}` : ""}`;
  if (type === "turn") return `Turn ${modifier || ""}${n}`;
  if (type === "continue") return `Continue${name ? ` on ${name}` : " straight"}`;
  if (type === "roundabout" || type === "rotary") return `Take roundabout${n}`;
  if (type === "merge") return `Merge${n}`;
  if (type === "fork") return `Keep ${modifier || "straight"} at fork${n}`;
  if (type === "exit roundabout") return `Exit roundabout${n}`;
  return name || type;
}

function MapFit({ user, dest }: { user: [number, number] | null; dest: [number, number] }) {
  const map = useMap();
  const prevUser = useRef<string>("");
  useEffect(() => {
    const key = user ? `${user[0]},${user[1]}` : "";
    if (key === prevUser.current) return;
    prevUser.current = key;

    const pts: [number, number][] = [dest];
    if (user) pts.push(user);
    if (pts.length > 1) {
      try {
        map.fitBounds(pts as LatLngBoundsExpression, { padding: [70, 70], maxZoom: 16 });
      } catch {}
    } else {
      map.setView(dest, 15);
    }
  });
  return null;
}

export default function DirectionsPanel({ name, lat, lng, icon, accent, meta, onClose }: Props) {
  const [leaflet, setLeaflet] = useState<typeof import("leaflet") | null>(null);
  const [userLoc, setUserLoc] = useState<[number, number] | null>(null);
  const [mode, setMode] = useState<Mode>("driving");
  const [route, setRoute] = useState<RouteResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [locError, setLocError] = useState<string | null>(null);
  const [routeError, setRouteError] = useState<string | null>(null);
  const watchIdRef = useRef<number | null>(null);

  useEffect(() => {
    // Load and fix Leaflet
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const L = require("leaflet") as typeof import("leaflet");
    delete (L.Icon.Default.prototype as { _getIconUrl?: unknown })._getIconUrl;
    L.Icon.Default.mergeOptions({
      iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
      iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
      shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
    });
    setLeaflet(L);

    // Watch user location
    if (!navigator.geolocation) {
      setLocError("Geolocation not supported");
      return;
    }
    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        setUserLoc([pos.coords.latitude, pos.coords.longitude]);
        setLocError(null);
      },
      () => setLocError("Location unavailable — allow access in browser settings"),
      { enableHighAccuracy: true, maximumAge: 3000, timeout: 12000 }
    );

    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
    };
  }, []);

  const fetchRoute = useCallback(async (from: [number, number], m: Mode) => {
    setLoading(true);
    setRouteError(null);
    try {
      const url = `https://router.project-osrm.org/route/v1/${m}/${from[1]},${from[0]};${lng},${lat}?steps=true&geometries=geojson&overview=full`;
      const res = await fetch(url);
      const data = await res.json();
      if (data.code !== "Ok" || !data.routes?.length) throw new Error("No route");
      const r = data.routes[0];
      const leg = r.legs[0];
      setRoute({
        distance: r.distance,
        duration: r.duration,
        coords: (r.geometry.coordinates as number[][]).map(([lngC, latC]) => [latC, lngC]),
        steps: (leg.steps as { maneuver: { type: string; modifier?: string }; name: string; distance: number }[])
          .map(s => ({
            text: buildText(s.maneuver.type, s.maneuver.modifier ?? "", s.name),
            dist: s.distance,
            type: s.maneuver.type,
            modifier: s.maneuver.modifier ?? "",
          }))
          .filter(s => s.dist > 0 || s.type === "arrive"),
      });
    } catch {
      setRouteError("Could not fetch route — check connection");
    } finally {
      setLoading(false);
    }
  }, [lat, lng]);

  useEffect(() => {
    if (userLoc) fetchRoute(userLoc, mode);
  }, [userLoc, mode, fetchRoute]);

  const userIcon = useMemo(() => {
    if (!leaflet) return undefined;
    return leaflet.divIcon({
      html: `<div style="width:16px;height:16px;background:#3b82f6;border:3px solid white;border-radius:50%;box-shadow:0 0 0 6px rgba(59,130,246,0.22),0 0 0 12px rgba(59,130,246,0.08)"></div>`,
      className: "",
      iconSize: [16, 16],
      iconAnchor: [8, 8],
    });
  }, [leaflet]);

  const destIcon = useMemo(() => {
    if (!leaflet) return undefined;
    return leaflet.divIcon({
      html: `<div style="display:flex;align-items:center;justify-content:center;width:36px;height:36px;background:${accent};border-radius:50% 50% 50% 0;transform:rotate(-45deg);box-shadow:0 4px 14px rgba(0,0,0,0.45),0 0 0 3px ${accent}30;border:2px solid rgba(255,255,255,0.25)"><span style="transform:rotate(45deg);font-size:16px;line-height:1">${icon}</span></div>`,
      className: "",
      iconSize: [36, 36],
      iconAnchor: [18, 36],
    });
  }, [leaflet, accent, icon]);

  const gmapsUrl = userLoc
    ? `https://www.google.com/maps/dir/${userLoc[0]},${userLoc[1]}/${lat},${lng}`
    : `https://www.google.com/maps/dir//${lat},${lng}`;

  const MODE_OPTS: { id: Mode; label: string; icon: string }[] = [
    { id: "driving", label: "Drive", icon: "🚗" },
    { id: "cycling", label: "Cycle", icon: "🚲" },
    { id: "foot", label: "Walk", icon: "🚶" },
  ];

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 300, display: "flex", flexDirection: "column", background: "var(--bg)" }}>

      {/* ── Header ── */}
      <div style={{
        flexShrink: 0,
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "10px 14px",
        background: "var(--card)",
        borderBottom: "1px solid var(--border)",
      }}>
        <button
          onClick={onClose}
          style={{ fontSize: 18, color: "var(--muted)", flexShrink: 0, lineHeight: 1, background: "none", border: "none", cursor: "pointer" }}
        >
          ✕
        </button>
        <span style={{ fontSize: 20, flexShrink: 0 }}>{icon}</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ color: "var(--text)", fontWeight: 700, fontSize: 13, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{name}</p>
          <p style={{ color: "var(--muted)", fontSize: 11 }}>{meta}</p>
        </div>
        {route && (
          <div style={{ textAlign: "right", flexShrink: 0, marginRight: 4 }}>
            <p style={{ color: accent, fontWeight: 800, fontSize: 15 }}>{fmtEta(route.duration)}</p>
            <p style={{ color: "var(--muted)", fontSize: 11 }}>{fmtDist(route.distance)}</p>
          </div>
        )}
        <a
          href={gmapsUrl}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            flexShrink: 0,
            fontSize: 11,
            padding: "5px 9px",
            borderRadius: 8,
            background: "rgba(59,130,246,0.12)",
            color: "#60a5fa",
            textDecoration: "none",
            border: "1px solid rgba(59,130,246,0.25)",
            whiteSpace: "nowrap",
          }}
        >
          Google Maps ↗
        </a>
      </div>

      {/* ── Map ── */}
      <div style={{ flex: "0 0 52%", position: "relative", minHeight: 0 }}>
        <MapContainer
          center={[lat, lng]}
          zoom={14}
          style={{ height: "100%", width: "100%", background: "#080c14" }}
          scrollWheelZoom
          zoomControl={false}
        >
          <TileLayer
            url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
            attribution='&copy; <a href="https://carto.com">CARTO</a> &copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>'
          />
          <MapFit user={userLoc} dest={[lat, lng]} />

          {/* User location */}
          {userLoc && userIcon && (
            <Marker position={userLoc} icon={userIcon} />
          )}
          {/* Fallback if icon not loaded yet */}
          {userLoc && !userIcon && (
            <CircleMarker
              center={userLoc}
              radius={8}
              pathOptions={{ color: "#3b82f6", fillColor: "#3b82f6", fillOpacity: 0.9, weight: 3 }}
            />
          )}

          {/* Destination */}
          {destIcon && (
            <Marker position={[lat, lng]} icon={destIcon} />
          )}
          {!destIcon && (
            <CircleMarker
              center={[lat, lng]}
              radius={10}
              pathOptions={{ color: accent, fillColor: accent, fillOpacity: 0.9, weight: 3 }}
            />
          )}

          {/* Route line */}
          {route && route.coords.length > 1 && (
            <Polyline
              positions={route.coords}
              pathOptions={{ color: accent, weight: 5, opacity: 0.82, lineCap: "round", lineJoin: "round" }}
            />
          )}
        </MapContainer>

        {/* Status overlays */}
        {loading && (
          <div style={{
            position: "absolute", top: 10, left: "50%", transform: "translateX(-50%)",
            background: "rgba(10,14,22,0.88)", backdropFilter: "blur(6px)",
            color: "#94a3b8", padding: "5px 14px", borderRadius: 20, fontSize: 12, zIndex: 999,
            border: "1px solid rgba(255,255,255,0.07)",
          }}>
            Routing…
          </div>
        )}
        {!userLoc && !locError && !loading && (
          <div style={{
            position: "absolute", top: 10, left: "50%", transform: "translateX(-50%)",
            background: "rgba(10,14,22,0.88)", backdropFilter: "blur(6px)",
            color: "#94a3b8", padding: "5px 14px", borderRadius: 20, fontSize: 12, zIndex: 999,
            border: "1px solid rgba(255,255,255,0.07)",
          }}>
            Detecting location…
          </div>
        )}
      </div>

      {/* ── Mode Tabs ── */}
      <div style={{
        flexShrink: 0,
        display: "flex",
        gap: 8,
        padding: "10px 14px",
        background: "var(--card)",
        borderTop: "1px solid var(--border)",
        borderBottom: "1px solid var(--border)",
      }}>
        {MODE_OPTS.map((m) => (
          <button
            key={m.id}
            onClick={() => setMode(m.id)}
            style={{
              flex: 1,
              padding: "7px 0",
              borderRadius: 10,
              fontSize: 12,
              fontWeight: 600,
              background: mode === m.id ? `${accent}1a` : "var(--card2)",
              color: mode === m.id ? accent : "var(--muted)",
              border: `1px solid ${mode === m.id ? accent + "50" : "var(--border)"}`,
              cursor: "pointer",
              transition: "all 0.15s",
            }}
          >
            {m.icon} {m.label}
          </button>
        ))}
      </div>

      {/* ── Step-by-step ── */}
      <div style={{ flex: 1, overflowY: "auto", padding: "10px 14px 20px" }}>
        {locError && (
          <div style={{
            marginTop: 12,
            padding: "10px 14px",
            borderRadius: 10,
            background: "rgba(239,68,68,0.08)",
            border: "1px solid rgba(239,68,68,0.2)",
          }}>
            <p style={{ color: "#f87171", fontSize: 12 }}>📍 {locError}</p>
            <p style={{ color: "var(--muted)", fontSize: 11, marginTop: 4 }}>
              You can still{" "}
              <a href={gmapsUrl} target="_blank" rel="noopener noreferrer" style={{ color: "#60a5fa" }}>
                open in Google Maps ↗
              </a>
            </p>
          </div>
        )}
        {routeError && !locError && (
          <p style={{ color: "#f87171", fontSize: 12, marginTop: 12, textAlign: "center" }}>{routeError}</p>
        )}
        {!locError && !route && !loading && !routeError && (
          <p style={{ color: "var(--muted)", fontSize: 12, marginTop: 16, textAlign: "center" }}>
            Waiting for location to calculate route…
          </p>
        )}
        {route && (
          <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
            {route.steps.map((step, i) => (
              <div
                key={i}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "9px 10px",
                  borderRadius: 9,
                  background: i === 0 ? `${accent}12` : "transparent",
                  borderLeft: `3px solid ${i === 0 ? accent : "transparent"}`,
                }}
              >
                <span style={{ fontSize: 15, width: 22, textAlign: "center", flexShrink: 0 }}>
                  {stepIcon(step.type, step.modifier)}
                </span>
                <p style={{
                  flex: 1,
                  color: "var(--text)",
                  fontSize: 12,
                  fontWeight: i === 0 ? 600 : 400,
                  lineHeight: 1.35,
                }}>
                  {step.text}
                </p>
                {step.dist > 0 && (
                  <span style={{ color: "var(--muted)", fontSize: 11, flexShrink: 0 }}>{fmtDist(step.dist)}</span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

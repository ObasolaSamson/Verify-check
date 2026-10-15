"use client";

import { useEffect } from "react";
import { MapContainer, Marker, TileLayer, useMap, useMapEvents } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

const pin = L.divIcon({
  className: "",
  html: '<div style="width:16px;height:16px;border-radius:999px;background:#1e4d3a;border:2px solid #f4f1ea;box-shadow:0 0 0 1px #1e4d3a"></div>',
  iconSize: [16, 16],
  iconAnchor: [8, 8],
});

function ClickCatcher({ onChange }: { onChange: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(event) {
      onChange(event.latlng.lat, event.latlng.lng);
    },
  });
  return null;
}

function Recenter({ lat, lng }: { lat: number; lng: number }) {
  const map = useMap();
  useEffect(() => {
    map.setView([lat, lng], Math.max(map.getZoom(), 15));
  }, [lat, lng, map]);
  return null;
}

export function LocationPicker({
  latitude,
  longitude,
  onChange,
}: {
  latitude?: number;
  longitude?: number;
  onChange: (lat: number, lng: number) => void;
}) {
  const center: [number, number] = latitude !== undefined && longitude !== undefined ? [latitude, longitude] : [6.5244, 3.3792];
  return (
    <div className="h-72 overflow-hidden rounded-md border border-line">
      <MapContainer center={center} zoom={12} scrollWheelZoom={false}>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <ClickCatcher onChange={onChange} />
        {latitude !== undefined && longitude !== undefined ? (
          <>
            <Marker position={[latitude, longitude]} icon={pin} />
            <Recenter lat={latitude} lng={longitude} />
          </>
        ) : null}
      </MapContainer>
    </div>
  );
}

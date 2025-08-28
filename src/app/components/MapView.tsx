'use client';

import { useState } from 'react';
import { MapContainer, TileLayer, CircleMarker, Popup, useMapEvents } from 'react-leaflet';
import type { LeafletMouseEvent } from 'leaflet';  // ← type import にするのがポイント

export default function MapView() {
  const [markers, setMarkers] = useState<{lat:number; lon:number; text:string}[]>([]);

  function Clicker() {
    useMapEvents({
      click(e: LeafletMouseEvent) {
        const text = prompt('この場所に詠む（俳句/短歌/断片）');
        if (text && text.trim()) {
          setMarkers(m => [{ lat: e.latlng.lat, lon: e.latlng.lng, text }, ...m]);
        }
      }
    });
    return null;
  }

  return (
    <MapContainer center={[35.681,139.767]} zoom={13} style={{height:'80vh', width:'100%'}}>
      <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"/>
      <Clicker/>
      {markers.map((m,i)=>(
        <CircleMarker key={i} center={[m.lat, m.lon]} radius={6}>
          <Popup>
            <pre style={{margin:0, whiteSpace:'pre-wrap'}}>{m.text}</pre>
          </Popup>
        </CircleMarker>
      ))}
    </MapContainer>
  );
}

'use client'

import { useEffect, useRef, useState } from 'react'
import dynamic from 'next/dynamic'
import { CircleMarker, MapContainer, TileLayer, useMap, useMapEvents } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'

type Location = { id: string; name: string; region: string; x: number; y: number; code: string; lat?: number; lon?: number }
type Observation = { surface_temp: number | null; salinity: number | null; wind_speed: number | null }
type Metric = 'temperature' | 'salinity' | 'wind'
type ArgoProfile = { id: string; platform: string; cycle: number; date: string; lat: number; lon: number; max_depth: number; quality: string }

type OceanMapProps = {
  selected: Location
  locations: Location[]
  onSelect: (location: Location) => void
  mode: '2D' | '3D'
  metric?: Metric
  observations?: Record<string, Observation>
  onMapClick?: (lat: number, lon: number) => void
  argoProfiles?: ArgoProfile[]
  depth?: number
}

const Globe = dynamic(() => import('react-globe.gl'), { ssr: false })

const coords: Record<string, [number, number]> = {
  atlantic: [8.5, 74.2],
  pacific: [17.4, 63.8],
  southern: [15.2, 89.1],
}

function Recenter({ selected }: { selected: Location }) {
  const map = useMap()
  useEffect(() => {
    if (selected.id.startsWith('clicked-')) return
    const [lat, lng] = selected.lat != null && selected.lon != null ? [selected.lat, selected.lon] : coords[selected.id] ?? [15, 75]
    map.flyTo([lat, lng], Math.max(map.getZoom(), 4), { duration: 0.8 })
  }, [map, selected])
  return null
}

function MapClick({ onMapClick }: { onMapClick: (lat: number, lon: number) => void }) {
  useMapEvents({ click: (event) => onMapClick(event.latlng.lat, event.latlng.lng) })
  return null
}

export function OceanMap({ selected, locations, onSelect, mode, observations: initialObservations = {}, onMapClick, argoProfiles = [], depth = 500 }: OceanMapProps) {
  const globeRef = useRef<any>(null)
  const globeShellRef = useRef<HTMLDivElement>(null)
  const [globeSize, setGlobeSize] = useState({ width: 0, height: 0 })
  const [metric] = useState<Metric>('temperature')
  const [observations, setObservations] = useState<Record<string, Observation>>(initialObservations)
  const mapClickHandler = onMapClick ?? ((lat: number, lon: number) => onSelect({ id: `clicked-${lat}-${lon}`, name: 'Clicked location', region: 'Custom map selection', x: 50, y: 50, code: `${lat.toFixed(2)}°, ${lon.toFixed(2)}°`, lat, lon }))
  useEffect(() => {
    Promise.all(locations.map(async (location) => {
      const [lat, lon] = coords[location.id] ?? [15, 75]
      const response = await fetch(`http://127.0.0.1:8002/predict?lat=${lat}&lon=${lon}`)
      const data = await response.json()
      return [location.id, data] as const
    })).then((entries) => setObservations(Object.fromEntries(entries))).catch(() => undefined)
  }, [locations])
  useEffect(() => {
    if (!selected.id.startsWith('clicked-') || selected.lat == null || selected.lon == null) return
    fetch(`http://127.0.0.1:8002/predict?lat=${selected.lat}&lon=${selected.lon}`)
      .then((response) => response.json())
      .then((data: Observation) => setObservations((current) => ({ ...current, [selected.id]: data })))
      .catch(() => undefined)
  }, [selected])
  const metricValues = [...locations, ...(selected.id.startsWith('clicked-') ? [selected] : [])].map((location) => {
    const observation = observations[location.id]
    return metric === 'temperature' ? observation?.surface_temp : metric === 'salinity' ? observation?.salinity : observation?.wind_speed
  }).filter((value): value is number => value != null)
  const minimum = Math.min(...metricValues)
  const maximum = Math.max(...metricValues)
  const metricValue = (location: Location) => {
    const observation = observations[location.id]
    return metric === 'temperature' ? observation?.surface_temp : metric === 'salinity' ? observation?.salinity : observation?.wind_speed
  }
  const markerColor = (location: Location) => {
    const value = metricValue(location)
    if (value == null || !Number.isFinite(minimum) || maximum === minimum) return '#64748b'
    const ratio = (value - minimum) / (maximum - minimum)
    if (ratio > 0.66) return '#ff4d5a'
    if (ratio > 0.33) return '#ffd166'
    return '#27d3c2'
  }

  useEffect(() => {
    if (!globeShellRef.current) return
    const resizeObserver = new ResizeObserver(([entry]) => {
      setGlobeSize({ width: entry.contentRect.width, height: entry.contentRect.height })
    })
    resizeObserver.observe(globeShellRef.current)
    return () => resizeObserver.disconnect()
  }, [])

  useEffect(() => {
    if (mode === '3D' && globeRef.current) {
      globeRef.current.pointOfView({ lat: 15, lng: 75, altitude: 1.85 }, 0)
      globeRef.current.controls().autoRotate = true
      globeRef.current.controls().autoRotateSpeed = 0.35
      globeRef.current.controls().enableZoom = true
    }
  }, [mode])

  return (
    <div ref={globeShellRef} className={`ocean-map live-map ${mode === '3D' ? 'ocean-map-3d' : ''}`}>
      <div className="map-layer-control"><strong>Active Depth Slice: {depth} m</strong><span><i className="temperature-key" /> Temperature: teal → yellow → red</span><span><i className="salinity-key" /> Salinity: blue → violet</span><span><i className="wind-key" /> Wind: green → amber</span></div>
      {mode === '2D' ? (
        <MapContainer center={[15, 75]} zoom={4} zoomControl={false} scrollWheelZoom className="leaflet-map" aria-label="SIH 26066 satellite reconstruction map of the Indian Ocean">
          <TileLayer attribution="Tiles © Esri" url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}" />
          <Recenter selected={selected} />
          <MapClick onMapClick={mapClickHandler} />
          {locations.map((location) => {
            const [lat, lng] = coords[location.id] ?? [15, 75]
            return <CircleMarker key={location.id} center={[lat, lng]} radius={location.id === selected.id ? 10 : 7} pathOptions={{ color: location.id === selected.id ? '#ffffff' : markerColor(location), fillColor: markerColor(location), fillOpacity: 0.95, weight: location.id === selected.id ? 3 : 2 }} eventHandlers={{ click: (event) => { event.originalEvent.stopPropagation(); onSelect(location) } }} />
          })}
          {argoProfiles.map((profile) => <CircleMarker key={profile.id} center={[profile.lat, profile.lon]} radius={4} pathOptions={{ color: '#f1c75b', fillColor: '#f1c75b', fillOpacity: 0.8, weight: 1 }} eventHandlers={{ click: (event) => { event.originalEvent.stopPropagation(); onSelect({ id: `argo-${profile.id}`, name: `Argo ${profile.platform}`, region: `Cycle ${profile.cycle} · ${profile.date}`, x: 50, y: 50, code: profile.id, lat: profile.lat, lon: profile.lon }) } }} />)}
          {selected.id.startsWith('clicked-') && selected.lat != null && selected.lon != null && <CircleMarker center={[selected.lat, selected.lon]} radius={11} pathOptions={{ color: '#ffffff', fillColor: markerColor(selected), fillOpacity: 1, weight: 3 }} />}
        </MapContainer>
      ) : (
        <Globe ref={globeRef} width={globeSize.width} height={globeSize.height} backgroundColor="rgba(0,0,0,0)" globeImageUrl="//unpkg.com/three-globe/example/img/earth-blue-marble.jpg" bumpImageUrl="//unpkg.com/three-globe/example/img/earth-topology.png" atmosphereColor="#63d9d0" atmosphereAltitude={0.16} pointsData={locations.map((location) => ({ ...location, lat: coords[location.id]?.[0] ?? 15, lng: coords[location.id]?.[1] ?? 75, size: location.id === selected.id ? 0.7 : 0.42, color: markerColor(location) }))} pointLat="lat" pointLng="lng" pointColor="color" pointAltitude={0.025} pointRadius="size" pointLabel={(point: any) => `${point.name} (${depth}m Depth Slice)`} onPointClick={(point: object) => onSelect(locations.find((location) => location.id === (point as Location).id) ?? selected)} />
      )}
      <div className="map-legend"><span className="legend-dot" /> low <span className="legend-low" /> <span className="legend-mid" /> <span className="legend-high" /> high <span className="legend-line" /> {depth}m depth slice basemap</div>
    </div>
  )
}

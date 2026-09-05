'use client'

import { useEffect, useRef, useState } from 'react'
import dynamic from 'next/dynamic'
import { CircleMarker, MapContainer, TileLayer, useMap, useMapEvents } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'

const Ocean3DScene = dynamic(() => import('./ocean-3d-scene').then(m => m.Ocean3DScene), { ssr: false })
import { getPrediction } from '@/lib/ocean-service'

type Location = { id: string; name: string; region: string; x: number; y: number; code: string; lat?: number; lon?: number }
type Observation = { surface_temp: number | null; salinity: number | null; wind_speed: number | null }
type Metric = 'temperature' | 'salinity' | 'wind'
type ArgoProfile = { id: string; platform: string; cycle: number; date: string; lat: number; lon: number; max_depth: number; quality: string }
type ProfilePoint = { depth: number; temperature: number; salinity?: number }

type OceanMapProps = {
  selected: Location
  locations: Location[]
  onSelect: (location: Location) => void
  mode: '2D' | '3D'
  metric?: Metric
  onMetricChange?: (metric: Metric) => void
  observations?: Record<string, Observation>
  onMapClick?: (lat: number, lon: number) => void
  onArgoSelect?: (profile: ArgoProfile) => void
  argoProfiles?: ArgoProfile[]
  depth?: number
  onDepthChange?: (depth: number) => void
  temperatureProfile?: ProfilePoint[]
  salinityProfile?: ProfilePoint[]
  onViewProvenance?: (sourceKey: string, context?: any) => void
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || ""

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

export function OceanMap({
  selected,
  locations,
  onSelect,
  mode,
  metric: propMetric,
  onMetricChange,
  observations: initialObservations = {},
  onMapClick,
  onArgoSelect,
  argoProfiles = [],
  depth = 500,
  onDepthChange,
  temperatureProfile = [],
  salinityProfile = [],
  onViewProvenance,
}: OceanMapProps) {
  const globeShellRef = useRef<HTMLDivElement>(null)
  const [metric, setMetric] = useState<Metric>(propMetric || 'temperature')
  const [observations, setObservations] = useState<Record<string, Observation>>(initialObservations)

  const handleMetricSwitch = (m: Metric) => {
    setMetric(m)
    onMetricChange?.(m)
  }

  const mapClickHandler = onMapClick ?? ((lat: number, lon: number) => onSelect({ id: `clicked-${lat}-${lon}`, name: 'Clicked location', region: 'Custom map selection', x: 50, y: 50, code: `${lat.toFixed(2)}°, ${lon.toFixed(2)}°`, lat, lon }))

  useEffect(() => {
    if (propMetric && propMetric !== metric) {
      setMetric(propMetric)
    }
  }, [propMetric])

  useEffect(() => {
    if (API_URL) {
      Promise.all(locations.map(async (location) => {
        const [lat, lon] = coords[location.id] ?? [8.5, 74.2]
        try {
          const response = await fetch(`${API_URL}/predict?lat=${lat}&lon=${lon}`)
          const data = await response.json()
          return [location.id, data || (getPrediction(lat, lon) as any)] as const
        } catch {
          return [location.id, getPrediction(lat, lon) as any] as const
        }
      })).then((entries) => {
        const valid = entries.filter((e): e is readonly [string, any] => e[1] !== null)
        setObservations(Object.fromEntries(valid))
      }).catch(() => undefined)
    } else {
      const entries = locations.map((location) => {
        const [lat, lon] = coords[location.id] ?? [8.5, 74.2]
        return [location.id, getPrediction(lat, lon) as any] as const
      })
      setObservations(Object.fromEntries(entries))
    }
  }, [locations])

  useEffect(() => {
    if (!selected.id.startsWith('clicked-') || selected.lat == null || selected.lon == null) return
    if (API_URL) {
      fetch(`${API_URL}/predict?lat=${selected.lat}&lon=${selected.lon}`)
        .then((response) => response.json())
        .then((data: Observation) => setObservations((current) => ({ ...current, [selected.id]: data || (getPrediction(selected.lat!, selected.lon!) as any) })))
        .catch(() => {
          const fallback = getPrediction(selected.lat!, selected.lon!)
          if (fallback) setObservations((current) => ({ ...current, [selected.id]: fallback as any }))
        })
    } else {
      const fallback = getPrediction(selected.lat, selected.lon)
      if (fallback) setObservations((current) => ({ ...current, [selected.id]: fallback as any }))
    }
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
    
    if (metric === 'salinity') {
      if (ratio > 0.66) return '#8a2be2'
      if (ratio > 0.33) return '#4169e1'
      return '#00bfff'
    }
    if (metric === 'wind') {
      if (ratio > 0.66) return '#ffbf00'
      if (ratio > 0.33) return '#9acd32'
      return '#32cd32'
    }
    if (ratio > 0.66) return '#ff4d5a'
    if (ratio > 0.33) return '#ffd166'
    return '#27d3c2'
  }

  return (
    <div ref={globeShellRef} className={`ocean-map live-map ${mode === '3D' ? 'ocean-map-3d' : ''}`}>
      {mode === '2D' && (
        <div className="map-layer-control">
          <strong>Active Depth Slice: {depth} m</strong>
          <span 
            style={{ cursor: 'pointer', opacity: metric === 'temperature' ? 1 : 0.45 }} 
            onClick={() => handleMetricSwitch('temperature')}
          >
            <i className="temperature-key" /> Temperature: teal → yellow → red
          </span>
          <span 
            style={{ cursor: 'pointer', opacity: metric === 'salinity' ? 1 : 0.45 }} 
            onClick={() => handleMetricSwitch('salinity')}
          >
            <i className="salinity-key" /> Salinity: blue → violet
          </span>
          <span 
            style={{ cursor: 'pointer', opacity: metric === 'wind' ? 1 : 0.45 }} 
            onClick={() => handleMetricSwitch('wind')}
          >
            <i className="wind-key" /> Wind: green → amber
          </span>
        </div>
      )}

      {mode === '2D' ? (
        <MapContainer center={[12, 75]} zoom={4} zoomControl={false} scrollWheelZoom className="leaflet-map" aria-label="SIH 26066 satellite reconstruction map of the Indian Ocean">
          <TileLayer attribution="Tiles © Esri" url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}" />
          <Recenter selected={selected} />
          <MapClick onMapClick={mapClickHandler} />
          {locations.map((location) => {
            const [lat, lng] = coords[location.id] ?? [8.5, 74.2]
            return (
              <CircleMarker
                key={location.id}
                center={[lat, lng]}
                radius={location.id === selected.id ? 10 : 7}
                pathOptions={{
                  color: location.id === selected.id ? '#ffffff' : markerColor(location),
                  fillColor: markerColor(location),
                  fillOpacity: 0.95,
                  weight: location.id === selected.id ? 3 : 2
                }}
                eventHandlers={{
                  click: (event) => {
                    event.originalEvent.stopPropagation()
                    onSelect(location)
                  }
                }}
              />
            )
          })}
          {argoProfiles.map((profile) => (
            <CircleMarker
              key={profile.id}
              center={[profile.lat, profile.lon]}
              radius={4}
              pathOptions={{ color: '#f1c75b', fillColor: '#f1c75b', fillOpacity: 0.85, weight: 1 }}
              eventHandlers={{
                click: (event) => {
                  event.originalEvent.stopPropagation()
                  onSelect({
                    id: `argo-${profile.id}`,
                    name: `Argo ${profile.platform}`,
                    region: `Cycle ${profile.cycle} · ${profile.date}`,
                    x: 50,
                    y: 50,
                    code: profile.id,
                    lat: profile.lat,
                    lon: profile.lon,
                  })
                  onArgoSelect?.(profile)
                }
              }}
            />
          ))}
          {selected.id.startsWith('clicked-') && selected.lat != null && selected.lon != null && (
            <CircleMarker
              center={[selected.lat, selected.lon]}
              radius={11}
              pathOptions={{ color: '#ffffff', fillColor: markerColor(selected), fillOpacity: 1, weight: 3 }}
            />
          )}
        </MapContainer>
      ) : (
        <Ocean3DScene
          selected={selected}
          locations={locations}
          onSelect={onSelect}
          depth={depth}
          onDepthChange={onDepthChange}
          metric={metric === 'wind' ? 'temperature' : metric}
          onMetricChange={(m) => handleMetricSwitch(m)}
          temperatureProfile={temperatureProfile}
          salinityProfile={salinityProfile}
          argoProfiles={argoProfiles}
          onViewProvenance={onViewProvenance}
        />
      )}
      {mode === '2D' && (
        <div className="map-legend">
          <span className="legend-dot" /> low <span className="legend-low" /> <span className="legend-mid" /> <span className="legend-high" /> high
          <span className="legend-line" /> {depth}m depth slice basemap
        </div>
      )}
    </div>
  )
}

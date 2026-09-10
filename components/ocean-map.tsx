'use client'

import { useEffect, useRef, useState } from 'react'
import dynamic from 'next/dynamic'
import L from 'leaflet'
import { Marker, MapContainer, TileLayer, useMap, useMapEvents } from 'react-leaflet'
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

// Caches for Leaflet DivIcons to ensure high performance
const argoIconCache = new Map<string, L.DivIcon>()

function getArgoDivIcon(metric: Metric, isSelected: boolean): L.DivIcon | undefined {
  if (typeof window === 'undefined') return undefined
  const key = `${metric}-${isSelected ? 'selected' : 'normal'}`
  const existing = argoIconCache.get(key)
  if (existing) return existing

  const color = metric === 'temperature' ? '#ef4444' : metric === 'salinity' ? '#38bdf8' : '#22c55e'
  const glow = metric === 'temperature' ? 'rgba(239, 68, 68, 0.75)' : metric === 'salinity' ? 'rgba(56, 189, 248, 0.75)' : 'rgba(34, 197, 94, 0.75)'

  const icon = L.divIcon({
    className: 'ocean-depth-marker-wrapper',
    html: isSelected
      ? `<div class="ocean-depth-marker selected" style="filter: drop-shadow(0 0 9px ${glow});">
          <div class="marker-pulse-ring" style="border-color: ${color}; box-shadow: 0 0 12px ${color};"></div>
          <svg width="22" height="34" viewBox="0 0 22 34" fill="none" xmlns="http://www.w3.org/2000/svg">
            <line x1="11" y1="10" x2="11" y2="28" stroke="${color}" stroke-width="2" stroke-linecap="round" />
            <line x1="8.5" y1="16" x2="13.5" y2="16" stroke="#ffffff" stroke-width="1.2" opacity="0.95" />
            <line x1="8.5" y1="22" x2="13.5" y2="22" stroke="${color}" stroke-width="1.2" />
            <path d="M8.5 27 L11 33 L13.5 27 Z" fill="${color}" />
            <circle cx="11" cy="6" r="5.6" fill="none" stroke="#ffffff" stroke-width="1.4" />
            <circle cx="11" cy="6" r="4.2" fill="${color}" />
            <circle cx="11" cy="6" r="1.8" fill="#ffffff" />
          </svg>
        </div>`
      : `<div class="ocean-depth-marker" style="filter: drop-shadow(0 0 6px ${glow});">
          <svg width="15" height="25" viewBox="0 0 15 25" fill="none" xmlns="http://www.w3.org/2000/svg">
            <line x1="7.5" y1="7" x2="7.5" y2="20" stroke="${color}" stroke-width="1.4" stroke-linecap="round" />
            <line x1="5.5" y1="13" x2="9.5" y2="13" stroke="#ffffff" stroke-width="1" opacity="0.85" />
            <path d="M5.5 19.5 L7.5 24 L9.5 19.5 Z" fill="${color}" />
            <circle cx="7.5" cy="4.5" r="4.2" fill="none" stroke="${color}" stroke-width="1" />
            <circle cx="7.5" cy="4.5" r="3.2" fill="${color}" />
            <circle cx="7.5" cy="4.5" r="1.2" fill="#ffffff" />
          </svg>
        </div>`,
    iconSize: isSelected ? [22, 34] : [15, 25],
    iconAnchor: isSelected ? [11, 34] : [7.5, 25],
  })

  argoIconCache.set(key, icon)
  return icon
}

const stationIconCache = new Map<string, L.DivIcon>()

function getStationDivIcon(metric: Metric, isSelected: boolean): L.DivIcon | undefined {
  if (typeof window === 'undefined') return undefined
  const cacheKey = `station-${metric}-${isSelected ? 'selected' : 'normal'}`
  const existing = stationIconCache.get(cacheKey)
  if (existing) return existing

  const color = metric === 'temperature' ? '#ef4444' : metric === 'salinity' ? '#38bdf8' : '#22c55e'
  const glow = metric === 'temperature' ? 'rgba(239, 68, 68, 0.8)' : metric === 'salinity' ? 'rgba(56, 189, 248, 0.8)' : 'rgba(34, 197, 94, 0.8)'

  const icon = L.divIcon({
    className: 'ocean-depth-marker-wrapper',
    html: `
      <div class="ocean-depth-marker ${isSelected ? 'selected' : ''}" style="filter: drop-shadow(0 0 ${isSelected ? '12px' : '7px'} ${glow});">
        ${isSelected ? `<div class="marker-pulse-ring" style="border-color: ${color}; box-shadow: 0 0 14px ${color};"></div>` : ''}
        <svg width="${isSelected ? '24' : '18'}" height="${isSelected ? '36' : '28'}" viewBox="0 0 24 36" fill="none" xmlns="http://www.w3.org/2000/svg">
          <line x1="12" y1="11" x2="12" y2="${isSelected ? '30' : '23'}" stroke="${color}" stroke-width="2" stroke-linecap="round" />
          <line x1="9.5" y1="17" x2="14.5" y2="17" stroke="#ffffff" stroke-width="1.2" opacity="0.9" />
          <path d="M9.5 ${isSelected ? '29' : '22'} L12 ${isSelected ? '35' : '27'} L14.5 ${isSelected ? '29' : '22'} Z" fill="${color}" />
          <circle cx="12" cy="6.5" r="${isSelected ? '6.5' : '5'}" fill="none" stroke="#ffffff" stroke-width="1.5" />
          <circle cx="12" cy="6.5" r="${isSelected ? '4.8' : '3.8'}" fill="${color}" />
          <circle cx="12" cy="6.5" r="${isSelected ? '2' : '1.5'}" fill="#ffffff" />
        </svg>
      </div>
    `,
    iconSize: isSelected ? [24, 36] : [18, 28],
    iconAnchor: isSelected ? [12, 36] : [9, 28],
  })

  stationIconCache.set(cacheKey, icon)
  return icon
}

function Recenter({ selected }: { selected: Location }) {
  const map = useMap()
  useEffect(() => {
    if (selected.id.startsWith('clicked-')) return
    const [lat, lng] = selected.lat != null && selected.lon != null ? [selected.lat, selected.lon] : coords[selected.id] ?? [13, 77.5]
    map.flyTo([lat, lng], Math.max(map.getZoom(), 4.8), { duration: 0.8 })
  }, [map, selected])
  return null
}

function MapClick({ onMapClick }: { onMapClick: (lat: number, lon: number) => void }) {
  useMapEvents({ click: (event: L.LeafletMouseEvent) => onMapClick(event.latlng.lat, event.latlng.lng) })
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

  // Filter locations according to active parameter
  const filteredLocations = locations.filter((loc) => {
    const obs = observations[loc.id]
    if (!obs) return true
    if (metric === 'temperature') return obs.surface_temp != null
    if (metric === 'salinity') return obs.salinity != null
    if (metric === 'wind') return obs.wind_speed != null
    return true
  })

  // Filter Argo floats: when wind selected, floats are hidden because Argo does not measure wind
  const filteredArgoProfiles = metric === 'wind' ? [] : argoProfiles

  return (
    <div ref={globeShellRef} className={`ocean-map live-map ${mode === '3D' ? 'ocean-map-3d' : ''}`}>
      {mode === '2D' && (
        <div className="map-layer-control">
          <strong>Active Depth Slice: {depth} m</strong>
          <span 
            style={{ cursor: 'pointer', opacity: metric === 'temperature' ? 1 : 0.45, color: metric === 'temperature' ? '#ff4d5a' : '#94a3b8' }} 
            onClick={() => handleMetricSwitch('temperature')}
          >
            <span style={{ display: 'inline-block', width: '8px', height: '8px', borderRadius: '50%', background: '#ef4444', marginRight: '6px', boxShadow: '0 0 6px #ef4444' }} />
            Temperature (°C)
          </span>
          <span 
            style={{ cursor: 'pointer', opacity: metric === 'salinity' ? 1 : 0.45, color: metric === 'salinity' ? '#38bdf8' : '#94a3b8' }} 
            onClick={() => handleMetricSwitch('salinity')}
          >
            <span style={{ display: 'inline-block', width: '8px', height: '8px', borderRadius: '50%', background: '#38bdf8', marginRight: '6px', boxShadow: '0 0 6px #38bdf8' }} />
            Salinity (PSU)
          </span>
          <span 
            style={{ cursor: 'pointer', opacity: metric === 'wind' ? 1 : 0.45, color: metric === 'wind' ? '#22c55e' : '#94a3b8' }} 
            onClick={() => handleMetricSwitch('wind')}
          >
            <span style={{ display: 'inline-block', width: '8px', height: '8px', borderRadius: '50%', background: '#22c55e', marginRight: '6px', boxShadow: '0 0 6px #22c55e' }} />
            Wind (m/s)
          </span>
        </div>
      )}

      {mode === '2D' ? (
        <MapContainer
          center={[13, 77.5]}
          zoom={4.8}
          zoomSnap={0.1}
          zoomControl={false}
          scrollWheelZoom
          className="leaflet-map"
          aria-label="OceanEmbed satellite reconstruction map of the Indian Ocean"
        >
          <TileLayer attribution="Tiles © Esri" url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}" />
          <Recenter selected={selected} />
          <MapClick onMapClick={mapClickHandler} />
          {filteredLocations.map((location) => {
            const [lat, lng] = coords[location.id] ?? [8.5, 74.2]
            const isSelected = location.id === selected.id
            const icon = getStationDivIcon(metric, isSelected)
            if (!icon) return null
            return (
              <Marker
                key={location.id}
                position={[lat, lng]}
                icon={icon}
                zIndexOffset={isSelected ? 1000 : 100}
                eventHandlers={{
                  click: (event: L.LeafletMouseEvent) => {
                    event.originalEvent.stopPropagation()
                    onSelect(location)
                  }
                }}
              />
            )
          })}
          {filteredArgoProfiles.map((profile) => {
            const isSelected = selected.id === `argo-${profile.id}` || selected.code === profile.id
            const icon = getArgoDivIcon(metric, isSelected)
            if (!icon) return null
            return (
              <Marker
                key={profile.id}
                position={[profile.lat, profile.lon]}
                icon={icon}
                zIndexOffset={isSelected ? 1000 : 10}
                eventHandlers={{
                  click: (event: L.LeafletMouseEvent) => {
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
            )
          })}
          {selected.id.startsWith('clicked-') && selected.lat != null && selected.lon != null && (
            (() => {
              const icon = getStationDivIcon(metric, true)
              if (!icon) return null
              return (
                <Marker
                  position={[selected.lat, selected.lon]}
                  icon={icon}
                  zIndexOffset={1000}
                />
              )
            })()
          )}
        </MapContainer>
      ) : (
        <Ocean3DScene
          selected={selected}
          locations={filteredLocations}
          onSelect={onSelect}
          depth={depth}
          onDepthChange={onDepthChange}
          metric={metric === 'wind' ? 'temperature' : metric}
          onMetricChange={(m) => handleMetricSwitch(m)}
          temperatureProfile={temperatureProfile}
          salinityProfile={salinityProfile}
          argoProfiles={filteredArgoProfiles}
          onViewProvenance={onViewProvenance}
        />
      )}
      {mode === '2D' && (
        <div className="map-legend">
          {metric === 'temperature' && (
            <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#ef4444', boxShadow: '0 0 8px #ef4444', display: 'inline-block' }} />
              <strong style={{ color: '#ff4d5a' }}>● Red = Temperature (°C)</strong>
              <span style={{ color: '#709094', marginLeft: '6px' }}>· In-Situ Argo Profilers &amp; Marine Stations at {depth} m</span>
            </span>
          )}
          {metric === 'salinity' && (
            <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#38bdf8', boxShadow: '0 0 8px #38bdf8', display: 'inline-block' }} />
              <strong style={{ color: '#38bdf8' }}>● Blue = Salinity (PSU)</strong>
              <span style={{ color: '#709094', marginLeft: '6px' }}>· In-Situ Argo Profilers &amp; Marine Stations at {depth} m</span>
            </span>
          )}
          {metric === 'wind' && (
            <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#22c55e', boxShadow: '0 0 8px #22c55e', display: 'inline-block' }} />
              <strong style={{ color: '#22c55e' }}>● Green = Wind (m/s)</strong>
              <span style={{ color: '#709094', marginLeft: '6px' }}>· HY-2C Satellite Scatterometer Stations</span>
            </span>
          )}
        </div>
      )}
    </div>
  )
}

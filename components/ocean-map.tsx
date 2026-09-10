'use client'

import React, { useEffect, useRef, useState } from 'react'
import dynamic from 'next/dynamic'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { getObservationsForDate, isOceanCoordinate } from '@/lib/ocean-service'

const Ocean3DScene = dynamic(() => import('./ocean-3d-scene').then(m => m.Ocean3DScene), { ssr: false })

export type Location = {
  id: string
  name: string
  region: string
  x: number
  y: number
  code: string
  lat?: number
  lon?: number
}

type Metric = 'temperature' | 'salinity' | 'wind'

type OceanMapProps = {
  selected: Location
  locations: Location[]
  onSelect: (location: Location) => void
  mode: '2D' | '3D'
  metric?: Metric
  onMetricChange?: (metric: Metric) => void
  observations?: Record<string, any>
  onMapClick?: (lat: number, lon: number) => void
  onArgoSelect?: (profile: any) => void
  argoProfiles?: any[]
  depth?: number
  onDepthChange?: (depth: number) => void
  temperatureProfile?: any[]
  salinityProfile?: any[]
  onViewProvenance?: (sourceKey: string, context?: any) => void
  selectedDate?: string
}

function getMarkerDivIcon(metric: Metric, isSelected: boolean, valueText?: string): L.DivIcon {
  const color = metric === 'temperature' ? '#ef4444' : metric === 'salinity' ? '#38bdf8' : '#22c55e'
  const glow = metric === 'temperature' ? 'rgba(239, 68, 68, 0.75)' : metric === 'salinity' ? 'rgba(56, 189, 248, 0.75)' : 'rgba(34, 197, 94, 0.75)'

  const size = isSelected ? 34 : 22
  const pulseHtml = isSelected
    ? `<div style="position:absolute; width:44px; height:44px; top:-6px; left:-6px; border-radius:50%; border:2px solid ${color}; box-shadow:0 0 14px ${color}; animation:pulse-glow 1.8s infinite;"></div>`
    : ''

  const labelBadge = valueText
    ? `<div style="position:absolute; top:-20px; left:50%; transform:translateX(-50%); background:rgba(3,15,22,0.92); border:1px solid ${color}; color:${color}; font-size:10px; font-weight:700; font-family:monospace; padding:1px 5px; border-radius:3px; white-space:nowrap; pointer-events:none; box-shadow:0 2px 6px rgba(0,0,0,0.6);">${valueText}</div>`
    : ''

  return L.divIcon({
    className: 'custom-ocean-marker',
    html: `
      <div style="position:relative; width:${size}px; height:${size}px; cursor:pointer;">
        ${pulseHtml}
        ${labelBadge}
        <svg width="${size}" height="${size}" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" style="filter: drop-shadow(0 0 8px ${glow});">
          <circle cx="16" cy="16" r="14" fill="rgba(6, 20, 28, 0.85)" stroke="${color}" stroke-width="${isSelected ? '2.5' : '1.8'}" />
          <circle cx="16" cy="16" r="${isSelected ? '7' : '5'}" fill="${color}" />
          <circle cx="16" cy="16" r="2.5" fill="#ffffff" />
        </svg>
      </div>
    `,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    popupAnchor: [0, -size / 2],
  })
}

export function OceanMap({
  selected,
  locations,
  onSelect,
  mode,
  metric: propMetric,
  onMetricChange,
  onMapClick,
  selectedDate = '2026-06-23',
  depth = 0,
  onDepthChange,
  temperatureProfile = [],
  salinityProfile = [],
  onViewProvenance,
}: OceanMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null)
  const mapInstanceRef = useRef<L.Map | null>(null)
  const markersLayerRef = useRef<L.LayerGroup | null>(null)

  const [metric, setMetric] = useState<Metric>(propMetric || 'temperature')

  const handleMetricSwitch = (m: Metric) => {
    setMetric(m)
    onMetricChange?.(m)
  }

  useEffect(() => {
    if (propMetric && propMetric !== metric) {
      setMetric(propMetric)
    }
  }, [propMetric])

  // Initialize native Leaflet Map
  useEffect(() => {
    if (typeof window === 'undefined' || !mapContainerRef.current) return

    // If map already initialized, skip
    if (mapInstanceRef.current) return

    const initialLat = selected.lat ?? 13.0
    const initialLon = selected.lon ?? 77.5

    const map = L.map(mapContainerRef.current, {
      center: [initialLat, initialLon],
      zoom: 4.8,
      zoomSnap: 0.1,
      zoomControl: false,
      attributionControl: false,
    })

    // High quality Esri Ocean/Satellite Base Layer
    L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
      maxZoom: 14,
      minZoom: 2,
    }).addTo(map)

    // Add bathymetry / ocean reference lines layer (optional subtle overlay)
    const markersLayer = L.layerGroup().addTo(map)
    markersLayerRef.current = markersLayer

    // Click on map
    map.on('click', (e: L.LeafletMouseEvent) => {
      if (onMapClick) {
        onMapClick(e.latlng.lat, e.latlng.lng)
      } else {
        onSelect({
          id: `clicked-${e.latlng.lat.toFixed(2)}-${e.latlng.lng.toFixed(2)}`,
          name: `Marine Coordinate (${e.latlng.lat.toFixed(2)}°N, ${e.latlng.lng.toFixed(2)}°E)`,
          region: 'Custom Map Selection',
          x: 50,
          y: 50,
          code: `${e.latlng.lat.toFixed(2)}°, ${e.latlng.lng.toFixed(2)}°`,
          lat: e.latlng.lat,
          lon: e.latlng.lng,
        })
      }
    })

    mapInstanceRef.current = map

    return () => {
      map.remove()
      mapInstanceRef.current = null
      markersLayerRef.current = null
    }
  }, [])

  // Fly to selected station
  useEffect(() => {
    const map = mapInstanceRef.current
    if (!map) return

    if (selected.lat != null && selected.lon != null) {
      map.flyTo([selected.lat, selected.lon], Math.max(map.getZoom(), 4.8), { duration: 0.8 })
    }
  }, [selected.lat, selected.lon])

  // Update markers when selectedDate or metric or selected changes
  useEffect(() => {
    const markersLayer = markersLayerRef.current
    if (!markersLayer) return

    markersLayer.clearLayers()

    // Query real observations from ocean-service for the selected date
    const dateObs = getObservationsForDate(selectedDate, metric)

    if (dateObs.length === 0) {
      // If no observations on this exact date for this metric, fallback to primary station coordinates
      locations.forEach((loc) => {
        if (loc.lat == null || loc.lon == null) return
        const isSelected = loc.id === selected.id
        const icon = getMarkerDivIcon(metric, isSelected)

        const marker = L.marker([loc.lat, loc.lon], { icon })
        marker.on('click', (e) => {
          L.DomEvent.stopPropagation(e)
          onSelect(loc)
        })
        marker.bindTooltip(`
          <div style="font-family:sans-serif; padding:4px 6px; font-size:11px; background:#04131a; color:#fff; border-radius:4px; border:1px solid #21404a;">
            <strong>${loc.name}</strong><br/>
            <span style="color:#ee8e7a;">No observation available for ${selectedDate}</span>
          </div>
        `, { direction: 'top', offset: [0, -14] })

        markersLayer.addLayer(marker)
      })
      return
    }

    // Populate actual observations
    dateObs.forEach((obs) => {
      const isSelected = obs.id === selected.id
      const valDisplay = obs.value != null ? `${obs.value}${obs.unit}` : undefined
      const icon = getMarkerDivIcon(metric, isSelected, valDisplay)

      const marker = L.marker([obs.lat, obs.lon], { icon, zIndexOffset: isSelected ? 1000 : (obs.is_primary ? 500 : 100) })

      marker.on('click', (e) => {
        L.DomEvent.stopPropagation(e)
        const matchedLoc = locations.find((l) => l.id === obs.id) || {
          id: obs.id,
          name: obs.name,
          region: 'Indian Ocean Basin',
          x: 50,
          y: 50,
          code: obs.code,
          lat: obs.lat,
          lon: obs.lon,
        }
        onSelect(matchedLoc)
      })

      const metricColor = metric === 'temperature' ? '#ff4d5a' : metric === 'salinity' ? '#38bdf8' : '#22c55e'
      const metricLabel = metric === 'temperature' ? 'Surface Temperature' : metric === 'salinity' ? 'Surface Salinity' : 'Wind Speed'

      marker.bindTooltip(`
        <div style="font-family:monospace; padding:6px 9px; font-size:11px; background:#031219; color:#f0fdfa; border-radius:6px; border:1px solid #21404a; box-shadow:0 4px 12px rgba(0,0,0,0.8);">
          <strong style="color:#ffffff; font-size:12px; font-family:sans-serif;">${obs.name}</strong><br/>
          <div style="color:#94a3b8; font-size:10px; margin:2px 0 4px;">Lat: ${obs.lat.toFixed(2)}°N · Lon: ${obs.lon.toFixed(2)}°E</div>
          <div style="color:${metricColor}; font-size:13px; font-weight:bold; margin-bottom:3px;">
            ${metricLabel}: ${obs.value != null ? `${obs.value} ${obs.unit}` : 'No data'}
          </div>
          <div style="color:#64748b; font-size:9px;">
            Date: ${obs.date} · Depth: ${obs.depth_m}m · Source: Copernicus
          </div>
        </div>
      `, { direction: 'top', offset: [0, -16] })

      markersLayer.addLayer(marker)
    })

    // If a custom coordinate was clicked, render an active target marker showing Ocean vs Land status
    if (selected.id.startsWith('clicked-') && selected.lat != null && selected.lon != null) {
      const isOcean = isOceanCoordinate(selected.lat, selected.lon)
      const targetColor = isOcean ? '#06b6d4' : '#ef4444'
      const icon = L.divIcon({
        className: 'custom-clicked-marker',
        html: `
          <div style="position:relative; width:30px; height:30px; cursor:pointer;">
            <div style="position:absolute; width:40px; height:40px; top:-5px; left:-5px; border-radius:50%; border:2px dashed ${targetColor}; animation:pulse-glow 1.6s infinite;"></div>
            <svg width="30" height="30" viewBox="0 0 32 32" fill="none" style="filter: drop-shadow(0 0 10px ${targetColor});">
              <circle cx="16" cy="16" r="13" fill="rgba(4, 16, 22, 0.95)" stroke="${targetColor}" stroke-width="2.5" />
              <circle cx="16" cy="16" r="6" fill="${targetColor}" />
              <circle cx="16" cy="16" r="2" fill="#ffffff" />
            </svg>
          </div>
        `,
        iconSize: [30, 30],
        iconAnchor: [15, 15],
      })
      const clickedMarker = L.marker([selected.lat, selected.lon], { icon })
      clickedMarker.bindTooltip(`
        <div style="font-family:sans-serif; padding:6px 10px; font-size:11px; background:#04131a; color:#fff; border-radius:6px; border:1px solid ${isOcean ? '#164e63' : '#7f1d1d'}; box-shadow:0 4px 12px rgba(0,0,0,0.8);">
          <strong style="color:${targetColor}; font-size:12px;">${isOcean ? '🌊 Marine Coordinate' : '🏜️ Land Coordinate'}</strong><br/>
          <div style="color:#94a3b8; font-size:10px; margin:2px 0 4px;">(${selected.lat.toFixed(2)}°N, ${selected.lon.toFixed(2)}°E)</div>
          <span style="color:${isOcean ? '#67e8f9' : '#fca5a5'}; font-size:10px; line-height:1.4; display:block;">
            ${isOcean ? 'Verified ocean body — Active marine observation' : '⚠️ Land Point: The Copernicus Marine dataset strictly covers oceanic water. Land contains no ocean measurements.'}
          </span>
        </div>
      `, { direction: 'top', offset: [0, -16] }).openTooltip()
      markersLayer.addLayer(clickedMarker)
    }
  }, [selectedDate, metric, selected.id, selected.lat, selected.lon, locations])

  return (
    <div className={`ocean-map live-map ${mode === '3D' ? 'ocean-map-3d' : ''}`}>
      {mode === '2D' && (
        <div className="map-layer-control">
          <strong>Active Layer: Surface (0.49 m)</strong>
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
        <div
          ref={mapContainerRef}
          style={{ width: '100%', height: '100%', minHeight: '440px', background: '#020b10' }}
          className="leaflet-map"
          aria-label="OceanEmbed authentic observation map of the Indian Ocean"
        />
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
          argoProfiles={[]}
          onViewProvenance={onViewProvenance}
        />
      )}

      {mode === '2D' && (
        <div className="map-legend">
          {metric === 'temperature' && (
            <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#ef4444', boxShadow: '0 0 8px #ef4444', display: 'inline-block' }} />
              <strong style={{ color: '#ff4d5a' }}>● Red = Real Surface Temperature (°C)</strong>
              <span style={{ color: '#709094', marginLeft: '6px' }}>· CMEMS GLORYS Reanalysis (Observed at 0.49 m)</span>
            </span>
          )}
          {metric === 'salinity' && (
            <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#38bdf8', boxShadow: '0 0 8px #38bdf8', display: 'inline-block' }} />
              <strong style={{ color: '#38bdf8' }}>● Blue = Real Surface Salinity (PSU)</strong>
              <span style={{ color: '#709094', marginLeft: '6px' }}>· CMEMS Physical Multi-Year (Observed at 0.49 m)</span>
            </span>
          )}
          {metric === 'wind' && (
            <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#22c55e', boxShadow: '0 0 8px #22c55e', display: 'inline-block' }} />
              <strong style={{ color: '#22c55e' }}>● Green = Real Satellite Wind (m/s)</strong>
              <span style={{ color: '#709094', marginLeft: '6px' }}>· HY-2C Satellite Scatterometer at 10 m</span>
            </span>
          )}
        </div>
      )}
    </div>
  )
}

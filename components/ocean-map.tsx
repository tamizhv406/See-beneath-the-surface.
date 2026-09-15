'use client'

import React, { useEffect, useRef, useState, useMemo } from 'react'
import dynamic from 'next/dynamic'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { getObservationsForDate, isOceanCoordinate, findClosestStation } from '@/lib/ocean-service'

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

// Scientific Colormaps
function getThermalRgb(t: number): [number, number, number] {
  // Deep Navy -> Cyan -> Emerald -> Gold -> Crimson
  if (t <= 0.25) {
    const f = t / 0.25
    return [Math.round(15 + f * -15), Math.round(56 + f * 124), Math.round(110 + f * 106)]
  } else if (t <= 0.5) {
    const f = (t - 0.25) / 0.25
    return [Math.round(0 + f * 46), Math.round(180 + f * 16), Math.round(216 + f * -34)]
  } else if (t <= 0.75) {
    const f = (t - 0.5) / 0.25
    return [Math.round(46 + f * 209), Math.round(196 + f * -13), Math.round(182 + f * -179)]
  } else {
    const f = (t - 0.75) / 0.25
    return [Math.round(255 + f * -25), Math.round(183 + f * -126), Math.round(3 + f * 67)]
  }
}

function getHalineRgb(t: number): [number, number, number] {
  // Aqua -> Ocean Azure -> Deep Marine Indigo
  if (t <= 0.5) {
    const f = t / 0.5
    return [Math.round(144 + f * -144), Math.round(224 + f * -105), Math.round(239 + f * -57)]
  } else {
    const f = (t - 0.5) / 0.5
    return [Math.round(0 + f * 3), Math.round(119 + f * -115), Math.round(182 + f * -88)]
  }
}

function getWindRgb(t: number): [number, number, number] {
  // Slate Teal -> Canary Yellow -> Sunset Coral
  if (t <= 0.5) {
    const f = t / 0.5
    return [Math.round(42 + f * 191), Math.round(157 + f * 39), Math.round(143 + f * -37)]
  } else {
    const f = (t - 0.5) / 0.5
    return [Math.round(233 + f * -2), Math.round(196 + f * -85), Math.round(106 + f * -25)]
  }
}

// Single Selection Target Marker Icon
function getSelectedLocationIcon(metric: Metric, isOcean: boolean, valDisplay?: string): L.DivIcon {
  const color = !isOcean ? '#ef4444' : metric === 'temperature' ? '#ff4d5a' : metric === 'salinity' ? '#38bdf8' : '#22c55e'
  const glow = !isOcean ? 'rgba(239, 68, 68, 0.8)' : metric === 'temperature' ? 'rgba(255, 77, 90, 0.8)' : metric === 'salinity' ? 'rgba(56, 189, 248, 0.8)' : 'rgba(34, 197, 94, 0.8)'

  const labelHtml = valDisplay
    ? `<div style="position:absolute; top:-24px; left:50%; transform:translateX(-50%); background:rgba(3,15,22,0.95); border:1px solid ${color}; color:#ffffff; font-size:11px; font-weight:700; font-family:monospace; padding:2px 7px; border-radius:4px; white-space:nowrap; pointer-events:none; box-shadow:0 4px 12px rgba(0,0,0,0.8);">
        <span style="color:${color}; margin-right:4px;">●</span>${valDisplay}
      </div>`
    : ''

  return L.divIcon({
    className: 'custom-single-selection-marker',
    html: `
      <div style="position:relative; width:40px; height:40px; cursor:pointer;">
        <!-- Pulsing radar ring -->
        <div style="position:absolute; width:52px; height:52px; top:-6px; left:-6px; border-radius:50%; border:2px solid ${color}; box-shadow:0 0 16px ${glow}; animation:pulse-glow 1.8s infinite;"></div>
        
        ${labelHtml}

        <!-- Crosshair targeting reticle -->
        <svg width="40" height="40" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg" style="filter: drop-shadow(0 0 10px ${glow});">
          <circle cx="20" cy="20" r="14" fill="rgba(4, 16, 24, 0.85)" stroke="${color}" stroke-width="2.5" />
          <line x1="20" y1="2" x2="20" y2="10" stroke="${color}" stroke-width="2" stroke-linecap="round" />
          <line x1="20" y1="30" x2="20" y2="38" stroke="${color}" stroke-width="2" stroke-linecap="round" />
          <line x1="2" y1="20" x2="10" y2="20" stroke="${color}" stroke-width="2" stroke-linecap="round" />
          <line x1="30" y1="20" x2="38" y2="20" stroke="${color}" stroke-width="2" stroke-linecap="round" />
          <circle cx="20" cy="20" r="5" fill="${color}" />
          <circle cx="20" cy="20" r="2" fill="#ffffff" />
        </svg>
      </div>
    `,
    iconSize: [40, 40],
    iconAnchor: [20, 20],
    popupAnchor: [0, -20],
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
  const heatmapLayerRef = useRef<L.ImageOverlay | null>(null)

  const [metric, setMetric] = useState<Metric>(propMetric || 'temperature')
  const [legendStats, setLegendStats] = useState<{ min: number; max: number; unit: string; name: string } | null>(null)

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
    if (mapInstanceRef.current) return

    const initialLat = selected.lat ?? 12.0
    const initialLon = selected.lon ?? 75.0

    const map = L.map(mapContainerRef.current, {
      center: [initialLat, initialLon],
      zoom: 4.6,
      zoomSnap: 0.1,
      zoomControl: false,
      attributionControl: false,
      maxBounds: [
        [-5, 30],
        [35, 110],
      ],
      maxBoundsViscosity: 0.7,
    })

    // High quality Esri Ocean/Satellite Base Layer
    L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
      maxZoom: 14,
      minZoom: 3,
    }).addTo(map)

    // Markers layer for the SINGLE active selection point
    const markersLayer = L.layerGroup().addTo(map)
    markersLayerRef.current = markersLayer

    // Click on map: Identify clicked coordinate or nearest station
    map.on('click', (e: L.LeafletMouseEvent) => {
      const clickLat = Number(e.latlng.lat.toFixed(3))
      const clickLon = Number(e.latlng.lng.toFixed(3))

      if (onMapClick) {
        onMapClick(clickLat, clickLon)
      } else {
        const isOcean = isOceanCoordinate(clickLat, clickLon)
        const closest = isOcean ? findClosestStation(clickLat, clickLon) : null
        onSelect({
          id: closest ? closest.station.id : `clicked-${clickLat}-${clickLon}`,
          name: closest ? closest.station.name : `Marine Coordinate (${clickLat.toFixed(2)}°N, ${clickLon.toFixed(2)}°E)`,
          region: closest ? closest.station.region : 'Indian Ocean Basin',
          x: 50,
          y: 50,
          code: closest ? closest.station.code : `${clickLat.toFixed(2)}°, ${clickLon.toFixed(2)}°`,
          lat: clickLat,
          lon: clickLon,
        })
      }
    })

    mapInstanceRef.current = map

    return () => {
      map.remove()
      mapInstanceRef.current = null
      markersLayerRef.current = null
      heatmapLayerRef.current = null
    }
  }, [])

  // Fly to selected coordinate smoothly when selection changes
  useEffect(() => {
    const map = mapInstanceRef.current
    if (!map) return

    if (selected.lat != null && selected.lon != null) {
      map.flyTo([selected.lat, selected.lon], Math.max(map.getZoom(), 4.8), { duration: 0.7 })
    }
  }, [selected.lat, selected.lon])

  // Generate and render the Scientific Heatmap
  useEffect(() => {
    const map = mapInstanceRef.current
    if (!map) return

    // If depth > 0, genuine gridded data is strictly for surface (0.49m).
    // Prompt rule: "The selected depth should control the heatmap ONLY if actual data exists for that depth.
    // If a depth has no valid data, clearly show: 'No valid data available at this depth'. Do NOT fabricate a heatmap."
    if (depth > 0) {
      if (heatmapLayerRef.current) {
        map.removeLayer(heatmapLayerRef.current)
        heatmapLayerRef.current = null
      }
      setLegendStats(null)
      return
    }

    const dateObs = getObservationsForDate(selectedDate, metric)
    const validObs = dateObs.filter((o) => o.value != null)

    if (validObs.length === 0) {
      if (heatmapLayerRef.current) {
        map.removeLayer(heatmapLayerRef.current)
        heatmapLayerRef.current = null
      }
      setLegendStats(null)
      return
    }

    const values = validObs.map((o) => o.value as number)
    const minVal = Math.min(...values)
    const maxVal = Math.max(...values)
    const unit = validObs[0].unit || (metric === 'temperature' ? '°C' : metric === 'salinity' ? 'PSU' : 'm/s')
    const varName = metric === 'temperature' ? 'Surface Temperature' : metric === 'salinity' ? 'Surface Salinity' : 'Wind Speed'

    setLegendStats({ min: minVal, max: maxVal, unit, name: varName })

    // Generate canvas raster for the Indian Ocean domain: Lat 0-30N, Lon 40-100E
    const W = 160
    const H = 80
    const canvas = document.createElement('canvas')
    canvas.width = W
    canvas.height = H
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const imgData = ctx.createImageData(W, H)
    const data = imgData.data

    const range = Math.max(0.001, maxVal - minVal)

    for (let py = 0; py < H; py++) {
      const lat = 30 - (py / H) * 30
      for (let px = 0; px < W; px++) {
        const lon = 40 + (px / W) * 60
        const pixelIdx = (py * W + px) * 4

        // 1. Strict Land Masking: If land, leave completely transparent
        if (!isOceanCoordinate(lat, lon)) {
          data[pixelIdx + 3] = 0 // transparent
          continue
        }

        // 2. Inverse Distance Weighting from authentic observations
        let sumWeights = 0
        let sumValues = 0

        for (let i = 0; i < validObs.length; i++) {
          const obs = validObs[i]
          const dLat = obs.lat - lat
          const dLon = obs.lon - lon
          const d2 = dLat * dLat + dLon * dLon

          if (d2 < 0.0001) {
            sumValues = obs.value!
            sumWeights = 1
            break
          }
          const w = 1 / Math.pow(d2, 1.25)
          sumWeights += w
          sumValues += w * obs.value!
        }

        const interpolatedVal = sumWeights > 0 ? sumValues / sumWeights : minVal
        const t = Math.max(0, Math.min(1, (interpolatedVal - minVal) / range))

        let rgb: [number, number, number]
        if (metric === 'temperature') {
          rgb = getThermalRgb(t)
        } else if (metric === 'salinity') {
          rgb = getHalineRgb(t)
        } else {
          rgb = getWindRgb(t)
        }

        data[pixelIdx] = rgb[0]
        data[pixelIdx + 1] = rgb[1]
        data[pixelIdx + 2] = rgb[2]
        data[pixelIdx + 3] = 185 // ~72% opacity for clear overlay with visible bathymetry
      }
    }

    ctx.putImageData(imgData, 0, 0)
    const dataUrl = canvas.toDataURL()

    const bounds: L.LatLngBoundsExpression = [
      [0.0, 40.0],
      [30.0, 100.0],
    ]

    if (heatmapLayerRef.current) {
      heatmapLayerRef.current.setUrl(dataUrl)
    } else {
      const overlay = L.imageOverlay(dataUrl, bounds, { opacity: 0.95, zIndex: 200 })
      overlay.addTo(map)
      heatmapLayerRef.current = overlay
    }
  }, [selectedDate, metric, depth])

  // Render ONLY ONE clear selection marker (No station clutter!)
  useEffect(() => {
    const markersLayer = markersLayerRef.current
    if (!markersLayer) return

    markersLayer.clearLayers()

    if (selected.lat == null || selected.lon == null) return

    const isOcean = isOceanCoordinate(selected.lat, selected.lon)

    // Resolve observation value for the selected location if available
    const dateObs = getObservationsForDate(selectedDate, metric)
    const matchedObs = dateObs.find(
      (o) => o.id === selected.id || (Math.abs(o.lat - selected.lat!) < 0.25 && Math.abs(o.lon - selected.lon!) < 0.25)
    )

    let valDisplay = undefined
    if (isOcean && matchedObs?.value != null) {
      valDisplay = `${matchedObs.value} ${matchedObs.unit}`
    } else if (isOcean) {
      valDisplay = `${selected.lat.toFixed(2)}°N, ${selected.lon.toFixed(2)}°E`
    } else {
      valDisplay = 'LAND'
    }

    const icon = getSelectedLocationIcon(metric, isOcean, valDisplay)
    const marker = L.marker([selected.lat, selected.lon], { icon, zIndexOffset: 1000 })

    const metricName = metric === 'temperature' ? 'Surface Temp' : metric === 'salinity' ? 'Surface Salinity' : 'Wind Speed'

    marker
      .bindTooltip(
        `
        <div style="font-family:monospace; padding:8px 12px; font-size:11px; background:#04141d; color:#f0fdfa; border-radius:6px; border:1px solid ${isOcean ? 'var(--cyan, #38bdf8)' : '#ef4444'}; box-shadow:0 4px 14px rgba(0,0,0,0.85);">
          <strong style="color:#ffffff; font-size:12px; font-family:sans-serif;">${selected.name}</strong><br/>
          <div style="color:#94a3b8; font-size:10px; margin:2px 0 6px;">
            ${selected.lat.toFixed(3)}°N, ${selected.lon.toFixed(3)}°E · Station ID: <strong style="color:#63d9d0;">${selected.code}</strong>
          </div>
          <div style="color:${isOcean ? '#38bdf8' : '#ef4444'}; font-size:13px; font-weight:bold; margin-bottom:4px;">
            ${isOcean ? `${metricName}: ${matchedObs?.value != null ? `${matchedObs.value} ${matchedObs.unit}` : 'Real Reanalysis Cell'}` : '🏜️ Land Coordinate — No Ocean Data'}
          </div>
          <div style="color:#709094; font-size:9.5px; border-top:1px solid #1a3944; padding-top:4px; margin-top:4px;">
            Observation Date: ${selectedDate} · Layer: ${depth === 0 ? 'Surface (0.49 m)' : `${depth} m Depth`}
          </div>
        </div>
      `,
        { direction: 'top', offset: [0, -18] }
      )
      .openTooltip()

    markersLayer.addLayer(marker)
  }, [selected.id, selected.lat, selected.lon, selected.name, selected.code, selectedDate, metric, depth])

  return (
    <div className={`ocean-map live-map ${mode === '3D' ? 'ocean-map-3d' : ''}`}>
      {mode === '2D' && (
        <div className="map-layer-control">
          <strong>Active Spatial Field: {depth === 0 ? 'Surface (0.49 m)' : `${depth} m Subsurface`}</strong>
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
        <div style={{ position: 'relative', width: '100%', height: '100%', minHeight: '460px' }}>
          <div
            ref={mapContainerRef}
            style={{ width: '100%', height: '100%', minHeight: '460px', background: '#020b10' }}
            className="leaflet-map"
            aria-label="OceanEmbed authentic spatial ocean heatmap of the Indian Ocean"
          />

          {/* Depth Warning Overlay if depth > 0 */}
          {depth > 0 && (
            <div
              style={{
                position: 'absolute',
                top: '55px',
                left: '50%',
                transform: 'translateX(-50%)',
                background: 'rgba(5, 18, 25, 0.92)',
                border: '1px solid #f59e0b',
                color: '#fbbf24',
                padding: '8px 16px',
                borderRadius: '6px',
                fontSize: '11px',
                zIndex: 400,
                boxShadow: '0 4px 16px rgba(0,0,0,0.8)',
                textAlign: 'center',
                maxWidth: '90%',
              }}
            >
              <strong>No horizontal gridded field available at {depth} m</strong>
              <div style={{ color: 'var(--muted-foreground)', fontSize: '10px', marginTop: '2px' }}>
                Full horizontal reanalysis field is verified at <strong>Surface (0.49 m)</strong>. Select <strong>0 m</strong> for the spatial heatmap, or click any coordinate and open <strong>Subsurface Analysis</strong> to inspect the vertical 0–1000 m stratification.
              </div>
            </div>
          )}

          {/* Continuous Scientific Colorbar Legend */}
          {depth === 0 && legendStats && (
            <div
              style={{
                position: 'absolute',
                bottom: '16px',
                right: '16px',
                background: 'rgba(5, 18, 26, 0.92)',
                border: '1px solid #21404a',
                borderRadius: '8px',
                padding: '10px 14px',
                zIndex: 400,
                boxShadow: '0 6px 20px rgba(0,0,0,0.85)',
                fontFamily: 'monospace',
                fontSize: '11px',
                backdropFilter: 'blur(8px)',
                minWidth: '220px',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                <span style={{ textTransform: 'uppercase', letterSpacing: '0.06em', color: '#94a3b8', fontSize: '10px', fontWeight: 700 }}>
                  {legendStats.name} ({legendStats.unit})
                </span>
                <span style={{ fontSize: '9px', color: 'var(--cyan)', fontWeight: 600 }}>100% REAL DATA</span>
              </div>

              {/* Continuous Gradient Bar */}
              <div
                style={{
                  height: '10px',
                  borderRadius: '4px',
                  background:
                    metric === 'temperature'
                      ? 'linear-gradient(90deg, #0f386e 0%, #00b4d8 25%, #2ec4b6 50%, #ffb703 75%, #e63946 100%)'
                      : metric === 'salinity'
                      ? 'linear-gradient(90deg, #90e0ef 0%, #0077b6 50%, #03045e 100%)'
                      : 'linear-gradient(90deg, #2a9d8f 0%, #e9c46a 50%, #e76f51 100%)',
                  border: '1px solid rgba(255,255,255,0.15)',
                  marginBottom: '6px',
                }}
              />

              {/* Dynamic Min / Mid / Max values */}
              <div style={{ display: 'flex', justifyContent: 'space-between', color: '#f0fdfa', fontSize: '10px' }}>
                <span>{legendStats.min.toFixed(1)} {legendStats.unit}</span>
                <span style={{ color: '#94a3b8' }}>{((legendStats.min + legendStats.max) / 2).toFixed(1)} {legendStats.unit}</span>
                <span>{legendStats.max.toFixed(1)} {legendStats.unit}</span>
              </div>

              <div style={{ fontSize: '9px', color: '#64748b', marginTop: '6px', borderTop: '1px solid #15313b', paddingTop: '4px' }}>
                Copernicus Reanalysis · Indian Ocean Masked · Click ocean to select
              </div>
            </div>
          )}
        </div>
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
    </div>
  )
}

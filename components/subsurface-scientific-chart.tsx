'use client'

import React, { useState, useMemo } from 'react'

export type ProfilePoint = {
  depth: number
  temperature?: number | null
  salinity?: number | null
}

export type UncertaintyPoint = {
  depth: number
  lower: number
  upper: number
}

export interface ArgoFloatInfo {
  platform: string | number
  cycle?: string | number
  distanceKm?: number
}

interface SubsurfaceScientificChartProps {
  locationName: string
  locationCode: string
  lat: number | null
  lon: number | null
  date: string
  depth: number
  onDepthChange?: (depth: number) => void
  observedSurfaceTemp?: number | null
  observedSurfaceSal?: number | null
  reanalysisProfile: ProfilePoint[]
  aiProfile: ProfilePoint[]
  tempUncertainty?: UncertaintyPoint[]
  salUncertainty?: UncertaintyPoint[]
  argoObservedPoints?: ProfilePoint[]
  argoFloatInfo?: ArgoFloatInfo | null
  sourceDescription?: string
  isNoData?: boolean
  onSwitchStation?: () => void
}

export function SubsurfaceScientificChart({
  locationName,
  locationCode,
  lat,
  lon,
  date,
  depth,
  onDepthChange,
  observedSurfaceTemp,
  observedSurfaceSal,
  reanalysisProfile = [],
  aiProfile = [],
  tempUncertainty = [],
  salUncertainty = [],
  argoObservedPoints = [],
  argoFloatInfo,
  sourceDescription,
  isNoData = false,
  onSwitchStation,
}: SubsurfaceScientificChartProps) {
  // Mode toggles
  const [variable, setVariable] = useState<'temperature' | 'salinity'>('temperature')
  const [chartMode, setChartMode] = useState<'profile' | 'anomaly'>('profile')
  const [hoveredDepth, setHoveredDepth] = useState<number | null>(null)
  const [selectedDepthPoint, setSelectedDepthPoint] = useState<number | null>(null)

  const isTemp = variable === 'temperature'
  const unit = isTemp ? '°C' : 'PSU'

  // Dimensions
  const chartWidth = 840
  const chartHeight = 420
  const padding = { top: 40, right: 35, bottom: 65, left: 70 }
  const plotWidth = chartWidth - padding.left - padding.right
  const plotHeight = chartHeight - padding.top - padding.bottom

  // Map depth (0 to 1000m) to X-coordinate using oceanographic non-linear scale (sqrt)
  const mapDepthToX = (d: number): number => {
    const clamped = Math.max(0, Math.min(1000, d))
    const fraction = Math.sqrt(clamped) / Math.sqrt(1000)
    return padding.left + fraction * plotWidth
  }

  // Inverse: Map X to closest depth
  const mapXToDepth = (x: number): number => {
    const fraction = Math.max(0, Math.min(1, (x - padding.left) / plotWidth))
    return Math.round(Math.pow(fraction * Math.sqrt(1000), 2))
  }

  // Salinity availability check
  const hasAiSalinity = useMemo(() => {
    if (isTemp) return aiProfile.some((p) => p.temperature != null)
    return aiProfile.some((p) => p.salinity != null)
  }, [isTemp, aiProfile])

  // Extract all valid depth values from authentic profiles
  const allDepths = useMemo(() => {
    const depthSet = new Set<number>()
    ;[...reanalysisProfile, ...aiProfile, ...argoObservedPoints].forEach((p) => {
      if (typeof p.depth === 'number') depthSet.add(p.depth)
    })
    if (observedSurfaceTemp != null || observedSurfaceSal != null) {
      depthSet.add(0)
    }
    return Array.from(depthSet).sort((a, b) => a - b)
  }, [reanalysisProfile, aiProfile, argoObservedPoints, observedSurfaceTemp, observedSurfaceSal])

  // Check if any valid data exists for the selected station
  const hasValidData = useMemo(() => {
    if (isNoData) return false
    const hasAi = isTemp
      ? aiProfile.some((p) => p.temperature != null)
      : aiProfile.some((p) => p.salinity != null)
    const hasReanal = isTemp
      ? reanalysisProfile.some((p) => p.temperature != null)
      : reanalysisProfile.some((p) => p.salinity != null)
    const hasObs = isTemp ? observedSurfaceTemp != null : observedSurfaceSal != null
    return hasAi || hasReanal || hasObs || argoObservedPoints.length > 0
  }, [isNoData, isTemp, aiProfile, reanalysisProfile, observedSurfaceTemp, observedSurfaceSal, argoObservedPoints])

  // Compute domain min & max for Y-Axis
  const yDomain = useMemo(() => {
    if (chartMode === 'anomaly') {
      return { min: -3.0, max: 3.0 }
    }

    let min = Infinity
    let max = -Infinity

    reanalysisProfile.forEach((p) => {
      const val = isTemp ? p.temperature : p.salinity
      if (typeof val === 'number') {
        if (val < min) min = val
        if (val > max) max = val
      }
    })

    aiProfile.forEach((p) => {
      const val = isTemp ? p.temperature : p.salinity
      if (typeof val === 'number') {
        if (val < min) min = val
        if (val > max) max = val
      }
    })

    if (isTemp && typeof observedSurfaceTemp === 'number') {
      if (observedSurfaceTemp < min) min = observedSurfaceTemp
      if (observedSurfaceTemp > max) max = observedSurfaceTemp
    }
    if (!isTemp && typeof observedSurfaceSal === 'number') {
      if (observedSurfaceSal < min) min = observedSurfaceSal
      if (observedSurfaceSal > max) max = observedSurfaceSal
    }

    argoObservedPoints.forEach((p) => {
      const val = isTemp ? p.temperature : p.salinity
      if (typeof val === 'number') {
        if (val < min) min = val
        if (val > max) max = val
      }
    })

    if (!isFinite(min) || !isFinite(max)) {
      return isTemp ? { min: 0, max: 32 } : { min: 32, max: 37 }
    }

    const pad = Math.max(0.5, (max - min) * 0.1)
    return {
      min: Math.floor((min - pad) * 2) / 2,
      max: Math.ceil((max + pad) * 2) / 2,
    }
  }, [isTemp, chartMode, reanalysisProfile, aiProfile, observedSurfaceTemp, observedSurfaceSal, argoObservedPoints])

  // Map value to Y-coordinate
  const mapValueToY = (val: number): number => {
    const range = yDomain.max - yDomain.min || 1
    const fraction = (val - yDomain.min) / range
    return padding.top + (1 - fraction) * plotHeight
  }

  // Y = 0 coordinate for Anomaly mode
  const yZeroCoord = useMemo(() => {
    if (chartMode !== 'anomaly') return null
    return mapValueToY(0)
  }, [chartMode, yDomain])

  // Y-axis ticks
  const yTicks = useMemo(() => {
    if (chartMode === 'anomaly') {
      return [-3, -2, -1, 0, 1, 2, 3]
    }
    const step = isTemp ? (yDomain.max - yDomain.min > 15 ? 5 : 2) : 0.5
    const ticks: number[] = []
    const start = Math.ceil(yDomain.min / step) * step
    for (let v = start; v <= yDomain.max + 0.001; v += step) {
      ticks.push(Number(v.toFixed(1)))
    }
    return ticks
  }, [chartMode, yDomain, isTemp])

  // Standard Depth reference ticks for X-Axis
  const depthTicks = [0, 50, 100, 200, 500, 1000]

  // Resolved values helper function for a specific depth
  const getValuesAtDepth = (targetD: number) => {
    if (allDepths.length === 0) return null

    // Find exact or closest available depth
    let closestD = allDepths[0]
    let minDiff = Infinity
    for (const d of allDepths) {
      const diff = Math.abs(d - targetD)
      if (diff < minDiff) {
        minDiff = diff
        closestD = d
      }
    }

    const reanalPt = reanalysisProfile.find((p) => p.depth === closestD)
    const aiPt = aiProfile.find((p) => p.depth === closestD)
    const argoPt = argoObservedPoints.find((p) => p.depth === closestD)

    const reanalVal = isTemp ? reanalPt?.temperature : reanalPt?.salinity
    const aiVal = isTemp ? aiPt?.temperature : aiPt?.salinity

    // Observed measurement: strictly genuine surface observation or in-situ Argo
    let obsVal: number | null = null
    if (closestD === 0 || closestD < 1) {
      obsVal = isTemp ? (observedSurfaceTemp ?? null) : (observedSurfaceSal ?? null)
    } else if (argoPt) {
      obsVal = isTemp ? (argoPt.temperature ?? null) : (argoPt.salinity ?? null)
    }

    let diff: number | null = null
    if (aiVal != null && reanalVal != null) {
      diff = Number((aiVal - reanalVal).toFixed(2))
    } else if (aiVal != null && obsVal != null) {
      diff = Number((aiVal - obsVal).toFixed(2))
    }

    return {
      depth: closestD,
      reanalysis: typeof reanalVal === 'number' ? reanalVal : null,
      ai: typeof aiVal === 'number' ? aiVal : null,
      observed: typeof obsVal === 'number' ? obsVal : null,
      diff,
    }
  }

  // Hovered depth data
  const hoveredData = useMemo(() => {
    if (hoveredDepth == null) return null
    return getValuesAtDepth(hoveredDepth)
  }, [hoveredDepth, allDepths, reanalysisProfile, aiProfile, argoObservedPoints, isTemp, observedSurfaceTemp, observedSurfaceSal])

  // Selected depth data (clicked or active)
  const activeSelectedDepth = selectedDepthPoint != null ? selectedDepthPoint : depth
  const selectedData = useMemo(() => {
    return getValuesAtDepth(activeSelectedDepth)
  }, [activeSelectedDepth, allDepths, reanalysisProfile, aiProfile, argoObservedPoints, isTemp, observedSurfaceTemp, observedSurfaceSal])

  // Data status availability flags
  const observedStatus = useMemo(() => {
    if (isTemp && observedSurfaceTemp != null) {
      return argoObservedPoints.length > 1
        ? `Available (Surface + ${argoObservedPoints.length} In-situ Points)`
        : 'Available (Surface 0.49m Observation)'
    }
    if (!isTemp && observedSurfaceSal != null) {
      return argoObservedPoints.length > 1
        ? `Available (Surface + ${argoObservedPoints.length} In-situ Points)`
        : 'Available (Surface 0.49m Observation)'
    }
    return 'Not Available'
  }, [isTemp, observedSurfaceTemp, observedSurfaceSal, argoObservedPoints])

  const aiStatus = useMemo(() => {
    if (isTemp && aiProfile.some((p) => p.temperature != null)) {
      return 'Available (0–1000m Reconstruction)'
    }
    if (!isTemp && aiProfile.some((p) => p.salinity != null)) {
      return 'Available (0–1000m Reconstruction)'
    }
    return 'Not Available'
  }, [isTemp, aiProfile])

  const glorysStatus = useMemo(() => {
    if (isTemp && reanalysisProfile.some((p) => p.temperature != null)) {
      return 'Available (Copernicus GLORYS12V1)'
    }
    if (!isTemp && reanalysisProfile.some((p) => p.salinity != null)) {
      return 'Available (Copernicus GLORYS12V1)'
    }
    return 'Not Available'
  }, [isTemp, reanalysisProfile])

  const argoStatus = useMemo(() => {
    if (argoFloatInfo?.platform) {
      return `Available (Float #${argoFloatInfo.platform}${argoFloatInfo.distanceKm ? ` · ${argoFloatInfo.distanceKm} km` : ''})`
    }
    if (argoObservedPoints.length > 1) {
      return 'Available (In-situ CTD Array)'
    }
    return 'Not Available'
  }, [argoFloatInfo, argoObservedPoints])

  // If no valid data is available, render clean No Data state according to Requirement 17
  if (!hasValidData) {
    return (
      <div
        className="subsurface-scientific-container"
        style={{
          background: '#ffffff',
          border: '1px solid #d1d5db',
          borderRadius: '10px',
          padding: '48px 32px',
          color: '#111827',
          boxShadow: '0 4px 20px rgba(0, 0, 0, 0.08)',
          fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
          marginBottom: '24px',
          textAlign: 'center',
        }}
      >
        <div
          style={{
            width: '56px',
            height: '56px',
            borderRadius: '50%',
            background: '#fee2e2',
            color: '#dc2626',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '24px',
            marginBottom: '16px',
          }}
        >
          ⚠️
        </div>
        <h2 style={{ fontSize: '22px', fontWeight: 800, color: '#111827', margin: '0 0 10px', letterSpacing: '-0.02em' }}>
          NO VALID PROFILE DATA
        </h2>
        <p style={{ color: '#4b5563', fontSize: '14px', maxWidth: '580px', margin: '0 auto 24px', lineHeight: '1.6' }}>
          Valid OceanEmbed reconstruction or reference data is not available for the selected location/date.
        </p>
        {onSwitchStation && (
          <button
            type="button"
            onClick={onSwitchStation}
            style={{
              background: '#0284c7',
              color: '#ffffff',
              border: 'none',
              padding: '10px 22px',
              borderRadius: '6px',
              fontSize: '13px',
              fontWeight: 700,
              cursor: 'pointer',
              boxShadow: '0 2px 8px rgba(2, 132, 199, 0.3)',
            }}
          >
            Switch to Active Marine Station
          </button>
        )}
      </div>
    )
  }

  return (
    <div
      className="subsurface-scientific-container"
      id="subsurface-white-graph-container"
      style={{
        background: '#ffffff',
        border: '1px solid #d1d5db',
        borderRadius: '10px',
        padding: '24px 28px',
        color: '#111827',
        boxShadow: '0 6px 25px rgba(0, 0, 0, 0.12)',
        fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        marginBottom: '24px',
      }}
    >
      {/* 1. Header Information Bar (Requirements 2 & 10) */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          flexWrap: 'wrap',
          gap: '16px',
          borderBottom: '1px solid #e5e7eb',
          paddingBottom: '16px',
          marginBottom: '16px',
        }}
      >
        <div>
          <h2
            style={{
              margin: 0,
              fontSize: '22px',
              fontWeight: 800,
              color: '#111827',
              letterSpacing: '-0.02em',
            }}
          >
            {isTemp ? 'SUBSURFACE TEMPERATURE PROFILE' : 'SUBSURFACE SALINITY PROFILE'}
          </h2>
          <div
            style={{
              fontSize: '12px',
              color: '#374151',
              marginTop: '6px',
              fontFamily: 'monospace',
              display: 'flex',
              flexWrap: 'wrap',
              gap: '14px',
              lineHeight: '1.5',
            }}
          >
            <span>
              <strong>Location:</strong> {lat != null ? `${Math.abs(lat).toFixed(3)}°${lat >= 0 ? 'N' : 'S'}` : '—'},{' '}
              {lon != null ? `${Math.abs(lon).toFixed(3)}°${lon >= 0 ? 'E' : 'W'}` : '—'}
            </span>
            <span>
              <strong>Station:</strong> {locationCode || locationName}
            </span>
            <span>
              <strong>Date:</strong> {date}
            </span>
            <span>
              <strong>Depth Range:</strong> 0–1000 m
            </span>
            <span>
              <strong>Variable:</strong> {isTemp ? 'Temperature (°C)' : 'Salinity (PSU)'}
            </span>
          </div>
        </div>

        {/* Mode Controls: Temperature / Salinity & Profile / Anomaly (Requirements 14 & 15) */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', alignItems: 'flex-end' }}>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            {/* Variable Selector */}
            <div
              style={{
                display: 'inline-flex',
                background: '#f3f4f6',
                border: '1px solid #d1d5db',
                borderRadius: '6px',
                padding: '2px',
              }}
            >
              <button
                type="button"
                id="btn-toggle-temp"
                onClick={() => setVariable('temperature')}
                style={{
                  padding: '5px 14px',
                  fontSize: '11px',
                  fontWeight: isTemp ? 700 : 500,
                  color: isTemp ? '#ffffff' : '#4b5563',
                  background: isTemp ? '#ea580c' : 'transparent',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
              >
                TEMPERATURE
              </button>
              <button
                type="button"
                id="btn-toggle-sal"
                onClick={() => setVariable('salinity')}
                style={{
                  padding: '5px 14px',
                  fontSize: '11px',
                  fontWeight: !isTemp ? 700 : 500,
                  color: !isTemp ? '#ffffff' : '#4b5563',
                  background: !isTemp ? '#0284c7' : 'transparent',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
              >
                SALINITY
              </button>
            </div>

            {/* Profile vs Anomaly Selector */}
            <div
              style={{
                display: 'inline-flex',
                background: '#f3f4f6',
                border: '1px solid #d1d5db',
                borderRadius: '6px',
                padding: '2px',
              }}
            >
              <button
                type="button"
                id="btn-toggle-profile"
                onClick={() => setChartMode('profile')}
                style={{
                  padding: '5px 14px',
                  fontSize: '11px',
                  fontWeight: chartMode === 'profile' ? 700 : 500,
                  color: chartMode === 'profile' ? '#ffffff' : '#4b5563',
                  background: chartMode === 'profile' ? '#111827' : 'transparent',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
              >
                PROFILE
              </button>
              <button
                type="button"
                id="btn-toggle-anomaly"
                onClick={() => setChartMode('anomaly')}
                style={{
                  padding: '5px 14px',
                  fontSize: '11px',
                  fontWeight: chartMode === 'anomaly' ? 700 : 500,
                  color: chartMode === 'anomaly' ? '#ffffff' : '#4b5563',
                  background: chartMode === 'anomaly' ? '#111827' : 'transparent',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
              >
                ANOMALY
              </button>
            </div>
          </div>

          <div style={{ fontSize: '11px', color: '#6b7280', fontFamily: 'monospace' }}>
            Data Classification: <span style={{ color: '#16a34a', fontWeight: 700 }}>● Observed</span> &nbsp;·&nbsp;{' '}
            <span style={{ color: '#ea580c', fontWeight: 700 }}>━ AI Reconstructed</span> &nbsp;·&nbsp;{' '}
            <span style={{ color: '#2563eb', fontWeight: 700 }}>━ GLORYS</span>
          </div>
        </div>
      </div>

      {/* Salinity Notice if Salinity selected but model only reconstructs temperature (Requirement 14) */}
      {!isTemp && !hasAiSalinity && (
        <div
          style={{
            background: '#f8fafc',
            border: '1px solid #cbd5e1',
            borderRadius: '6px',
            padding: '10px 14px',
            fontSize: '12px',
            color: '#334155',
            marginBottom: '14px',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
          }}
        >
          <span style={{ fontSize: '16px' }}>ℹ️</span>
          <div>
            <strong>Scientific Notice:</strong> Salinity reconstruction unavailable for this selection.
            Displaying verified <strong>Copernicus GLORYS12V1 reanalysis</strong> vertical salinity strata.
          </div>
        </div>
      )}

      {/* 2. DATA STATUS BAR (Requirement 11) */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))',
          gap: '10px',
          background: '#f9fafb',
          border: '1px solid #e5e7eb',
          borderRadius: '8px',
          padding: '10px 14px',
          marginBottom: '14px',
          fontSize: '11px',
          fontFamily: 'monospace',
        }}
      >
        <div>
          <span style={{ color: '#6b7280', display: 'block', fontSize: '10px', textTransform: 'uppercase' }}>
            Observed
          </span>
          <strong
            style={{
              color: observedStatus.startsWith('Available') ? '#16a34a' : '#9ca3af',
              fontSize: '12px',
            }}
          >
            {observedStatus}
          </strong>
        </div>

        <div>
          <span style={{ color: '#6b7280', display: 'block', fontSize: '10px', textTransform: 'uppercase' }}>
            OceanEmbed AI
          </span>
          <strong
            style={{
              color: aiStatus.startsWith('Available') ? '#ea580c' : '#9ca3af',
              fontSize: '12px',
            }}
          >
            {aiStatus}
          </strong>
        </div>

        <div>
          <span style={{ color: '#6b7280', display: 'block', fontSize: '10px', textTransform: 'uppercase' }}>
            GLORYS Reanalysis
          </span>
          <strong
            style={{
              color: glorysStatus.startsWith('Available') ? '#2563eb' : '#9ca3af',
              fontSize: '12px',
            }}
          >
            {glorysStatus}
          </strong>
        </div>

        <div>
          <span style={{ color: '#6b7280', display: 'block', fontSize: '10px', textTransform: 'uppercase' }}>
            ARGO
          </span>
          <strong
            style={{
              color: argoStatus.startsWith('Available') ? '#059669' : '#9ca3af',
              fontSize: '12px',
            }}
          >
            {argoStatus}
          </strong>
        </div>
      </div>

      {/* 3. HOVER TOOLTIP READOUT BAR (Requirement 12: strictly real fields only) */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
          gap: '10px',
          background: '#f8fafc',
          border: '1px solid #e2e8f0',
          borderRadius: '8px',
          padding: '10px 14px',
          marginBottom: '14px',
          fontFamily: 'monospace',
        }}
      >
        <div>
          <span style={{ fontSize: '10px', color: '#64748b', textTransform: 'uppercase', display: 'block' }}>
            Depth
          </span>
          <strong style={{ fontSize: '16px', color: '#0f172a' }}>
            {hoveredData ? `${hoveredData.depth} m` : `${activeSelectedDepth} m`}
          </strong>
        </div>

        {/* OceanEmbed AI: strictly if real data exists */}
        {(hoveredData ? hoveredData.ai != null : selectedData?.ai != null) && (
          <div>
            <span style={{ fontSize: '10px', color: '#64748b', textTransform: 'uppercase', display: 'block' }}>
              OceanEmbed AI
            </span>
            <strong style={{ fontSize: '16px', color: '#ea580c' }}>
              {hoveredData ? `${hoveredData.ai?.toFixed(2)} ${unit}` : `${selectedData?.ai?.toFixed(2)} ${unit}`}
            </strong>
          </div>
        )}

        {/* GLORYS: strictly if real data exists */}
        {(hoveredData ? hoveredData.reanalysis != null : selectedData?.reanalysis != null) && (
          <div>
            <span style={{ fontSize: '10px', color: '#64748b', textTransform: 'uppercase', display: 'block' }}>
              GLORYS
            </span>
            <strong style={{ fontSize: '16px', color: '#2563eb' }}>
              {hoveredData
                ? `${hoveredData.reanalysis?.toFixed(2)} ${unit}`
                : `${selectedData?.reanalysis?.toFixed(2)} ${unit}`}
            </strong>
          </div>
        )}

        {/* Observed: strictly if real measurement exists at this depth */}
        {(hoveredData ? hoveredData.observed != null : selectedData?.observed != null) && (
          <div>
            <span style={{ fontSize: '10px', color: '#64748b', textTransform: 'uppercase', display: 'block' }}>
              Observed
            </span>
            <strong style={{ fontSize: '16px', color: '#16a34a' }}>
              {hoveredData
                ? `${hoveredData.observed?.toFixed(2)} ${unit}`
                : `${selectedData?.observed?.toFixed(2)} ${unit}`}
            </strong>
          </div>
        )}
      </div>

      {/* 4. MAIN SCIENTIFIC GRAPH CANVAS (SVG Vector Graphics, White Background) */}
      <div style={{ position: 'relative', width: '100%', overflowX: 'auto', userSelect: 'none' }}>
        <svg
          viewBox={`0 0 ${chartWidth} ${chartHeight}`}
          style={{ width: '100%', height: 'auto', display: 'block', minWidth: '600px', background: '#ffffff' }}
          onMouseMove={(e) => {
            const rect = e.currentTarget.getBoundingClientRect()
            const mouseX = ((e.clientX - rect.left) / rect.width) * chartWidth
            if (mouseX >= padding.left && mouseX <= chartWidth - padding.right) {
              setHoveredDepth(mapXToDepth(mouseX))
            }
          }}
          onMouseLeave={() => setHoveredDepth(null)}
          onClick={() => {
            if (hoveredData) {
              setSelectedDepthPoint(hoveredData.depth)
              if (onDepthChange) {
                onDepthChange(hoveredData.depth)
              }
            }
          }}
        >
          {/* Background rect to guarantee pure white plotting canvas */}
          <rect
            x={padding.left}
            y={padding.top}
            width={plotWidth}
            height={plotHeight}
            fill="#ffffff"
          />

          {/* Subtle horizontal grid lines */}
          {yTicks.map((val) => {
            const y = mapValueToY(val)
            const isZero = chartMode === 'anomaly' && val === 0
            return (
              <g key={val}>
                <line
                  x1={padding.left}
                  x2={chartWidth - padding.right}
                  y1={y}
                  y2={y}
                  stroke={isZero ? '#111827' : '#e5e7eb'}
                  strokeWidth={isZero ? 1.8 : 1}
                  strokeDasharray={isZero ? undefined : '3 3'}
                />
                <text
                  x={padding.left - 10}
                  y={y + 4}
                  textAnchor="end"
                  fill={isZero ? '#111827' : '#374151'}
                  fontSize={isZero ? '11' : '10'}
                  fontWeight={isZero ? '700' : '500'}
                  fontFamily="monospace"
                >
                  {val > 0 && chartMode === 'anomaly' ? `+${val}` : val}
                  {chartMode !== 'anomaly' ? (isTemp ? '°' : '') : ''}
                </text>
              </g>
            )
          })}

          {/* Depth vertical grid lines */}
          {depthTicks.map((d) => {
            const x = mapDepthToX(d)
            return (
              <g key={d}>
                <line
                  x1={x}
                  x2={x}
                  y1={padding.top}
                  y2={chartHeight - padding.bottom}
                  stroke="#e5e7eb"
                  strokeWidth="1"
                  strokeDasharray="2 3"
                />
                <text
                  x={x}
                  y={chartHeight - padding.bottom + 18}
                  textAnchor="middle"
                  fill="#374151"
                  fontSize="11"
                  fontFamily="monospace"
                  fontWeight="600"
                >
                  {d}m
                </text>
              </g>
            )
          })}

          {/* Y-Axis Title */}
          <text
            transform="rotate(-90)"
            x={-(padding.top + plotHeight / 2)}
            y="22"
            fill="#111827"
            fontSize="12"
            fontWeight="700"
            textAnchor="middle"
            letterSpacing="0.04em"
          >
            {chartMode === 'anomaly'
              ? `${isTemp ? 'TEMPERATURE' : 'SALINITY'} ANOMALY (${unit})`
              : `${isTemp ? 'TEMPERATURE' : 'SALINITY'} (${unit})`}
          </text>

          {/* X-Axis Title */}
          <text
            x={padding.left + plotWidth / 2}
            y={chartHeight - 12}
            fill="#111827"
            fontSize="12"
            fontWeight="700"
            textAnchor="middle"
            letterSpacing="0.04em"
          >
            DEPTH (m)
          </text>

          {/* Dark axis borders */}
          <line
            x1={padding.left}
            x2={chartWidth - padding.right}
            y1={chartHeight - padding.bottom}
            y2={chartHeight - padding.bottom}
            stroke="#111827"
            strokeWidth="1.5"
          />
          <line
            x1={padding.left}
            x2={padding.left}
            y1={padding.top}
            y2={chartHeight - padding.bottom}
            stroke="#111827"
            strokeWidth="1.5"
          />

          {/* --- ANOMALY MODE: Deviation Relative to Verified GLORYS Baseline --- */}
          {chartMode === 'anomaly' && yZeroCoord != null && (
            <g>
              {allDepths.map((d) => {
                const reanalPt = reanalysisProfile.find((p) => p.depth === d)
                const aiPt = aiProfile.find((p) => p.depth === d)

                const aiVal = isTemp ? aiPt?.temperature : aiPt?.salinity
                const reanalVal = isTemp ? reanalPt?.temperature : reanalPt?.salinity

                if (aiVal == null || reanalVal == null) return null

                // Physical deviation between AI model and Copernicus Reanalysis
                const anom = Number((aiVal - reanalVal).toFixed(2))

                const x = mapDepthToX(d)
                const y = mapValueToY(anom)
                const barHeight = Math.abs(y - yZeroCoord)
                const barY = anom >= 0 ? y : yZeroCoord
                const color = anom >= 0 ? '#dc2626' : '#2563eb'

                return (
                  <g key={`anom-${d}`}>
                    <rect
                      x={x - 6}
                      y={barY}
                      width="12"
                      height={Math.max(2, barHeight)}
                      fill={color}
                      opacity="0.85"
                      stroke={color}
                      strokeWidth="1"
                      rx="2"
                    />
                  </g>
                )
              })}
            </g>
          )}

          {/* --- PROFILE MODE: Uncertainty Band, GLORYS Line, AI Line, Observed Points --- */}
          {chartMode === 'profile' && (
            <>
              {/* 1. Uncertainty Band (Shaded region around AI line, ONLY if real uncertainty data exists) */}
              {isTemp && tempUncertainty.length > 1 && (
                <polygon
                  points={[
                    ...tempUncertainty.map((u) => `${mapDepthToX(u.depth)},${mapValueToY(u.upper)}`),
                    ...tempUncertainty
                      .slice()
                      .reverse()
                      .map((u) => `${mapDepthToX(u.depth)},${mapValueToY(u.lower)}`),
                  ].join(' ')}
                  fill="rgba(234, 88, 12, 0.12)"
                  stroke="rgba(234, 88, 12, 0.3)"
                  strokeWidth="1"
                  strokeDasharray="2 2"
                />
              )}

              {/* 2. GLORYS Reanalysis Series: BLUE Line (━━━) */}
              {reanalysisProfile.length > 1 && (
                <polyline
                  fill="none"
                  stroke="#2563eb"
                  strokeWidth="2.4"
                  points={reanalysisProfile
                    .filter((p) => (isTemp ? typeof p.temperature === 'number' : typeof p.salinity === 'number'))
                    .map((p) => {
                      const val = isTemp ? p.temperature! : p.salinity!
                      return `${mapDepthToX(p.depth)},${mapValueToY(val)}`
                    })
                    .join(' ')}
                />
              )}

              {/* 3. OceanEmbed AI Reconstruction Series: ORANGE Line (━━━) */}
              {aiProfile.length > 1 && (
                <polyline
                  fill="none"
                  stroke="#ea580c"
                  strokeWidth="2.5"
                  points={aiProfile
                    .filter((p) => (isTemp ? typeof p.temperature === 'number' : typeof p.salinity === 'number'))
                    .map((p) => {
                      const val = isTemp ? p.temperature! : p.salinity!
                      return `${mapDepthToX(p.depth)},${mapValueToY(val)}`
                    })
                    .join(' ')}
                />
              )}

              {/* 4. Observed Measurements: GREEN Discrete Points (●) ONLY where real measurements exist */}
              {/* Depth 0: Verified surface observation */}
              {((isTemp && typeof observedSurfaceTemp === 'number') || (!isTemp && typeof observedSurfaceSal === 'number')) && (
                <circle
                  cx={mapDepthToX(0)}
                  cy={mapValueToY(isTemp ? observedSurfaceTemp! : observedSurfaceSal!)}
                  r="6"
                  fill="#16a34a"
                  stroke="#ffffff"
                  strokeWidth="2"
                  style={{ filter: 'drop-shadow(0 1px 3px rgba(0,0,0,0.3))' }}
                >
                  <title>{`Observed Surface (0m): ${isTemp ? observedSurfaceTemp : observedSurfaceSal} ${unit}`}</title>
                </circle>
              )}

              {/* In-situ Argo Float measurements at depth (if present in dataset) */}
              {argoObservedPoints.map((pt, idx) => {
                const val = isTemp ? pt.temperature : pt.salinity
                if (typeof val !== 'number') return null
                return (
                  <circle
                    key={`obs-pt-${idx}`}
                    cx={mapDepthToX(pt.depth)}
                    cy={mapValueToY(val)}
                    r="5.5"
                    fill="#16a34a"
                    stroke="#ffffff"
                    strokeWidth="2"
                  >
                    <title>{`Observed In-Situ (${pt.depth}m): ${val} ${unit}`}</title>
                  </circle>
                )
              })}
            </>
          )}

          {/* Interactive Crosshair Line tracking cursor */}
          {hoveredDepth != null && (
            <g>
              <line
                x1={mapDepthToX(hoveredDepth)}
                x2={mapDepthToX(hoveredDepth)}
                y1={padding.top}
                y2={chartHeight - padding.bottom}
                stroke="#111827"
                strokeWidth="1.2"
                strokeDasharray="4 2"
              />
              <circle
                cx={mapDepthToX(hoveredDepth)}
                cy={chartHeight - padding.bottom}
                r="3"
                fill="#111827"
              />
            </g>
          )}
        </svg>
      </div>

      {/* 5. SELECTED DEPTH PANEL (Requirement 13) */}
      {selectedData && (
        <div
          id="selected-depth-info-panel"
          style={{
            marginTop: '16px',
            background: '#f8fafc',
            border: '1px solid #cbd5e1',
            borderRadius: '8px',
            padding: '14px 18px',
            fontFamily: 'monospace',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <strong style={{ fontSize: '12px', color: '#0f172a', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
              SELECTED DEPTH
            </strong>
            <span style={{ fontSize: '11px', color: '#64748b' }}>
              Click anywhere on the graph to inspect depths
            </span>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
              gap: '12px',
              fontSize: '13px',
            }}
          >
            <div>
              <span style={{ fontSize: '11px', color: '#64748b', display: 'block' }}>Depth:</span>
              <strong style={{ fontSize: '18px', color: '#111827' }}>{selectedData.depth} m</strong>
            </div>

            {selectedData.ai != null && (
              <div>
                <span style={{ fontSize: '11px', color: '#ea580c', display: 'block', fontWeight: 600 }}>
                  OceanEmbed AI:
                </span>
                <strong style={{ fontSize: '16px', color: '#ea580c' }}>
                  {selectedData.ai.toFixed(2)} {unit}
                </strong>
              </div>
            )}

            {selectedData.reanalysis != null && (
              <div>
                <span style={{ fontSize: '11px', color: '#2563eb', display: 'block', fontWeight: 600 }}>
                  GLORYS:
                </span>
                <strong style={{ fontSize: '16px', color: '#2563eb' }}>
                  {selectedData.reanalysis.toFixed(2)} {unit}
                </strong>
              </div>
            )}

            {selectedData.observed != null && (
              <div>
                <span style={{ fontSize: '11px', color: '#16a34a', display: 'block', fontWeight: 600 }}>
                  Observed:
                </span>
                <strong style={{ fontSize: '16px', color: '#16a34a' }}>
                  {selectedData.observed.toFixed(2)} {unit}
                </strong>
              </div>
            )}

            {selectedData.diff != null && (
              <div>
                <span style={{ fontSize: '11px', color: '#475569', display: 'block' }}>
                  Difference (AI vs GLORYS):
                </span>
                <strong style={{ fontSize: '16px', color: '#111827' }}>
                  {selectedData.diff > 0 ? `+${selectedData.diff}` : selectedData.diff} {unit}
                </strong>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 6. GRAPH LEGEND (Requirement 16) */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '14px',
          borderTop: '1px solid #e5e7eb',
          paddingTop: '14px',
          marginTop: '14px',
          fontSize: '12px',
          color: '#374151',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '20px', flexWrap: 'wrap' }}>
          {/* Observed */}
          <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span
              style={{
                width: '10px',
                height: '10px',
                borderRadius: '50%',
                background: '#16a34a',
                border: '1.5px solid #ffffff',
                boxShadow: '0 0 0 1px #16a34a',
                display: 'inline-block',
              }}
            />
            <strong style={{ color: '#16a34a' }}>● Observed</strong>
          </span>

          {/* OceanEmbed AI Reconstruction */}
          <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span
              style={{
                width: '20px',
                height: '0',
                borderTop: '2.5px solid #ea580c',
                display: 'inline-block',
              }}
            />
            <strong style={{ color: '#ea580c' }}>━ OceanEmbed AI Reconstruction</strong>
          </span>

          {/* GLORYS Reanalysis */}
          <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span
              style={{
                width: '20px',
                height: '0',
                borderTop: '2.4px solid #2563eb',
                display: 'inline-block',
              }}
            />
            <strong style={{ color: '#2563eb' }}>━ GLORYS Reanalysis</strong>
          </span>

          {/* Uncertainty Band (if present) */}
          {isTemp && tempUncertainty.length > 0 && (
            <span style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#6b7280' }}>
              <span
                style={{
                  width: '14px',
                  height: '10px',
                  background: 'rgba(234, 88, 12, 0.2)',
                  border: '1px solid rgba(234, 88, 12, 0.4)',
                  display: 'inline-block',
                }}
              />
              <span>Uncertainty (95% CI)</span>
            </span>
          )}
        </div>

        <div style={{ fontSize: '11px', color: '#64748b' }}>
          {sourceDescription || 'Copernicus GLORYS12V1 & Global Argo GDAC'}
        </div>
      </div>
    </div>
  )
}

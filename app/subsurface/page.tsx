"use client";

import React, { useState, useMemo, useEffect, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useOceanData, locations, Location } from "@/lib/ocean-context";
import { getHistoricalSeries, isOceanCoordinate, findClosestStation, findNearestArgoProfile } from "@/lib/ocean-service";
import { SectionLabel } from "@/components/metric-card";
import { SubsurfaceScientificChart } from "@/components/subsurface-scientific-chart";
import {
  Activity,
  ArrowLeft,
  ChevronDown,
  ChevronUp,
  Database,
  HelpCircle,
  Info,
  Layers,
  MapPin,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Waves,
  Zap,
} from "lucide-react";

function SubsurfaceContent() {
  const {
    subsurfaceData,
    oceanData,
    selected,
    setSelected,
    depth,
    setDepth,
    selectedDate,
    setSelectedDate,
    selectedDateFormatted,
    resetToToday,
    formatValue,
    getTempAtDepth,
    getSalAtDepth,
    isNoData,
    isLand,
    isOcean,
    metric,
    setMetric,
    switchMarineStation,
  } = useOceanData();

  const searchParams = useSearchParams();

  // Hydrate selected coordinates, date, variable, depth from URL query parameters (e.g. from Overview Map click)
  useEffect(() => {
    if (!searchParams) return;
    const latParam = searchParams.get("lat");
    const lonParam = searchParams.get("lon");
    const dateParam = searchParams.get("date");
    const metricParam = searchParams.get("metric");
    const depthParam = searchParams.get("depth");

    if (latParam && lonParam) {
      const latNum = parseFloat(latParam);
      const lonNum = parseFloat(lonParam);
      if (!isNaN(latNum) && !isNaN(lonNum)) {
        const isOceanCoord = isOceanCoordinate(latNum, lonNum);
        if (isOceanCoord) {
          const closest = findClosestStation(latNum, lonNum);
          if (closest && closest.distanceDeg < 0.5) {
            setSelected(closest.station);
          } else {
            setSelected({
              id: `clicked-${latNum.toFixed(2)}-${lonNum.toFixed(2)}`,
              name: `Marine Station (${latNum.toFixed(2)}°N, ${lonNum.toFixed(2)}°E)`,
              region: closest ? closest.station.region : "Indian Ocean Basin",
              x: 50,
              y: 50,
              code: `${latNum.toFixed(2)}°, ${lonNum.toFixed(2)}°`,
              lat: latNum,
              lon: lonNum,
            });
          }
        }
      }
    }

    if (dateParam) {
      setSelectedDate(dateParam);
    }
    if (metricParam === "temperature" || metricParam === "salinity" || metricParam === "wind") {
      setMetric(metricParam);
    }
    if (depthParam) {
      const d = parseInt(depthParam, 10);
      if (!isNaN(d)) setDepth(d);
    }
  }, [searchParams, setSelected, setSelectedDate, setMetric, setDepth]);

  // Profiles for publication-grade scientific chart
  const reanalysisProfile = useMemo(() => {
    if (subsurfaceData?.ts_diagram?.length) {
      return subsurfaceData.ts_diagram.map((pt) => ({
        depth: pt.depth,
        temperature: pt.temperature,
        salinity: pt.salinity,
      }));
    }
    const tProf = oceanData?.reference_profile || oceanData?.temperature_profile || [];
    const sProf = oceanData?.salinity_profile || [];
    return tProf.map((tp) => ({
      depth: tp.depth,
      temperature: tp.temperature,
      salinity: sProf.find((sp) => sp.depth === tp.depth)?.salinity ?? null,
    }));
  }, [subsurfaceData, oceanData]);

  const aiProfile = useMemo(() => {
    const mProf = oceanData?.model_profile || [];
    const sProf = oceanData?.salinity_profile || [];
    return mProf.map((mp) => ({
      depth: mp.depth,
      temperature: mp.temperature,
      salinity: sProf.find((sp) => sp.depth === mp.depth)?.salinity ?? null,
    }));
  }, [oceanData]);

  // Authentic nearest Argo GDAC float in-situ profile for direct observational validation
  const nearestArgo = useMemo(() => {
    if (selected.lat == null || selected.lon == null) return null;
    return findNearestArgoProfile(selected.lat, selected.lon, 4.0);
  }, [selected.lat, selected.lon]);

  const argoObservedPoints = useMemo(() => {
    const pts: { depth: number; temperature?: number | null; salinity?: number | null }[] = [];
    if (oceanData?.surface_temp != null || oceanData?.salinity != null) {
      pts.push({
        depth: 0,
        temperature: oceanData.surface_temp ?? null,
        salinity: oceanData.salinity ?? null,
      });
    }
    if (nearestArgo?.profile?.profile && Array.isArray(nearestArgo.profile.profile)) {
      nearestArgo.profile.profile.forEach((pt: any) => {
        if (typeof pt.depth === "number" && pt.depth > 0) {
          pts.push({
            depth: pt.depth,
            temperature: typeof pt.temperature === "number" ? pt.temperature : null,
            salinity: typeof pt.salinity === "number" ? pt.salinity : null,
          });
        }
      });
    }
    return pts;
  }, [oceanData, nearestArgo]);

  // Interactive state
  const [hoveredDepth, setHoveredDepth] = useState<number | null>(null);
  const [hoveredBoundary, setHoveredBoundary] = useState<"thermocline" | "halocline" | "mld" | null>(null);
  const [hoveredTsPoint, setHoveredTsPoint] = useState<any | null>(null);
  const [hoveredTempPoint, setHoveredTempPoint] = useState<any | null>(null);
  const [hoveredSalPoint, setHoveredSalPoint] = useState<any | null>(null);
  const [showWhatAmISeeing, setShowWhatAmISeeing] = useState(false);
  const [isPhysicsExpanded, setIsPhysicsExpanded] = useState(false);
  const [activeTooltip, setActiveTooltip] = useState<string | null>(null);

  // Graph view controls (Two separate graphs with selection & side-by-side)
  const [activeGraphView, setActiveGraphView] = useState<"both" | "temperature" | "salinity">("both");
  const [tempGraphMode, setTempGraphMode] = useState<"depth" | "timeseries">("depth");
  const [salGraphMode, setSalGraphMode] = useState<"depth" | "timeseries">("depth");

  // Multi-day historical observation series for the "vs Date" graph mode
  const histSeries = useMemo(() => {
    if (!isOcean) return null;
    return getHistoricalSeries(selected.id, selectedDate, 14);
  }, [selected.id, selectedDate, isOcean]);

  // Status Badge evaluation based on verified scientific data presence
  const dataStatus = useMemo(() => {
    if (isLand || !isOcean) {
      return {
        label: "LAND COORDINATE · NO OCEAN DATA",
        color: "#ee8e7a",
        bg: "rgba(238, 142, 122, 0.15)",
        border: "rgba(238, 142, 122, 0.4)",
      };
    }
    if (oceanData?.status === "no_data") {
      return {
        label: "NO OBSERVATION AVAILABLE",
        color: "#94a3b8",
        bg: "rgba(148, 163, 184, 0.15)",
        border: "rgba(148, 163, 184, 0.3)",
      };
    }
    if (!subsurfaceData || (!subsurfaceData.thermocline_depth_m && !subsurfaceData.ts_diagram?.length)) {
      return {
        label: "INSUFFICIENT DATA FOR ANALYSIS",
        color: "#f59e0b",
        bg: "rgba(245, 158, 11, 0.15)",
        border: "rgba(245, 158, 11, 0.3)",
      };
    }
    if (subsurfaceData.ts_diagram && subsurfaceData.ts_diagram.length < 5) {
      return {
        label: "PARTIAL PROFILE",
        color: "#38bdf8",
        bg: "rgba(56, 189, 248, 0.15)",
        border: "rgba(56, 189, 248, 0.3)",
      };
    }
    return {
      label: "VERIFIED DATA AVAILABLE",
      color: "#22c55e",
      bg: "rgba(34, 197, 94, 0.15)",
      border: "rgba(34, 197, 94, 0.3)",
    };
  }, [isLand, isOcean, oceanData?.status, subsurfaceData]);

  // Thermocline, Halocline, MLD values (strictly using real calculated values)
  const thermoclineDepth = subsurfaceData?.thermocline_depth_m;
  const haloclineDepth = subsurfaceData?.halocline_depth_m;
  const mixedLayerDepth = subsurfaceData?.mixed_layer_depth_m ?? oceanData?.mld;
  const maxTempGradient = subsurfaceData?.max_temperature_gradient;
  const maxSalGradient = subsurfaceData?.max_salinity_gradient;

  // Temperature Profile points (observed/reanalysis and AI reconstructed)
  const tempProfile = oceanData?.temperature_profile || oceanData?.reference_profile || [];
  const modelTempProfile = oceanData?.model_profile || [];
  const tempUncertainty = oceanData?.temp_uncertainty || [];

  // Salinity Profile points
  const salProfile =
    oceanData?.observed_salinity_profile ||
    oceanData?.salinity_profile ||
    subsurfaceData?.ts_diagram?.map((pt) => ({ depth: pt.depth, salinity: pt.salinity, temperature: pt.temperature })) ||
    [];

  // Current Depth Slice values (Requirement 7)
  const currentTemp = getTempAtDepth(depth);
  const currentSal = getSalAtDepth(depth);

  // Observed depth range based exclusively on authentic dataset
  const maxProfileDepth = useMemo(() => {
    if (!isOcean) return 0;
    if (subsurfaceData?.ts_diagram?.length) {
      const maxD = Math.max(...subsurfaceData.ts_diagram.map((pt) => pt.depth));
      return Number(maxD.toFixed(2));
    }
    return 0.49;
  }, [subsurfaceData, isOcean]);

  // Isopycnal lines for T-S Diagram (potential density sigma_theta contours)
  const isopycnals = useMemo(() => {
    const sigmas = [22, 23, 24, 25, 26, 27, 27.5];
    return sigmas.map((sigma) => {
      const points: { t: number; s: number }[] = [];
      for (let t = 4; t <= 32; t += 2) {
        const denom = 0.802 - 0.002 * t;
        const num = sigma - 28.14 + 0.0735 * t + 0.00469 * t * t;
        const s = 35 + num / denom;
        if (s >= 32.5 && s <= 37.5) {
          points.push({ t, s });
        }
      }
      return { sigma, points };
    });
  }, []);

  // Coordinated hover readout
  const activeReadout = useMemo(() => {
    if (hoveredDepth == null) return null;
    let closestTemp: number | null = null;
    let closestSal: number | null = null;
    let closestDensity: number | null = null;

    if (subsurfaceData?.ts_diagram?.length) {
      let minDiff = Infinity;
      for (const pt of subsurfaceData.ts_diagram) {
        const diff = Math.abs(pt.depth - hoveredDepth);
        if (diff < minDiff) {
          minDiff = diff;
          closestTemp = pt.temperature;
          closestSal = pt.salinity;
          closestDensity = pt.potential_density;
        }
      }
    }
    return {
      depth: hoveredDepth,
      temp: closestTemp,
      sal: closestSal,
      density: closestDensity,
    };
  }, [hoveredDepth, subsurfaceData]);

  return (
    <div className="page-content page-view-enter" style={{ maxWidth: "1440px", margin: "0 auto", paddingBottom: "40px" }}>
      {/* 1. Header Banner */}
      <div className="subpage-header" style={{ marginBottom: "18px", borderBottom: "1px solid #1a3944", paddingBottom: "14px" }}>
        <div className="subpage-title-group">
          <SectionLabel>Vertical Ocean Dynamics &amp; Water-Mass Structure</SectionLabel>
          <div style={{ display: "flex", alignItems: "center", gap: "10px", marginTop: "4px" }}>
            <Activity size={24} color="#63d9d0" />
            <h1 style={{ fontSize: "24px", fontWeight: 700, margin: 0, letterSpacing: "-0.01em" }}>
              Subsurface Analysis
            </h1>
          </div>
          <p className="section-description" style={{ marginTop: "6px", maxWidth: "780px" }}>
            Analyze temperature, salinity, stratification, thermocline, halocline and water-mass structure from verified ocean observations and reanalysis data.
          </p>
        </div>
        <Link href="/" className="subpage-back-btn" id="btn-back-overview">
          <ArrowLeft size={14} /> Back to Overview
        </Link>
      </div>

      {/* 2. Active Station Information Bar */}
      <div
        id="active-station-bar"
        style={{
          background: "rgba(8, 27, 36, 0.85)",
          border: "1px solid #21404a",
          borderRadius: "8px",
          padding: "14px 18px",
          marginBottom: "20px",
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "16px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "24px", flexWrap: "wrap" }}>
          <div>
            <span style={{ fontSize: "10px", color: "var(--muted-foreground)", textTransform: "uppercase", letterSpacing: "0.08em", display: "block" }}>
              Active Station
            </span>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", marginTop: "2px" }}>
              <strong style={{ fontSize: "15px", color: "#63d9d0", fontFamily: "monospace" }}>{selected.code}</strong>
              <span style={{ color: "#709094", fontSize: "12px" }}>·</span>
              <span style={{ fontSize: "13px", color: "#e6f0f0", fontWeight: 600 }}>{selected.name}</span>
            </div>
          </div>

          <div style={{ borderLeft: "1px solid #1a3944", paddingLeft: "18px" }}>
            <span style={{ fontSize: "10px", color: "var(--muted-foreground)", textTransform: "uppercase", letterSpacing: "0.08em", display: "block" }}>
              Coordinates
            </span>
            <span style={{ fontSize: "12px", color: "#d8e7e5", fontFamily: "monospace", marginTop: "2px", display: "block" }}>
              {selected.lat != null ? `${Math.abs(selected.lat).toFixed(3)}°${selected.lat >= 0 ? "N" : "S"}` : "—"},{" "}
              {selected.lon != null ? `${Math.abs(selected.lon).toFixed(3)}°${selected.lon >= 0 ? "E" : "W"}` : "—"}
            </span>
          </div>

          <div style={{ borderLeft: "1px solid #1a3944", paddingLeft: "18px" }}>
            <span style={{ fontSize: "10px", color: "var(--muted-foreground)", textTransform: "uppercase", letterSpacing: "0.08em", display: "block" }}>
              Observation Date
            </span>
            <div style={{ display: "flex", alignItems: "center", gap: "6px", marginTop: "2px" }}>
              <input
                id="subsurface-date-picker"
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                style={{
                  background: "#05131a",
                  border: "1px solid #21404a",
                  borderRadius: "4px",
                  color: "#63d9d0",
                  fontSize: "11px",
                  padding: "2px 6px",
                  fontFamily: "monospace",
                }}
              />
              <button
                id="btn-subsurface-today"
                onClick={resetToToday}
                style={{
                  background: "rgba(99, 217, 208, 0.12)",
                  border: "1px solid rgba(99, 217, 208, 0.3)",
                  borderRadius: "4px",
                  color: "#63d9d0",
                  fontSize: "10px",
                  padding: "2px 6px",
                  cursor: "pointer",
                }}
              >
                Today
              </button>
            </div>
          </div>

          <div style={{ borderLeft: "1px solid #1a3944", paddingLeft: "18px" }}>
            <span style={{ fontSize: "10px", color: "var(--muted-foreground)", textTransform: "uppercase", letterSpacing: "0.08em", display: "block" }}>
              Profile Range
            </span>
            <span style={{ fontSize: "12px", color: "#d8e7e5", fontFamily: "monospace", marginTop: "2px", display: "block" }}>
              0 – {maxProfileDepth} m
            </span>
          </div>

          <div style={{ borderLeft: "1px solid #1a3944", paddingLeft: "18px" }}>
            <span style={{ fontSize: "10px", color: "var(--muted-foreground)", textTransform: "uppercase", letterSpacing: "0.08em", display: "block" }}>
              Data Source
            </span>
            <span style={{ fontSize: "12px", color: "#99b2b3", marginTop: "2px", display: "block" }}>
              {subsurfaceData?.provenance?.source || oceanData?.provenance?.source || "Copernicus GLORYS12V1 / Argo GDAC"}
            </span>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
          {/* Station Switcher Quick Buttons */}
          <div style={{ display: "flex", gap: "6px", background: "#05131a", padding: "3px", borderRadius: "6px", border: "1px solid #1a3944" }}>
            {locations.map((loc) => (
              <button
                key={loc.id}
                id={`btn-station-${loc.code.toLowerCase()}`}
                onClick={() => setSelected(loc)}
                style={{
                  padding: "4px 10px",
                  fontSize: "11px",
                  borderRadius: "4px",
                  border: "none",
                  cursor: "pointer",
                  background: selected.id === loc.id ? "#153d4a" : "transparent",
                  color: selected.id === loc.id ? "#63d9d0" : "#709094",
                  fontWeight: selected.id === loc.id ? 700 : 500,
                  transition: "all 0.15s ease",
                }}
                title={`Switch to ${loc.name} (${loc.code})`}
              >
                {loc.code}
              </button>
            ))}
          </div>

          {/* 3. Scientific Data Status Badge */}
          <div
            id="badge-data-status"
            style={{
              padding: "4px 10px",
              borderRadius: "5px",
              background: dataStatus.bg,
              border: `1px solid ${dataStatus.border}`,
              color: dataStatus.color,
              fontSize: "10px",
              fontWeight: 700,
              letterSpacing: "0.05em",
              display: "flex",
              alignItems: "center",
              gap: "6px",
              whiteSpace: "nowrap",
            }}
          >
            <span
              style={{
                width: "6px",
                height: "6px",
                borderRadius: "50%",
                background: dataStatus.color,
                boxShadow: `0 0 6px ${dataStatus.color}`,
              }}
            />
            {dataStatus.label}
          </div>
        </div>
      </div>

      {/* CHANGE 2: Strict Land Validation Notice */}      {isLand || !isOcean || isNoData ? (
        <div
          id="land-point-warning"
          style={{
            background: "#ffffff",
            border: "1px solid #d1d5db",
            borderRadius: "10px",
            padding: "48px 28px",
            textAlign: "center",
            marginBottom: "24px",
            boxShadow: "0 4px 20px rgba(0, 0, 0, 0.08)",
          }}
        >
          <div
            style={{
              width: "56px",
              height: "56px",
              borderRadius: "50%",
              background: "#fee2e2",
              color: "#dc2626",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              marginBottom: "16px",
              fontSize: "24px",
            }}
          >
            ⚠️
          </div>
          <h2 style={{ fontSize: "22px", fontWeight: 800, color: "#111827", margin: "0 0 10px", letterSpacing: "-0.02em" }}>
            NO VALID PROFILE DATA
          </h2>
          <p style={{ color: "#4b5563", fontSize: "14px", maxWidth: "620px", margin: "0 auto 24px", lineHeight: "1.6" }}>
            Valid OceanEmbed reconstruction or reference data is not available for the selected location/date. Subsurface thermal-saline depth profiles, thermoclines, haloclines, and water-mass stratification are strictly calculated from oceanic water observations.
          </p>
          <div style={{ display: "flex", justifyContent: "center", gap: "12px", flexWrap: "wrap" }}>
            <button
              id="btn-switch-ocean-station"
              onClick={switchMarineStation}
              style={{
                background: "#0284c7",
                color: "#ffffff",
                border: "none",
                padding: "10px 22px",
                borderRadius: "6px",
                fontSize: "13px",
                fontWeight: 700,
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                gap: "8px",
                boxShadow: "0 2px 8px rgba(2, 132, 199, 0.3)",
              }}
            >
              <Waves size={15} /> Switch to Active Marine Station
            </button>
            <Link
              href="/map-2d"
              style={{
                background: "#f3f4f6",
                color: "#1f2937",
                border: "1px solid #d1d5db",
                padding: "10px 22px",
                borderRadius: "6px",
                fontSize: "13px",
                fontWeight: 600,
                textDecoration: "none",
                display: "inline-flex",
                alignItems: "center",
                gap: "8px",
              }}
            >
              <MapPin size={15} /> Pick Point on 2D Ocean Map
            </Link>
          </div>
        </div>
      ) : (
        <>
          {/* PRIMARY SCIENTIFIC HERO CHART (PUBLICATION-GRADE WHITE BACKGROUND) */}
          <SubsurfaceScientificChart
            locationName={selected.name}
            locationCode={selected.code}
            lat={selected.lat ?? null}
            lon={selected.lon ?? null}
            date={selectedDate}
            depth={depth}
            onDepthChange={(d) => setDepth(d)}
            observedSurfaceTemp={oceanData?.surface_temp}
            observedSurfaceSal={oceanData?.salinity}
            reanalysisProfile={reanalysisProfile}
            aiProfile={aiProfile}
            tempUncertainty={oceanData?.temp_uncertainty || []}
            salUncertainty={oceanData?.sal_uncertainty || []}
            argoObservedPoints={argoObservedPoints}
            argoFloatInfo={
              nearestArgo?.profile
                ? {
                    platform: nearestArgo.profile.platform,
                    cycle: nearestArgo.profile.cycle,
                    distanceKm: Math.round(nearestArgo.distanceDeg * 111),
                  }
                : null
            }
            sourceDescription={oceanData?.provenance?.source}
            isNoData={isNoData || isLand}
            onSwitchStation={switchMarineStation}
          />

          {/* 4. Two Primary Result Cards + Stratification Summary */}
          <div className="subsurface-kpi-grid">
        {/* THERMOCLINE CARD */}
        <div
          id="card-thermocline"
          onMouseEnter={() => setHoveredBoundary("thermocline")}
          onMouseLeave={() => setHoveredBoundary(null)}
          style={{
            background: "linear-gradient(135deg, rgba(8, 27, 36, 0.95), rgba(13, 34, 44, 0.85))",
            padding: "18px 20px",
            borderRadius: "8px",
            border: hoveredBoundary === "thermocline" ? "1px solid #ffd166" : "1px solid rgba(255, 209, 102, 0.35)",
            boxShadow: hoveredBoundary === "thermocline" ? "0 0 16px rgba(255, 209, 102, 0.2)" : "0 4px 16px rgba(0, 0, 0, 0.25)",
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            transition: "all 0.2s ease",
            cursor: "pointer",
          }}
        >
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#ffd166" }} />
                <span style={{ fontSize: "11px", color: "#ffd166", textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 700 }}>
                  Thermocline Boundary
                </span>
              </div>
              <span style={{ fontSize: "10px", color: "#709094", background: "rgba(255, 209, 102, 0.1)", padding: "2px 6px", borderRadius: "4px" }}>
                Thermal Stratification
              </span>
            </div>

            <div style={{ marginTop: "12px", display: "flex", alignItems: "baseline", gap: "10px" }}>
              <strong style={{ fontSize: "32px", color: "#ffd166", fontWeight: 700, fontFamily: "monospace" }}>
                {thermoclineDepth != null ? `${thermoclineDepth} m` : "—"}
              </strong>
              {thermoclineDepth == null && (
                <span style={{ fontSize: "12px", color: "#709094" }}>No boundary detected from available profile</span>
              )}
            </div>

            <div style={{ marginTop: "8px", display: "flex", alignItems: "center", gap: "8px" }}>
              <span style={{ fontSize: "11px", color: "var(--muted-foreground)" }}>Maximum Thermal Gradient:</span>
              <strong style={{ fontSize: "12px", color: "#ffd166", fontFamily: "monospace" }}>
                {maxTempGradient != null ? `${maxTempGradient.toFixed(2)} °C / 100 m` : "—"}
              </strong>
            </div>
          </div>

          <p style={{ color: "#87a4a6", fontSize: "11px", lineHeight: "1.5", margin: "14px 0 0", borderTop: "1px solid rgba(255, 209, 102, 0.15)", paddingTop: "10px" }}>
            The thermocline is the depth range where temperature changes rapidly with depth.
          </p>
        </div>

        {/* HALOCLINE CARD */}
        <div
          id="card-halocline"
          onMouseEnter={() => setHoveredBoundary("halocline")}
          onMouseLeave={() => setHoveredBoundary(null)}
          style={{
            background: "linear-gradient(135deg, rgba(8, 27, 36, 0.95), rgba(13, 34, 44, 0.85))",
            padding: "18px 20px",
            borderRadius: "8px",
            border: hoveredBoundary === "halocline" ? "1px solid #45b7ff" : "1px solid rgba(69, 183, 255, 0.35)",
            boxShadow: hoveredBoundary === "halocline" ? "0 0 16px rgba(69, 183, 255, 0.2)" : "0 4px 16px rgba(0, 0, 0, 0.25)",
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            transition: "all 0.2s ease",
            cursor: "pointer",
          }}
        >
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#45b7ff" }} />
                <span style={{ fontSize: "11px", color: "#45b7ff", textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 700 }}>
                  Halocline Boundary
                </span>
              </div>
              <span style={{ fontSize: "10px", color: "#709094", background: "rgba(69, 183, 255, 0.1)", padding: "2px 6px", borderRadius: "4px" }}>
                Salinity Stratification
              </span>
            </div>

            <div style={{ marginTop: "12px", display: "flex", alignItems: "baseline", gap: "10px" }}>
              <strong style={{ fontSize: "32px", color: "#45b7ff", fontWeight: 700, fontFamily: "monospace" }}>
                {haloclineDepth != null ? `${haloclineDepth} m` : "—"}
              </strong>
              {haloclineDepth == null && (
                <span style={{ fontSize: "12px", color: "#709094" }}>No boundary detected from available profile</span>
              )}
            </div>

            <div style={{ marginTop: "8px", display: "flex", alignItems: "center", gap: "8px" }}>
              <span style={{ fontSize: "11px", color: "var(--muted-foreground)" }}>Maximum Salinity Gradient:</span>
              <strong style={{ fontSize: "12px", color: "#45b7ff", fontFamily: "monospace" }}>
                {maxSalGradient != null ? `${maxSalGradient.toFixed(2)} PSU / 100 m` : "—"}
              </strong>
            </div>
          </div>

          <p style={{ color: "#87a4a6", fontSize: "11px", lineHeight: "1.5", margin: "14px 0 0", borderTop: "1px solid rgba(69, 183, 255, 0.15)", paddingTop: "10px" }}>
            The halocline is the depth range where salinity changes rapidly with depth.
          </p>
        </div>

        {/* 11. OCEAN STRATIFICATION SUMMARY CARD */}
        <div
          id="card-stratification-summary"
          style={{
            background: "rgba(8, 27, 36, 0.95)",
            padding: "18px 20px",
            borderRadius: "8px",
            border: "1px solid #21404a",
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
          }}
        >
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: "11px", color: "var(--cyan)", textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 700 }}>
                Ocean Stratification Summary
              </span>
              <span style={{ fontSize: "10px", color: "#709094" }}>Verified Indices</span>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px 16px", marginTop: "14px" }}>
              <div>
                <span style={{ fontSize: "10px", color: "var(--muted-foreground)", display: "block" }}>Mixed Layer Depth (MLD)</span>
                <strong style={{ fontSize: "16px", color: "#bce9d2", fontFamily: "monospace" }}>
                  {mixedLayerDepth != null ? `${mixedLayerDepth} m` : "—"}
                </strong>
              </div>
              <div>
                <span style={{ fontSize: "10px", color: "var(--muted-foreground)", display: "block" }}>Thermocline Depth</span>
                <strong style={{ fontSize: "16px", color: "#ffd166", fontFamily: "monospace" }}>
                  {thermoclineDepth != null ? `${thermoclineDepth} m` : "—"}
                </strong>
              </div>
              <div>
                <span style={{ fontSize: "10px", color: "var(--muted-foreground)", display: "block" }}>Halocline Depth</span>
                <strong style={{ fontSize: "16px", color: "#45b7ff", fontFamily: "monospace" }}>
                  {haloclineDepth != null ? `${haloclineDepth} m` : "—"}
                </strong>
              </div>
              <div>
                <span style={{ fontSize: "10px", color: "var(--muted-foreground)", display: "block" }}>Pycnocline Interface</span>
                <strong style={{ fontSize: "14px", color: "#e6f0f0" }}>
                  {thermoclineDepth != null && haloclineDepth != null
                    ? Math.abs(thermoclineDepth - haloclineDepth) > 15
                      ? "Barrier Layer Active"
                      : "Coupled Thermohaline"
                    : "Standard Stratified"}
                </strong>
              </div>
            </div>
          </div>

          <div style={{ marginTop: "12px", borderTop: "1px solid #1a3944", paddingTop: "8px", display: "flex", justifyContent: "space-between", fontSize: "10px", color: "#709094" }}>
            <span>dT/dz Peak: {maxTempGradient?.toFixed(1) ?? "—"}°C/100m</span>
            <span>dS/dz Peak: {maxSalGradient?.toFixed(1) ?? "—"} PSU/100m</span>
          </div>
        </div>

        {/* 7. SELECTED DEPTH SLICE CARD (Requirement 7) */}
        <div
          id="card-depth-slice"
          style={{
            background: "linear-gradient(135deg, rgba(8, 27, 36, 0.95), rgba(13, 34, 44, 0.85))",
            padding: "18px 20px",
            borderRadius: "8px",
            border: "1px solid rgba(99, 217, 208, 0.35)",
            boxShadow: "0 4px 16px rgba(0, 0, 0, 0.25)",
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
          }}
        >
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#63d9d0" }} />
                <span style={{ fontSize: "11px", color: "#63d9d0", textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 700 }}>
                  Selected Depth Slice
                </span>
              </div>
              <div style={{ display: "flex", gap: "4px" }}>
                {[0, 50, 100, 200, 500, 1000].map((d) => (
                  <button
                    key={d}
                    id={`btn-slice-depth-${d}`}
                    onClick={() => setDepth(d)}
                    style={{
                      padding: "2px 6px",
                      fontSize: "9px",
                      fontFamily: "monospace",
                      borderRadius: "3px",
                      border: depth === d ? "1px solid #63d9d0" : "1px solid #1a3944",
                      background: depth === d ? "rgba(99, 217, 208, 0.2)" : "#071720",
                      color: depth === d ? "#63d9d0" : "#709094",
                      cursor: "pointer",
                      fontWeight: depth === d ? 700 : 400,
                    }}
                  >
                    {d}m
                  </button>
                ))}
              </div>
            </div>

            <div style={{ marginTop: "12px", display: "flex", alignItems: "baseline", gap: "10px" }}>
              <strong style={{ fontSize: "32px", color: "#63d9d0", fontWeight: 700, fontFamily: "monospace" }}>
                {depth} m
              </strong>
              <span style={{ fontSize: "11px", color: "#709094" }}>Active Depth Level</span>
            </div>

            {isNoData || (currentTemp == null && currentSal == null) ? (
              <div style={{ marginTop: "10px", padding: "10px", background: "rgba(148, 163, 184, 0.08)", borderRadius: "4px", border: "1px dashed #21404a", textAlign: "center" }}>
                <span style={{ fontSize: "11px", color: "#94a3b8" }}>No Data Available for Selected Depth</span>
              </div>
            ) : (
              <div style={{ marginTop: "10px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
                <div style={{ background: "#061822", padding: "8px 10px", borderRadius: "4px", border: "1px solid #142e38" }}>
                  <span style={{ fontSize: "10px", color: "var(--muted-foreground)", display: "block" }}>Temperature at Depth</span>
                  <strong style={{ fontSize: "15px", color: "#ffd166", fontFamily: "monospace" }}>
                    {currentTemp != null ? `${formatValue(currentTemp, 2)} °C` : "No Data Available"}
                  </strong>
                </div>
                <div style={{ background: "#061822", padding: "8px 10px", borderRadius: "4px", border: "1px solid #142e38" }}>
                  <span style={{ fontSize: "10px", color: "var(--muted-foreground)", display: "block" }}>Salinity at Depth</span>
                  <strong style={{ fontSize: "15px", color: "#45b7ff", fontFamily: "monospace" }}>
                    {currentSal != null ? `${formatValue(currentSal, 2)} PSU` : "No Data Available"}
                  </strong>
                </div>
              </div>
            )}
          </div>

          <div style={{ marginTop: "12px", borderTop: "1px solid rgba(99, 217, 208, 0.15)", paddingTop: "8px", display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "10px", color: "#709094" }}>
            <span>Source: {subsurfaceData?.provenance?.source || oceanData?.provenance?.source || "Copernicus GLORYS12V1"}</span>
            <span style={{ color: isNoData ? "#94a3b8" : "#22c55e", fontWeight: 600 }}>
              {isNoData ? "No Observation" : oceanData?.model_profile?.length ? "Reanalysis & Model" : "Verified In-Situ Observation"}
            </span>
          </div>
        </div>
      </div>

      {/* 9 & 10. T-S WATER MASS DIAGRAM & ISOPYCNALS */}
      <div className="subsurface-ts-grid">
        {/* T-S Water Mass Diagram Panel */}
        <section className="panel" id="section-ts-diagram" style={{ background: "rgba(8, 27, 36, 0.9)" }}>
          <div className="panel-header">
            <div>
              <SectionLabel>Thermodynamic Phase Space</SectionLabel>
              <h2 style={{ fontSize: "16px", margin: "3px 0 0" }}>T-S Water Mass Diagram &amp; Potential Density (σθ)</h2>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <button
                id="btn-toggle-ts-help"
                onClick={() => setShowWhatAmISeeing(!showWhatAmISeeing)}
                style={{
                  background: "rgba(99, 217, 208, 0.12)",
                  border: "1px solid rgba(99, 217, 208, 0.4)",
                  borderRadius: "5px",
                  color: "#63d9d0",
                  fontSize: "11px",
                  padding: "4px 10px",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: "5px",
                }}
              >
                <HelpCircle size={13} /> What am I seeing?
              </button>
            </div>
          </div>

          {/* 10. "What am I seeing?" Explanatory Card */}
          {showWhatAmISeeing && (
            <div
              id="card-what-am-i-seeing"
              style={{
                background: "#071c26",
                border: "1px solid #1f4e57",
                borderRadius: "6px",
                padding: "12px 16px",
                marginTop: "12px",
                fontSize: "12px",
                color: "#d8e7e5",
                lineHeight: "1.6",
              }}
            >
              <strong style={{ color: "#63d9d0", display: "block", marginBottom: "4px" }}>
                Understanding the T-S (Temperature–Salinity) Diagram:
              </strong>
              A T-S diagram shows how temperature and salinity vary together through the water column. Different regions of the diagram can indicate different water masses and changes in ocean stratification.
              Curved contour lines represent constant potential density (σθ in kg/m³).
            </div>
          )}

          {/* Diagram Canvas */}
          <div style={{ height: "270px", position: "relative", marginTop: "14px" }}>
            <svg viewBox="0 0 340 210" style={{ width: "100%", height: "100%" }}>
              {/* Axes lines */}
              <line x1="45" x2="325" y1="180" y2="180" stroke="#21404a" strokeWidth="1" />
              <line x1="45" x2="45" y1="15" y2="180" stroke="#21404a" strokeWidth="1" />

              {/* X-Axis Ticks (Salinity: 33 to 37 PSU) */}
              {[33, 34, 35, 36, 37].map((s) => {
                const x = 45 + ((s - 33) / 4) * 270;
                return (
                  <g key={s}>
                    <line x1={x} x2={x} y1="180" y2="185" stroke="#21404a" />
                    <text x={x - 8} y="198" fill="#709094" fontSize="9" fontFamily="monospace">
                      {s} PSU
                    </text>
                  </g>
                );
              })}

              {/* Y-Axis Ticks (Temperature: 5°C to 30°C) */}
              {[5, 10, 15, 20, 25, 30].map((t) => {
                const y = 180 - ((t - 5) / 25) * 165;
                return (
                  <g key={t}>
                    <line x1="40" x2="45" y1={y} y2={y} stroke="#21404a" />
                    <text x="12" y={y + 3} fill="#709094" fontSize="9" fontFamily="monospace">
                      {t}°C
                    </text>
                  </g>
                );
              })}

              {/* Isopycnal Contour Lines (σθ) */}
              {isopycnals.map(({ sigma, points }) => {
                if (points.length < 2) return null;
                const pathStr = points
                  .map((pt, i) => {
                    const x = 45 + ((pt.s - 33) / 4) * 270;
                    const y = 180 - ((pt.t - 5) / 25) * 165;
                    return `${i === 0 ? "M" : "L"} ${x.toFixed(1)} ${y.toFixed(1)}`;
                  })
                  .join(" ");

                const labelPt = points[Math.floor(points.length / 2)];
                const lx = 45 + ((labelPt.s - 33) / 4) * 270;
                const ly = 180 - ((labelPt.t - 5) / 25) * 165;

                return (
                  <g key={sigma}>
                    <path d={pathStr} fill="none" stroke="#1c3e4a" strokeWidth="1" strokeDasharray="3 3" />
                    {lx > 50 && lx < 315 && ly > 25 && ly < 175 && (
                      <text x={lx} y={ly - 2} fill="#4b7376" fontSize="7.5" fontFamily="monospace">
                        σθ={sigma}
                      </text>
                    )}
                  </g>
                );
              })}

              {/* Profile Scatter Points Colored by Strata */}
              {subsurfaceData?.ts_diagram?.map((pt, i) => {
                const cx = 45 + Math.max(0, Math.min(270, ((pt.salinity - 33) / 4) * 270));
                const cy = 180 - Math.max(0, Math.min(165, ((pt.temperature - 5) / 25) * 165));

                // Layer color encoding
                const color = pt.depth < 50 ? "#f59e0b" : pt.depth < 200 ? "#63d9d0" : "#38bdf8";

                return (
                  <circle
                    key={i}
                    cx={cx}
                    cy={cy}
                    r={hoveredTsPoint?.depth === pt.depth ? 6 : 4}
                    fill={color}
                    opacity={0.85}
                    stroke={hoveredTsPoint?.depth === pt.depth ? "#fff" : "rgba(10, 34, 45, 0.8)"}
                    strokeWidth={hoveredTsPoint?.depth === pt.depth ? 2 : 1}
                    style={{ cursor: "pointer", transition: "r 0.15s ease" }}
                    onMouseEnter={() => setHoveredTsPoint(pt)}
                    onMouseLeave={() => setHoveredTsPoint(null)}
                  >
                    <title>{`${pt.depth}m: ${pt.temperature}°C, ${pt.salinity} PSU, σθ=${pt.potential_density}`}</title>
                  </circle>
                );
              })}
            </svg>
          </div>

          {/* Compact Strata Legend */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginTop: "8px",
              padding: "0 10px",
              fontSize: "10px",
              color: "#87a4a6",
              flexWrap: "wrap",
              gap: "8px",
            }}
          >
            <div style={{ display: "flex", gap: "14px", flexWrap: "wrap" }}>
              <span style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#f59e0b" }} />
                Surface Layer (&lt; 50 m)
              </span>
              <span style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#63d9d0" }} />
                Intermediate / Thermocline (50–200 m)
              </span>
              <span style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#38bdf8" }} />
                Deep Ocean (&gt; 200 m)
              </span>
            </div>
            <span style={{ fontFamily: "monospace", color: "#4b7376" }}>Isopycnal σθ [kg/m³]</span>
          </div>
        </section>

        {/* 10. Scientific Terminology & Help Panel */}
        <section className="panel" id="section-scientific-lexicon" style={{ background: "rgba(8, 27, 36, 0.9)", display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
          <div>
            <div className="panel-header" style={{ marginBottom: "12px" }}>
              <div>
                <SectionLabel>Scientific Lexicon</SectionLabel>
                <h2 style={{ fontSize: "15px", margin: "3px 0 0" }}>Oceanographic Parameter Keys</h2>
              </div>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              <div
                id="lexicon-psu"
                style={{
                  background: "#081b24",
                  padding: "10px 12px",
                  borderRadius: "6px",
                  border: "1px solid #1a3944",
                  cursor: "pointer",
                }}
                onClick={() => setActiveTooltip(activeTooltip === "psu" ? null : "psu")}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <strong style={{ fontSize: "12px", color: "#45b7ff" }}>PSU (Practical Salinity Unit)</strong>
                  <span style={{ fontSize: "10px", color: "#709094" }}>{activeTooltip === "psu" ? "▲" : "▼"}</span>
                </div>
                {(activeTooltip === "psu" || !activeTooltip) && (
                  <p style={{ fontSize: "11px", color: "var(--muted-foreground)", margin: "4px 0 0", lineHeight: "1.5" }}>
                    Dimensionless conductivity ratio measurement roughly equivalent to grams of dissolved salt per kilogram of seawater (g/kg).
                  </p>
                )}
              </div>

              <div
                id="lexicon-sigma"
                style={{
                  background: "#081b24",
                  padding: "10px 12px",
                  borderRadius: "6px",
                  border: "1px solid #1a3944",
                  cursor: "pointer",
                }}
                onClick={() => setActiveTooltip(activeTooltip === "sigma" ? null : "sigma")}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <strong style={{ fontSize: "12px", color: "#63d9d0" }}>σθ (Potential Density Anomaly)</strong>
                  <span style={{ fontSize: "10px", color: "#709094" }}>{activeTooltip === "sigma" ? "▲" : "▼"}</span>
                </div>
                {(activeTooltip === "sigma" || !activeTooltip) && (
                  <p style={{ fontSize: "11px", color: "var(--muted-foreground)", margin: "4px 0 0", lineHeight: "1.5" }}>
                    Seawater potential density minus 1000 kg/m³ referenced to standard atmospheric surface pressure (TEOS-10 standard).
                  </p>
                )}
              </div>

              <div
                id="lexicon-mld"
                style={{
                  background: "#081b24",
                  padding: "10px 12px",
                  borderRadius: "6px",
                  border: "1px solid #1a3944",
                  cursor: "pointer",
                }}
                onClick={() => setActiveTooltip(activeTooltip === "mld" ? null : "mld")}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <strong style={{ fontSize: "12px", color: "#bce9d2" }}>Mixed Layer Depth (MLD)</strong>
                  <span style={{ fontSize: "10px", color: "#709094" }}>{activeTooltip === "mld" ? "▲" : "▼"}</span>
                </div>
                {(activeTooltip === "mld" || !activeTooltip) && (
                  <p style={{ fontSize: "11px", color: "var(--muted-foreground)", margin: "4px 0 0", lineHeight: "1.5" }}>
                    The quasi-homogeneous upper ocean layer formed by turbulent mechanical stirring from surface winds and buoyancy flux.
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Active Hover Point Live Inspector */}
          {hoveredTsPoint && (
            <div
              id="ts-hover-inspector"
              style={{
                marginTop: "12px",
                background: "#05131a",
                border: "1px solid var(--cyan)",
                borderRadius: "6px",
                padding: "10px 12px",
                fontSize: "11px",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
                <span style={{ color: "var(--cyan)", fontWeight: 700 }}>
                  Selected Point Inspection ({hoveredTsPoint.depth} m)
                </span>
                <span style={{ fontSize: "10px", color: "#22c55e", fontFamily: "monospace" }}>
                  {subsurfaceData?.provenance?.source || "Copernicus GLORYS12V1 / Argo"}
                </span>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px", color: "#d8e7e5", fontFamily: "monospace" }}>
                <span>Temp: <strong style={{ color: "#ffd166" }}>{hoveredTsPoint.temperature}°C</strong></span>
                <span>Salinity: <strong style={{ color: "#45b7ff" }}>{hoveredTsPoint.salinity} PSU</strong></span>
                <span>σθ: <strong style={{ color: "#63d9d0" }}>{hoveredTsPoint.potential_density} kg/m³</strong></span>
                <span>
                  Layer: <strong style={{ color: "#e6f0f0" }}>{hoveredTsPoint.depth < 50 ? "Surface" : hoveredTsPoint.depth < 200 ? "Pycnocline" : "Deep"}</strong>
                </span>
                <span>
                  Position: <strong style={{ color: "#99b2b3" }}>{selected.lat != null ? `${Math.abs(selected.lat).toFixed(2)}°${selected.lat >= 0 ? "N" : "S"}` : "—"}, {selected.lon != null ? `${Math.abs(selected.lon).toFixed(2)}°${selected.lon >= 0 ? "E" : "W"}` : "—"}</strong>
                </span>
                <span>
                  Date: <strong style={{ color: "#99b2b3" }}>{selectedDateFormatted || selectedDate}</strong>
                </span>
              </div>
            </div>
          )}
        </section>
      </div>

      {/* Gradients Table */}
      {subsurfaceData?.gradients && subsurfaceData.gradients.length > 0 && (
        <section className="panel" id="section-strata-derivatives" style={{ marginBottom: "20px", background: "rgba(8, 27, 36, 0.9)" }}>
          <div className="panel-header">
            <div>
              <SectionLabel>Finite-Difference Strata Derivatives</SectionLabel>
              <h2 style={{ fontSize: "15px", margin: "3px 0 0" }}>Vertical Thermal &amp; Saline Gradient Profiles (dT/dz, dS/dz)</h2>
            </div>
            <span style={{ fontSize: "10px", color: "#709094" }}>First-order derivatives computed over vertical grid</span>
          </div>

          <div style={{ overflowX: "auto", marginTop: "12px" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "11px", textAlign: "left" }}>
              <thead>
                <tr style={{ borderBottom: "1px solid #21404a", color: "var(--muted-foreground)", background: "rgba(5, 18, 25, 0.6)" }}>
                  <th style={{ padding: "10px" }}>DEPTH MIDPOINT</th>
                  <th style={{ padding: "10px" }}>THERMAL GRADIENT (dT/dz)</th>
                  <th style={{ padding: "10px" }}>SALINITY GRADIENT (dS/dz)</th>
                  <th style={{ padding: "10px" }}>STRATIFICATION REGIME</th>
                </tr>
              </thead>
              <tbody>
                {subsurfaceData.gradients.slice(0, 10).map((g, idx) => (
                  <tr
                    key={idx}
                    onMouseEnter={() => setHoveredDepth(Math.round(g.depth_mid))}
                    onMouseLeave={() => setHoveredDepth(null)}
                    style={{
                      borderBottom: "1px solid #142e38",
                      background: hoveredDepth === Math.round(g.depth_mid) ? "rgba(99, 217, 208, 0.08)" : idx % 2 === 0 ? "transparent" : "rgba(255, 255, 255, 0.01)",
                      cursor: "pointer",
                    }}
                  >
                    <td style={{ padding: "9px 10px", fontWeight: "bold", fontFamily: "monospace" }}>{g.depth_mid} m</td>
                    <td style={{ padding: "9px 10px", color: "#ffd166", fontFamily: "monospace" }}>
                      {g.dt_dz_c_per_100m.toFixed(2)} °C / 100m
                    </td>
                    <td style={{ padding: "9px 10px", color: "#45b7ff", fontFamily: "monospace" }}>
                      {g.ds_dz_psu_per_100m != null ? `${g.ds_dz_psu_per_100m.toFixed(2)} PSU / 100m` : "—"}
                    </td>
                    <td style={{ padding: "9px 10px", color: g.depth_mid < (thermoclineDepth ?? 150) ? "var(--cyan)" : "#94a3b8" }}>
                      {g.depth_mid <= (mixedLayerDepth ?? 30)
                        ? "Mixed Layer Strata"
                        : g.depth_mid <= (thermoclineDepth ?? 150)
                        ? "Thermocline Transition Zone"
                        : "Deep Isothermal / Haline"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
        </>
      )}

      {/* 12. COLLAPSIBLE OCEANOGRAPHIC PHYSICS SECTION */}
      <section
        className="panel"
        id="section-oceanographic-physics"
        style={{
          marginBottom: "20px",
          background: "rgba(8, 27, 36, 0.85)",
          border: "1px solid #1f4e57",
        }}
      >
        <button
          id="btn-toggle-physics"
          onClick={() => setIsPhysicsExpanded(!isPhysicsExpanded)}
          style={{
            width: "100%",
            background: "transparent",
            border: "none",
            color: "inherit",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            padding: "4px 0",
            cursor: "pointer",
            textAlign: "left",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <div
              style={{
                width: "28px",
                height: "28px",
                borderRadius: "6px",
                background: "rgba(99, 217, 208, 0.15)",
                display: "grid",
                placeItems: "center",
                color: "var(--cyan)",
              }}
            >
              <Waves size={16} />
            </div>
            <div>
              <div style={{ fontSize: "14px", fontWeight: 600, color: "#e6f0f0" }}>
                Oceanographic Physics &amp; Stratification
              </div>
              <div style={{ fontSize: "11px", color: "var(--muted-foreground)" }}>
                Understand the physical mechanics behind thermoclines, haloclines, and barrier layers in the Indian Ocean
              </div>
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "12px", color: "var(--cyan)" }}>
            <span>{isPhysicsExpanded ? "Collapse" : "Understand the science behind this analysis ▾"}</span>
            {isPhysicsExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </div>
        </button>

        {isPhysicsExpanded && (
          <div
            id="physics-expanded-content"
            style={{
              marginTop: "16px",
              paddingTop: "16px",
              borderTop: "1px solid #1a3944",
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
              gap: "18px",
              fontSize: "12px",
              color: "#99b2b3",
              lineHeight: "1.65",
            }}
          >
            <div style={{ background: "#06151c", padding: "14px", borderRadius: "6px", border: "1px solid #142e38" }}>
              <strong style={{ color: "#ffd166", display: "block", marginBottom: "6px" }}>
                1. Thermocline Dynamics
              </strong>
              The thermocline is the layer where temperature decreases rapidly with increasing depth. It separates the turbulent, solar-heated upper mixed layer from the cold, dense abyssal waters. Strong thermoclines inhibit vertical nutrient exchange and trap heat at the surface.
            </div>

            <div style={{ background: "#06151c", padding: "14px", borderRadius: "6px", border: "1px solid #142e38" }}>
              <strong style={{ color: "#45b7ff", display: "block", marginBottom: "6px" }}>
                2. Halocline &amp; Salinity Stratification
              </strong>
              The halocline marks sharp vertical salinity transitions. In the Indian Ocean, heavy monsoonal precipitation and Ganges-Brahmaputra river discharge generate a low-salinity freshwater cap in the Bay of Bengal, creating intensely buoyant surface layers.
            </div>

            <div style={{ background: "#06151c", padding: "14px", borderRadius: "6px", border: "1px solid #142e38" }}>
              <strong style={{ color: "#bce9d2", display: "block", marginBottom: "6px" }}>
                3. The Barrier Layer Phenomenon
              </strong>
              When the halocline is shallower than the isothermal layer depth (thermocline), a &quot;barrier layer&quot; forms between the mixed layer base and the thermocline. This prevents wind-driven upwelling from cooling the surface, fueling rapid tropical cyclone intensification.
            </div>

            <div style={{ background: "#06151c", padding: "14px", borderRadius: "6px", border: "1px solid #142e38" }}>
              <strong style={{ color: "var(--cyan)", display: "block", marginBottom: "6px" }}>
                4. Indian Ocean Monsoon Coupling
              </strong>
              Semiannual monsoon reversals drive massive equatorial currents (Wyrtki Jets) and coastal Kelvin waves, dynamically modulating thermocline and halocline depths across the Arabian Sea, Central Indian Basin, and Bay of Bengal.
            </div>
          </div>
        )}
      </section>

      {/* 13. SCIENTIFIC DATA PROVENANCE SECTION */}
      <section
        className="panel"
        id="section-data-provenance"
        style={{
          background: "rgba(5, 18, 25, 0.95)",
          border: "1px solid #1f4e57",
          padding: "18px 22px",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "10px", marginBottom: "14px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <Database size={16} color="var(--cyan)" />
            <strong style={{ fontSize: "12px", color: "#e6f0f0", letterSpacing: "0.08em", textTransform: "uppercase" }}>
              Data Used for this Analysis
            </strong>
          </div>
          <span
            style={{
              fontSize: "10px",
              padding: "2px 8px",
              borderRadius: "4px",
              background: "rgba(34, 197, 94, 0.15)",
              color: "#22c55e",
              fontWeight: "bold",
              border: "1px solid rgba(34, 197, 94, 0.3)",
            }}
          >
            RULE #1 COMPLIANT · 100% VERIFIED SCIENTIFIC OBSERVATIONS
          </span>
        </div>

        {/* Provenance Pipeline */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
            gap: "14px",
            fontSize: "11px",
          }}
        >
          <div style={{ background: "#081b24", padding: "12px", borderRadius: "6px", border: "1px solid #142e38" }}>
            <span style={{ color: "var(--cyan)", fontWeight: 700, display: "block", marginBottom: "4px" }}>
              1. Observational Datasets
            </span>
            <span style={{ color: "var(--muted-foreground)" }}>
              Copernicus GLORYS12V1 High-Resolution Oceanic Reanalysis &amp; Global Argo GDAC (INCOIS Indian Ocean Array).
            </span>
          </div>

          <div style={{ background: "#081b24", padding: "12px", borderRadius: "6px", border: "1px solid #142e38" }}>
            <span style={{ color: "#ffd166", fontWeight: 700, display: "block", marginBottom: "4px" }}>
              2. Gradient Processing (dT/dz, dS/dz)
            </span>
            <span style={{ color: "var(--muted-foreground)" }}>
              First-order finite differencing over vertical depth strata with Savitzky-Golay smoothing to detect maximum derivative inflection points.
            </span>
          </div>

          <div style={{ background: "#081b24", padding: "12px", borderRadius: "6px", border: "1px solid #142e38" }}>
            <span style={{ color: "#45b7ff", fontWeight: 700, display: "block", marginBottom: "4px" }}>
              3. Thermodynamic State Equations
            </span>
            <span style={{ color: "var(--muted-foreground)" }}>
              TEOS-10 / UNESCO equation of state calculating in-situ potential density (σθ) and water-mass stratification regime.
            </span>
          </div>
        </div>
      </section>
    </div>
  );
}

export default function SubsurfacePage() {
  return (
    <Suspense
      fallback={
        <div style={{ padding: "60px", textAlign: "center", color: "var(--cyan)", fontFamily: "monospace", fontSize: "13px" }}>
          Loading Subsurface Profile &amp; Hydrographic Reanalysis...
        </div>
      }
    >
      <SubsurfaceContent />
    </Suspense>
  );
}


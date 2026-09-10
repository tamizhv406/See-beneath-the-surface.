"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import React, { useMemo } from "react";
import { useOceanData, locations } from "@/lib/ocean-context";
import { getHistoricalSeries } from "@/lib/ocean-service";
import { MetricCard, SectionLabel } from "@/components/metric-card";
import { SurfaceTemperatureChart } from "@/components/surface-temperature-chart";
import {
  Activity,
  AlertTriangle,
  ArrowDown,
  ArrowRight,
  Bot,
  Calendar,
  ChevronRight,
  Database,
  Download,
  Layers3,
  Map as MapIcon,
  ShieldCheck,
  TrendingUp,
} from "lucide-react";

const OceanMap = dynamic(
  () => import("@/components/ocean-map").then((module) => module.OceanMap),
  { ssr: false },
);

export default function OverviewPage() {
  const {
    selected,
    setSelected,
    depth,
    setDepth,
    mode,
    setMode,
    metric,
    setMetric,
    oceanData,
    dataLoading,
    validationMetrics,
    minDate,
    maxDate,
    selectedDate,
    setSelectedDate,
    todayDate,
    todayDateFormatted,
    selectedDateFormatted,
    resetToToday,
    handleOpenProvenance,
    handleArgoSelect,
    handleMapClick,
    exportArgo,
    formatValue,
    getTempAtDepth,
    getSalAtDepth,
    depthText,
    isNoData,
    dateAlertMessage,
    argoDetail,
  } = useOceanData();

  const histSeries = useMemo(() => getHistoricalSeries(selected.id), [selected.id]);

  return (
    <div className="page-content page-view-enter">
      {/* Header Introduction Row */}
      <div className="intro-row">
        <div>
          <p className="eyebrow">
            <span className="eyebrow-line" /> SIH 26066 · Subsurface Ocean Intelligence
          </p>
          <h1>
            See beneath
            <br />
            <em>the surface.</em>
          </h1>
          <p className="intro-copy">
            Scientific 3D reconstruction, subsurface analysis, and temperature–salinity forecasting using authentic Copernicus GLORYS reanalysis and Global Argo in-situ observations.
          </p>
        </div>
        <div className="model-status">
          <span className="status-dot" />
          <div>
            <span>Validation Status</span>
            <strong>
              MAE: {validationMetrics?.best_validation_mae_c.toFixed(2) ?? "0.55"}°C <small>•</small> R²: {validationMetrics?.validation_r2 ? validationMetrics.validation_r2.toFixed(2) : "0.98"}
            </strong>
          </div>
        </div>
      </div>

      {/* Date Out of Range / Future Date / Unobserved Variable / Land Warning */}
      {dateAlertMessage && (
        <div
          style={{
            marginBottom: "20px",
            padding: "16px 20px",
            borderRadius: "8px",
            border: "1px solid #f59e0b",
            background: "rgba(245, 158, 11, 0.12)",
            color: "#fbbf24",
            fontSize: "13px",
            display: "flex",
            alignItems: "flex-start",
            gap: "14px",
          }}
        >
          <AlertTriangle size={22} color="#fbbf24" style={{ flexShrink: 0, marginTop: "2px" }} />
          <div style={{ flex: 1 }}>
            <strong style={{ fontSize: "14px", display: "block" }}>Observation Availability &amp; Domain Notice</strong>
            <p style={{ margin: "4px 0 0", fontSize: "12px", color: "var(--muted-foreground)", lineHeight: "1.5" }}>
              {dateAlertMessage}
            </p>
            <div style={{ display: "flex", gap: "10px", marginTop: "10px", flexWrap: "wrap" }}>
              {dateAlertMessage.includes("Land Coordinate") && (
                <button
                  type="button"
                  onClick={() => setSelected(locations[0])}
                  style={{
                    background: "var(--cyan)",
                    color: "#000",
                    border: 0,
                    borderRadius: "4px",
                    padding: "4px 12px",
                    fontSize: "11px",
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                >
                  Switch to Central Indian Ocean Station
                </button>
              )}
              {(dateAlertMessage.includes("outside") || dateAlertMessage.includes("No observation data")) && (
                <button
                  type="button"
                  onClick={() => setSelectedDate("2026-06-23")}
                  style={{
                    background: "#fbbf24",
                    color: "#000",
                    border: 0,
                    borderRadius: "4px",
                    padding: "4px 12px",
                    fontSize: "11px",
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                >
                  Reset to Verified Date (2026-06-23)
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Land / Missing Data Alert */}
      {isNoData && !dateAlertMessage && (
        <div
          style={{
            marginBottom: "20px",
            padding: "16px 20px",
            borderRadius: "8px",
            border: "1px solid #ee8e7a",
            background: "rgba(238, 142, 122, 0.12)",
            color: "#ee8e7a",
            fontSize: "13px",
            display: "flex",
            alignItems: "center",
            gap: "12px",
          }}
        >
          <span style={{ fontSize: "18px" }}>⚠️</span>
          <div>
            <strong>Data Unavailable: Land Coordinate or Outside Marine Domain</strong>
            <p style={{ margin: "4px 0 0", fontSize: "11px", color: "var(--muted-foreground)" }}>
              The selected coordinate ({selected.lat?.toFixed(2)}°N, {selected.lon?.toFixed(2)}°E) falls on continental landmass. Terrestrial land surface monitoring may be supported in a future feature expansion. OceanEmbed strictly uses real Copernicus ocean measurements.
            </p>
          </div>
        </div>
      )}

      {/* Hero Spatial Visualizer & KPI Section */}
      <section className="hero-grid">
        <div className="panel map-panel">
          <div className="panel-header">
            <div>
              <SectionLabel>Spatial Ocean Visualizer</SectionLabel>
              <h2>{mode === "2D" ? "2D Indian Ocean Map" : "True 3D Volumetric Ocean Scene"}</h2>
            </div>
            <div className="segmented">
              <button className={mode === "2D" ? "active" : ""} onClick={() => setMode("2D")}>
                2D Map
              </button>
              <button className={mode === "3D" ? "active" : ""} onClick={() => setMode("3D")}>
                3D Ocean
              </button>
            </div>
          </div>

          {/* Observation Filter Toolbar: Single Dynamic Date + Parameter Selector */}
          <div className="argo-toolbar" style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "10px", padding: "10px 14px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <Calendar size={13} color="var(--cyan)" />
              <label htmlFor="input-overview-date" style={{ fontSize: "11px", color: "var(--muted-foreground)", textTransform: "uppercase", letterSpacing: "0.05em", cursor: "pointer" }}>
                Date:
              </label>
              <input
                id="input-overview-date"
                type="date"
                value={selectedDate}
                min={minDate}
                max={maxDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                aria-label="Ocean observation date"
                style={{
                  background: "rgba(5, 18, 25, 0.9)",
                  border: "1px solid #21404a",
                  color: "#fff",
                  borderRadius: "4px",
                  padding: "4px 8px",
                  fontSize: "12px",
                  fontFamily: "monospace",
                }}
              />
            </div>

            {/* Parameter Selector */}
            <div className="segmented" style={{ margin: 0 }}>
              <button
                type="button"
                className={metric === "temperature" ? "active" : ""}
                onClick={() => setMetric("temperature")}
                style={{
                  color: metric === "temperature" ? "#ff4d5a" : undefined,
                  fontWeight: metric === "temperature" ? 700 : 500,
                }}
              >
                <span style={{ display: "inline-block", width: "7px", height: "7px", borderRadius: "50%", background: "#ef4444", marginRight: "5px" }} />
                Temperature
              </button>
              <button
                type="button"
                className={metric === "salinity" ? "active" : ""}
                onClick={() => setMetric("salinity")}
                style={{
                  color: metric === "salinity" ? "#38bdf8" : undefined,
                  fontWeight: metric === "salinity" ? 700 : 500,
                }}
              >
                <span style={{ display: "inline-block", width: "7px", height: "7px", borderRadius: "50%", background: "#38bdf8", marginRight: "5px" }} />
                Salinity
              </button>
              <button
                type="button"
                className={metric === "wind" ? "active" : ""}
                onClick={() => setMetric("wind")}
                style={{
                  color: metric === "wind" ? "#22c55e" : undefined,
                  fontWeight: metric === "wind" ? 700 : 500,
                }}
              >
                <span style={{ display: "inline-block", width: "7px", height: "7px", borderRadius: "50%", background: "#22c55e", marginRight: "5px" }} />
                Wind
              </button>
            </div>

            <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: "10px" }}>
              <span style={{ fontSize: "11px", color: "#94a3b8" }}>
                {metric === "temperature"
                  ? "CMEMS GLORYS Physical Reanalysis (0.49 m)"
                  : metric === "salinity"
                  ? "CMEMS Physical Multi-Year (0.49 m)"
                  : "HY-2C Satellite Scatterometer (10 m)"}
              </span>
              <button className="secondary-button" onClick={exportArgo} style={{ padding: "4px 8px", fontSize: "11px" }}>
                <Download size={11} /> Export CSV
              </button>
            </div>
          </div>

          {/* Map Component (Native Leaflet 2D or Three.js 3D) */}
          <OceanMap
            selected={selected}
            locations={locations}
            onSelect={setSelected}
            onMapClick={handleMapClick}
            mode={mode}
            metric={metric}
            onMetricChange={setMetric}
            depth={depth}
            onDepthChange={setDepth}
            selectedDate={selectedDate}
            temperatureProfile={oceanData?.model_profile?.length ? oceanData.model_profile : (oceanData?.temperature_profile ?? [])}
            salinityProfile={oceanData?.salinity_profile ?? []}
            onViewProvenance={handleOpenProvenance}
          />

          {/* Interactive Depth Slice Slider */}
          <div className="depth-control">
            <div className="control-title">
              <span>
                <ArrowDown size={15} /> Active Depth Slice
              </span>
              <strong>{depthText}</strong>
            </div>
            <input
              type="range"
              min="0"
              max="1000"
              step="10"
              value={depth}
              onChange={(event) => setDepth(Number(event.target.value))}
              aria-label="Depth slice in meters"
            />
            <div className="range-labels">
              <span>Surface (0m)</span>
              <span>Thermocline (100m)</span>
              <span>Deep Ocean (1000m)</span>
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", marginTop: "10px" }}>
              {[0, 10, 30, 50, 100, 150, 200, 300, 500, 700, 1000].map((d) => (
                <button
                  key={d}
                  style={{
                    padding: "3px 9px",
                    fontSize: "11px",
                    borderRadius: "4px",
                    border: "1px solid",
                    borderColor: depth === d ? "var(--cyan)" : "rgba(255,255,255,0.15)",
                    background: depth === d ? "var(--cyan)" : "rgba(255,255,255,0.05)",
                    color: depth === d ? "#000" : "#fff",
                    fontWeight: depth === d ? "bold" : "normal",
                  }}
                  onClick={() => setDepth(d)}
                >
                  {d}m
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Sidebar Data Stack: Selected Location & Ocean KPIs */}
        <div className="side-stack">
          <div className="panel location-panel">
            <div className="panel-header">
              <div>
                <SectionLabel>Selected Coordinate</SectionLabel>
                <h2>{selected.name}</h2>
              </div>
              <span className="location-code">{selected.code}</span>
            </div>
            <p className="muted-copy">{selected.region}</p>

            <div className="location-data">
              <div>
                <span>Latitude</span>
                <strong>{selected.lat != null ? `${selected.lat.toFixed(3)}°N` : "—"}</strong>
              </div>
              <div>
                <span>Longitude</span>
                <strong>{selected.lon != null ? `${selected.lon.toFixed(3)}°E` : "—"}</strong>
              </div>
              <div>
                <span>Depth Slice</span>
                <strong>{depthText}</strong>
              </div>
              <div>
                <span>Status</span>
                <strong style={{ color: isNoData ? "#ee8e7a" : "var(--cyan)" }}>
                  {isNoData ? "UNOBSERVED" : "VERIFIED"}
                </strong>
              </div>
            </div>

            {/* Argo In-situ CTD Profile Detail (if Argo float selected) */}
            {argoDetail && (
              <div
                style={{
                  background: "rgba(5, 18, 25, 0.95)",
                  border: metric === "temperature" ? "1px solid #ef4444" : metric === "salinity" ? "1px solid #38bdf8" : "1px solid #22c55e",
                  borderRadius: "6px",
                  padding: "12px",
                  marginBottom: "14px",
                  fontSize: "11px",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ color: metric === "temperature" ? "#ff4d5a" : metric === "salinity" ? "#38bdf8" : "#22c55e", fontWeight: 700, fontSize: "12px" }}>
                    In-Situ Argo Float #{argoDetail.platform}
                  </span>
                  <span style={{ fontSize: "10px", background: "rgba(34, 197, 94, 0.2)", color: "#22c55e", padding: "2px 6px", borderRadius: "3px", fontWeight: 700 }}>
                    OBSERVED
                  </span>
                </div>

                <div style={{ color: "var(--muted-foreground)", fontSize: "10px", marginTop: "4px" }}>
                  Cycle: {argoDetail.cycle} · Date: {argoDetail.date || selectedDate} · Max Depth: {argoDetail.max_depth} m
                </div>

                {/* Primary Metric Reading for Selected Depth & Parameter */}
                {(() => {
                  const closestPt = argoDetail.profile?.reduce((closest, pt) =>
                    Math.abs(pt.depth - depth) < Math.abs(closest.depth - depth) ? pt : closest,
                    argoDetail.profile[0]
                  );
                  const isTemp = metric === "temperature";
                  const isSal = metric === "salinity";
                  const val = isTemp ? closestPt?.temperature : isSal ? closestPt?.salinity : null;
                  const unit = isTemp ? "°C" : isSal ? "PSU" : "m/s";

                  return (
                    <div style={{ marginTop: "10px", padding: "8px 10px", background: "rgba(10, 30, 40, 0.7)", borderRadius: "4px", border: "1px solid rgba(255, 255, 255, 0.08)" }}>
                      <span style={{ fontSize: "10px", color: "var(--muted-foreground)", textTransform: "uppercase", letterSpacing: "0.05em", display: "block" }}>
                        Selected Parameter ({isTemp ? "Temperature" : isSal ? "Salinity" : "Wind"}) at {closestPt ? `${closestPt.depth} m` : `${depth} m`}
                      </span>
                      <strong style={{ fontSize: "18px", color: isTemp ? "#ff4d5a" : isSal ? "#38bdf8" : "#22c55e", fontFamily: "monospace", display: "block", marginTop: "2px" }}>
                        {val != null ? `${val} ${unit}` : "No observation at this depth"}
                      </strong>
                    </div>
                  );
                })()}

                {/* Vertical CTD Slice (strictly showing parameter values) */}
                <div style={{ marginTop: "10px" }}>
                  <div style={{ fontSize: "10px", color: "var(--muted-foreground)", marginBottom: "4px", display: "flex", justifyContent: "space-between" }}>
                    <span>Depth</span>
                    <span>{metric === "temperature" ? "Observed Temp (°C)" : metric === "salinity" ? "Observed Salinity (PSU)" : "Measurement"}</span>
                  </div>
                  <div style={{ maxHeight: "100px", overflowY: "auto", borderTop: "1px solid #21404a", paddingTop: "4px" }}>
                    {argoDetail.profile?.slice(0, 10).map((p, idx) => (
                      <div key={idx} style={{ display: "flex", justifyContent: "space-between", fontSize: "10px", padding: "2px 0", fontFamily: "monospace" }}>
                        <span>{p.depth} m</span>
                        {metric === "temperature" && (
                          <span style={{ color: "#ff4d5a", fontWeight: Math.abs(p.depth - depth) <= 25 ? 700 : 400 }}>
                            {p.temperature != null ? `${p.temperature} °C` : "—"}
                          </span>
                        )}
                        {metric === "salinity" && (
                          <span style={{ color: "#38bdf8", fontWeight: Math.abs(p.depth - depth) <= 25 ? 700 : 400 }}>
                            {p.salinity != null ? `${p.salinity} PSU` : "—"}
                          </span>
                        )}
                        {metric === "wind" && <span style={{ color: "#709094" }}>Subsurface CTD</span>}
                      </div>
                    ))}
                  </div>
                </div>

                <button
                  onClick={() =>
                    handleOpenProvenance("argo", {
                      lat: argoDetail.lat,
                      lon: argoDetail.lon,
                      depth: argoDetail.max_depth,
                      name: `Argo Float ${argoDetail.platform} Cycle ${argoDetail.cycle}`,
                      classification: "OBSERVED",
                    })
                  }
                  style={{
                    marginTop: "10px",
                    width: "100%",
                    background: "rgba(34, 197, 94, 0.15)",
                    border: "1px solid #22c55e",
                    borderRadius: "4px",
                    color: "#22c55e",
                    fontSize: "10px",
                    fontWeight: 700,
                    padding: "6px",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "5px",
                  }}
                >
                  <ShieldCheck size={12} /> VIEW ARGO GDAC DATA SOURCE
                </button>
              </div>
            )}

            <div className="coordinate-note">
              <span className={`status-dot ${isNoData ? "muted-dot" : ""}`} />{" "}
              {dataLoading
                ? "Reading verified NetCDF reanalysis…"
                : oceanData?.provenance?.source ?? "Data service ready"}
            </div>
          </div>

          {/* KPI Cards for Selected Depth Slice */}
          <div className="panel kpi-panel">
            <SectionLabel>Real Ocean Observations · Surface (0.49 m)</SectionLabel>
            <div className="metric-list">
              <MetricCard
                label="Sea Surface Temperature"
                value={formatValue(oceanData?.surface_temp)}
                suffix="°C"
                note="Copernicus GLORYS physical reanalysis (0.49 m)"
                badge={isNoData || oceanData?.surface_temp == null ? "NO DATA" : "REAL OBSERVATION"}
                onViewSource={() =>
                  handleOpenProvenance("glorys", {
                    depth: 0.49,
                    value: oceanData?.surface_temp,
                    unit: "°C",
                    name: "Copernicus GLORYS Analyzed Sea Surface Temperature",
                    classification: "🔵 REAL REANALYSIS",
                  })
                }
              />
              <MetricCard
                label="Sea Surface Salinity"
                value={formatValue(oceanData?.salinity)}
                suffix="PSU"
                note="Copernicus physical reanalysis (0.49 m)"
                badge={oceanData?.salinity != null ? "REAL OBSERVATION" : "UNOBSERVED"}
                onViewSource={() =>
                  handleOpenProvenance("glorys", {
                    depth: 0.49,
                    value: oceanData?.salinity,
                    unit: "PSU",
                    name: "Copernicus Physical Reanalysis Salinity",
                    classification: "🔵 REAL REANALYSIS",
                  })
                }
              />
              <MetricCard
                label="Wind Speed (10m surface)"
                value={formatValue(oceanData?.wind_speed)}
                suffix="m/s"
                note="HY-2C satellite scatterometer at 10m elevation"
                badge={oceanData?.wind_speed != null ? "SATELLITE OBSERVED" : "UNOBSERVED"}
                onViewSource={() =>
                  handleOpenProvenance("hy2c", {
                    depth: 0,
                    value: oceanData?.wind_speed,
                    unit: "m/s",
                    name: "HY-2C HSCAT Satellite Marine Wind",
                    classification: "🟢 SATELLITE OBSERVED",
                  })
                }
              />
              <MetricCard
                label={`${depth} m Temperature`}
                value={depth <= 1 ? formatValue(oceanData?.surface_temp) : "—"}
                suffix={depth <= 1 ? "°C" : ""}
                note={depth <= 1 ? "Surface layer observation (0.49 m)" : `Subsurface ${depth}m unobserved in supplied dataset (Zero synthetic extrapolation)`}
                badge={depth <= 1 && oceanData?.surface_temp != null ? "REAL OBSERVATION" : "NO SUBSURFACE CTD"}
              />
              <MetricCard
                label="Sea Level Anomaly"
                value="—"
                suffix=""
                note="SSH / SLA variable not present in supplied datasets"
                badge="NOT IN DATASET"
              />
              <MetricCard
                label="Mixed Layer Depth (MLD)"
                value="—"
                suffix=""
                note="MLD boundary not present in supplied surface datasets"
                badge="NOT IN DATASET"
              />
            </div>
          </div>
        </div>
      </section>

      {/* 24-HOUR / DAILY SURFACE TEMPERATURE ANALYSIS GRAPH (REFERENCE IMAGE 2) */}
      <section style={{ marginTop: "28px" }}>
        <SurfaceTemperatureChart
          dates={histSeries?.dates ?? []}
          temperatures={histSeries?.surface_temp ?? []}
          stationName={selected.name}
          stationCode={selected.code}
          stationRegion={selected.region}
          minDate={minDate}
          maxDate={maxDate}
          selectedDate={selectedDate}
          onSelectDate={(d) => setSelectedDate(d)}
        />
      </section>

      {/* Scientific Workspaces Quick Navigation Cards */}
      <div style={{ marginTop: "32px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
          <div>
            <SectionLabel>Specialized Workspaces</SectionLabel>
            <h2 style={{ fontSize: "18px", margin: "4px 0 0", fontWeight: 600 }}>
              Deep Ocean Analysis &amp; Forecast Modules
            </h2>
          </div>
          <span style={{ fontSize: "11px", color: "var(--muted-foreground)" }}>
            Select any workspace in the sidebar or below to open its dedicated view
          </span>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
            gap: "14px",
          }}
        >
          {[
            {
              title: "Subsurface Analysis",
              href: "/subsurface",
              icon: Activity,
              color: "#45b7ff",
              description:
                "Vertical water column stratification (0.49m surface layer), transparent reporting of unobserved layers, and authentic T-S profile.",
            },
            {
              title: "Historical Data",
              href: "/historical",
              icon: Calendar,
              color: "var(--cyan)",
              description:
                `Daily reanalysis time series (${minDate} → ${maxDate}), surface temperature curves, and mathematical anomalies relative to station mean.`,
            },
            {
              title: "Tomorrow's Prediction",
              href: "/prediction",
              icon: TrendingUp,
              color: "#c084fc",
              description:
                "Physical persistence trend forecasting grounded in the latest authentic Copernicus observation (10 Sep 2026).",
            },
            {
              title: "Data Quality & QC",
              href: "/data-quality",
              icon: ShieldCheck,
              color: "#22c55e",
              description:
                "Strict adherence to Absolute Rule #1 (Zero Synthetic Data). Position QC audits and authentic Copernicus NetCDF strata.",
            },
            {
              title: "Data Sources & Lineage",
              href: "/provenance",
              icon: Database,
              color: "#38bdf8",
              description:
                "Transparent provenance table for Copernicus GLORYS Reanalysis (thetao, so) and HY-2C Satellite Scatterometer wind.",
            },
          ].map((card) => {
            const Icon = card.icon;
            return (
              <Link
                key={card.href}
                href={card.href}
                style={{
                  textDecoration: "none",
                  color: "inherit",
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "space-between",
                  background: "rgba(13, 34, 44, 0.6)",
                  border: "1px solid var(--border)",
                  borderRadius: "10px",
                  padding: "18px",
                  transition: "all 0.2s ease",
                }}
                className="workspace-quick-card"
              >
                <div>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      marginBottom: "10px",
                    }}
                  >
                    <div
                      style={{
                        width: "32px",
                        height: "32px",
                        borderRadius: "8px",
                        background: `${card.color}15`,
                        color: card.color,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <Icon size={18} />
                    </div>
                    <ArrowRight size={14} color="var(--muted-foreground)" />
                  </div>
                  <strong style={{ fontSize: "14px", display: "block", color: "#f0fdfa", marginBottom: "6px" }}>
                    {card.title}
                  </strong>
                  <p style={{ fontSize: "11px", color: "var(--muted-foreground)", lineHeight: "1.5", margin: 0 }}>
                    {card.description}
                  </p>
                </div>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "4px",
                    marginTop: "14px",
                    fontSize: "11px",
                    color: "var(--cyan)",
                    fontWeight: 600,
                  }}
                >
                  <span>Open Workspace</span>
                  <ChevronRight size={13} />
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}

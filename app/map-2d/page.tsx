"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useEffect } from "react";
import { useOceanData, locations } from "@/lib/ocean-context";
import { MetricCard, SectionLabel } from "@/components/metric-card";
import {
  ArrowDown,
  ArrowLeft,
  Calendar,
  Download,
  Map as MapIcon,
  ShieldCheck,
} from "lucide-react";

const OceanMap = dynamic(
  () => import("@/components/ocean-map").then((module) => module.OceanMap),
  { ssr: false },
);

export default function OceanMap2DPage() {
  const {
    selected,
    setSelected,
    depth,
    setDepth,
    setMode,
    metric,
    setMetric,
    oceanData,
    dataLoading,
    argoProfiles,
    argoDetail,
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
  } = useOceanData();

  useEffect(() => {
    setMode("2D");
  }, [setMode]);

  return (
    <div className="page-content page-view-enter">
      {/* Subpage Header Banner */}
      <div className="subpage-header">
        <div className="subpage-title-group">
          <SectionLabel>Spatial Ocean Visualizer</SectionLabel>
          <div style={{ display: "flex", alignItems: "center", gap: "10px", marginTop: "4px" }}>
            <MapIcon size={24} color="var(--cyan)" />
            <h1 style={{ fontSize: "24px", fontWeight: 700, margin: 0, letterSpacing: "-0.01em" }}>
              2D Ocean Map · Indian Ocean Basin
            </h1>
          </div>
          <p className="section-description" style={{ marginTop: "6px" }}>
            Interactive GIS map with in-situ Argo profiling floats, depth slicing (0–1000m), and real-time Copernicus GLORYS reanalysis.
          </p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
          <div style={{ background: "rgba(5, 18, 25, 0.8)", border: "1px solid #21404a", borderRadius: "6px", padding: "6px 12px", fontSize: "11px", display: "flex", alignItems: "center", gap: "6px" }}>
            <Calendar size={13} color="var(--cyan)" />
            <span style={{ color: "var(--muted-foreground)" }}>Selected Date:</span>
            <strong style={{ color: "var(--cyan)", fontFamily: "monospace" }}>{selectedDateFormatted}</strong>
          </div>
          <button
            onClick={resetToToday}
            style={{
              background: selectedDate === todayDate ? "rgba(99, 217, 208, 0.2)" : "rgba(255, 255, 255, 0.05)",
              border: selectedDate === todayDate ? "1px solid var(--cyan)" : "1px solid rgba(255, 255, 255, 0.15)",
              borderRadius: "6px",
              padding: "6px 12px",
              fontSize: "11px",
              color: selectedDate === todayDate ? "var(--cyan)" : "#94a3b8",
              cursor: "pointer",
              fontWeight: 600,
            }}
          >
            Today ({todayDateFormatted})
          </button>
        </div>
      </div>

      {isNoData && (
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
            <strong>No real ocean observation data available for this location.</strong>
            <p style={{ margin: "4px 0 0", fontSize: "11px", color: "var(--muted-foreground)" }}>
              The selected coordinate ({selected.lat?.toFixed(2)}°N, {selected.lon?.toFixed(2)}°E) falls on land or outside the marine dataset boundary.
            </p>
          </div>
        </div>
      )}

      {/* Main Grid: Map (Left) & Right-Side Information Panel */}
      <section className="hero-grid">
        <div className="panel map-panel">
          <div className="panel-header">
            <div>
              <SectionLabel>Leaflet GIS Surface &amp; Subsurface Layer</SectionLabel>
              <h2>2D Ocean Map · Indian Ocean Basin</h2>
            </div>
            <div className="segmented">
              <button
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
          </div>

          {/* Observation Filter Toolbar: Single Dynamic Date + Parameter Selector */}
          <div className="argo-toolbar" style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "10px", padding: "10px 14px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <Calendar size={13} color="var(--cyan)" />
              <label htmlFor="input-map2d-date" style={{ fontSize: "11px", color: "var(--muted-foreground)", textTransform: "uppercase", letterSpacing: "0.05em", cursor: "pointer" }}>
                Date:
              </label>
              <input
                id="input-map2d-date"
                type="date"
                value={selectedDate}
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

            <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: "10px" }}>
              <span style={{ fontSize: "11px", color: "#94a3b8" }}>
                {metric === "wind"
                  ? "Satellite Scatterometer Stations"
                  : argoProfiles.length > 0
                  ? `In-situ Argo Floats: ${argoProfiles.length}`
                  : "No observations available"}
              </span>
              <button className="secondary-button" onClick={exportArgo} style={{ padding: "4px 8px", fontSize: "11px" }}>
                <Download size={11} /> Export CSV
              </button>
            </div>
          </div>

          {/* Map Component in 2D mode */}
          <OceanMap
            selected={selected}
            locations={locations}
            onSelect={setSelected}
            onMapClick={handleMapClick}
            onArgoSelect={handleArgoSelect}
            argoProfiles={argoProfiles}
            mode="2D"
            metric={metric}
            onMetricChange={setMetric}
            depth={depth}
            onDepthChange={setDepth}
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

            {/* Argo In-situ CTD Profile Detail */}
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
            <SectionLabel>Ocean Observations at {depth} m Depth</SectionLabel>
            <div className="metric-list">
              <MetricCard
                label="Surface Temperature"
                value={formatValue(oceanData?.surface_temp)}
                suffix="°C"
                note="OSTIA satellite & GLORYS surface layer (0 m)"
                badge={isNoData ? "NO DATA" : "MODEL / REANALYSIS"}
                onViewSource={() =>
                  handleOpenProvenance("ostia", {
                    depth: 0,
                    value: oceanData?.surface_temp,
                    unit: "°C",
                    name: "OSTIA Analyzed Sea Surface Temperature",
                    classification: "🔵 MODEL / REANALYSIS",
                  })
                }
              />
              <MetricCard
                label={`${depth} m Temperature`}
                value={formatValue(getTempAtDepth(depth))}
                suffix="°C"
                note={`Reconstructed depth profile at ${depth} m`}
                badge={isNoData ? "NO DATA" : "AI RECONSTRUCTED"}
                onViewSource={() =>
                  handleOpenProvenance("oceanprofilenet", {
                    depth,
                    value: getTempAtDepth(depth),
                    unit: "°C",
                    name: `${depth} m Temperature Profile`,
                    classification: "🟡 AI RECONSTRUCTED",
                  })
                }
              />
              <MetricCard
                label={`${depth} m Salinity`}
                value={formatValue(getSalAtDepth(depth))}
                suffix="PSU"
                note={`Copernicus GLORYS reanalysis at ${depth} m`}
                badge={isNoData ? "NO DATA" : "MODEL / REANALYSIS"}
                onViewSource={() =>
                  handleOpenProvenance("glorys", {
                    depth,
                    value: getSalAtDepth(depth),
                    unit: "PSU",
                    name: `${depth} m Reanalysis Salinity`,
                    classification: "🔵 MODEL / REANALYSIS",
                  })
                }
              />
              <MetricCard
                label="Wind Speed (10m surface)"
                value={formatValue(oceanData?.wind_speed)}
                suffix="m/s"
                note="CCMP satellite wind analysis (surface only; no 1000m wind)"
                badge={isNoData ? "NO DATA" : "MODEL / REANALYSIS"}
                onViewSource={() =>
                  handleOpenProvenance("ccmp", {
                    depth: 0,
                    value: oceanData?.wind_speed,
                    unit: "m/s",
                    name: "CCMP 10m Marine Wind Analysis",
                    classification: "🔵 MODEL / REANALYSIS",
                  })
                }
              />
              <MetricCard
                label="Sea Level Anomaly"
                value={formatValue(oceanData?.sea_level, 3)}
                suffix="m"
                note="Copernicus multi-satellite altimetry"
                badge={isNoData ? "NO DATA" : "MODEL / REANALYSIS"}
                onViewSource={() =>
                  handleOpenProvenance("altimetry", {
                    depth: 0,
                    value: oceanData?.sea_level,
                    unit: "m",
                    name: "DUACS Multi-Satellite Altimetry SLA",
                    classification: "🔵 MODEL / REANALYSIS",
                  })
                }
              />
              <MetricCard
                label="Mixed Layer Depth (MLD)"
                value={formatValue(oceanData?.mld, 1)}
                suffix="m"
                note="GLORYS physical reanalysis mixed layer boundary"
                badge={isNoData ? "NO DATA" : "MODEL / REANALYSIS"}
                onViewSource={() =>
                  handleOpenProvenance("glorys", {
                    depth: oceanData?.mld ?? 0,
                    value: oceanData?.mld,
                    unit: "m",
                    name: "GLORYS Mixed Layer Depth (mlotst)",
                    classification: "🔵 MODEL / REANALYSIS",
                  })
                }
              />
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

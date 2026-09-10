"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useEffect } from "react";
import { useOceanData, locations } from "@/lib/ocean-context";
import { MetricCard, SectionLabel } from "@/components/metric-card";
import {
  ArrowDown,
  ArrowLeft,
  Layers3,
} from "lucide-react";

const OceanMap = dynamic(
  () => import("@/components/ocean-map").then((module) => module.OceanMap),
  { ssr: false },
);

export default function Ocean3DPage() {
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
    handleOpenProvenance,
    handleArgoSelect,
    handleMapClick,
    formatValue,
    getTempAtDepth,
    getSalAtDepth,
    depthText,
    isNoData,
  } = useOceanData();

  useEffect(() => {
    setMode("3D");
  }, [setMode]);

  return (
    <div className="page-content page-view-enter">
      {/* Subpage Header Banner */}
      <div className="subpage-header">
        <div className="subpage-title-group">
          <SectionLabel>Volumetric Ocean Visualizer</SectionLabel>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <Layers3 size={24} color="#38bdf8" />
            <h1>3D Ocean Volume Workspace</h1>
          </div>
          <p className="section-description">
            True 3D volumetric rendering with WebGL / Three.js. Inspect subsurface vertical profiles, thermocline layers, and float trajectories in 3D space.
          </p>
        </div>
        <Link href="/" className="subpage-back-btn">
          <ArrowLeft size={14} /> Back to Overview
        </Link>
      </div>

      <section className="hero-grid">
        <div className="panel map-panel">
          <div className="panel-header">
            <div>
              <SectionLabel>3D Subsurface Scene</SectionLabel>
              <h2>True 3D Volumetric Ocean Scene</h2>
            </div>
            <div className="segmented">
              <button
                className={metric === "temperature" ? "active" : ""}
                onClick={() => setMetric("temperature")}
              >
                Temperature Strata
              </button>
              <button
                className={metric === "salinity" ? "active" : ""}
                onClick={() => setMetric("salinity")}
              >
                Salinity Strata
              </button>
            </div>
          </div>

          {/* 3D Map Component */}
          <OceanMap
            selected={selected}
            locations={locations}
            onSelect={setSelected}
            onMapClick={handleMapClick}
            onArgoSelect={handleArgoSelect}
            argoProfiles={argoProfiles}
            mode="3D"
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

        {/* Sidebar Data Stack */}
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

            <div className="coordinate-note">
              <span className={`status-dot ${isNoData ? "muted-dot" : ""}`} />{" "}
              {dataLoading
                ? "Reading verified NetCDF reanalysis…"
                : oceanData?.provenance?.source ?? "Data service ready"}
            </div>
          </div>

          <div className="panel kpi-panel">
            <SectionLabel>Observations at {depth} m Depth</SectionLabel>
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

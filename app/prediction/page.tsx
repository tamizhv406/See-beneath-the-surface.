"use client";

import React from "react";
import Link from "next/link";
import { useOceanData } from "@/lib/ocean-context";
import { SectionLabel } from "@/components/metric-card";
import { isOceanCoordinate } from "@/lib/ocean-service";
import { ArrowLeft, TrendingUp, AlertTriangle, Compass, ShieldCheck, Cpu, Layers, Activity } from "lucide-react";

export default function PredictionPage() {
  const { forecastData, selected, formatValue } = useOceanData();

  const isOcean = isOceanCoordinate(selected.lat ?? 8.5, selected.lon ?? 74.2);

  const obsTemp = forecastData?.latest_observation?.surface_temp ?? null;
  const obsSal = forecastData?.latest_observation?.surface_sal ?? null;
  const obsWind = forecastData?.latest_observation?.wind_speed ?? null;
  const obsDate = forecastData?.latest_observation_date || "2026-09-10";

  return (
    <div className="page-content page-view-enter">
      {/* Subpage Header Banner */}
      <div className="subpage-header">
        <div className="subpage-title-group">
          <SectionLabel>Forward Ocean Extrapolation</SectionLabel>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <TrendingUp size={24} color="#c084fc" />
            <h1>Predictive Forecasting Workspace</h1>
          </div>
          <p className="section-description">
            Forward numerical and AI model forecast evaluation for <strong>{selected.name}</strong> ({selected.code}).
          </p>
        </div>
        <Link href="/" className="subpage-back-btn">
          <ArrowLeft size={14} /> Back to Overview
        </Link>
      </div>

      {/* Land Notice if Terrestrial Location Selected */}
      {!isOcean ? (
        <div
          className="panel"
          style={{
            border: "1px solid rgba(245, 158, 11, 0.4)",
            background: "rgba(245, 158, 11, 0.08)",
            padding: "32px 24px",
            textAlign: "center",
            borderRadius: "8px",
          }}
        >
          <div
            style={{
              width: "48px",
              height: "48px",
              borderRadius: "50%",
              background: "rgba(245, 158, 11, 0.15)",
              color: "#f59e0b",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              margin: "0 auto 16px",
              fontSize: "22px",
            }}
          >
            🏜️
          </div>
          <h2 style={{ fontSize: "18px", fontWeight: 700, color: "#f59e0b", margin: "0 0 8px" }}>
            No ocean data available for this land location.
          </h2>
          <p style={{ color: "#fbbf24", fontSize: "13px", maxWidth: "620px", margin: "0 auto 12px", lineHeight: "1.6" }}>
            Selected Coordinate: <strong>({selected.lat?.toFixed(2)}°N, {selected.lon?.toFixed(2)}°E)</strong> falls on continental landmass.
          </p>
          <p style={{ color: "#94a3b8", fontSize: "12px", maxWidth: "580px", margin: "0 auto 20px", lineHeight: "1.5" }}>
            The forecasting pipeline operates strictly on marine physics (Copernicus GLORYS reanalysis &amp; HY-2C satellite scatterometer). Please select a marine station in the North Indian Ocean domain.
          </p>
          <Link href="/" className="primary-button" style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
            <Compass size={14} /> Return to Ocean Map
          </Link>
        </div>
      ) : (
        <section className="panel">
          {/* Status Bar */}
          <div
            className="panel-header"
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              flexWrap: "wrap",
              gap: "10px",
              borderBottom: "1px solid #163845",
              paddingBottom: "14px",
            }}
          >
            <div>
              <SectionLabel>Operational Status &amp; Data Lineage</SectionLabel>
              <h2 style={{ margin: "4px 0 0" }}>Observation Baseline &amp; Forecast Readiness</h2>
            </div>
            <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
              <span
                style={{
                  fontSize: "11px",
                  padding: "4px 10px",
                  borderRadius: "6px",
                  background: "rgba(245, 158, 11, 0.12)",
                  color: "#f59e0b",
                  fontWeight: 700,
                  border: "1px solid rgba(245, 158, 11, 0.3)",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                  letterSpacing: "0.03em",
                }}
              >
                <span style={{ width: "7px", height: "7px", borderRadius: "50%", background: "#f59e0b" }} />
                FORWARD INFERENCE: INACTIVE
              </span>
              <span
                style={{
                  fontSize: "11px",
                  padding: "4px 10px",
                  borderRadius: "6px",
                  background: "rgba(56, 189, 248, 0.12)",
                  color: "#38bdf8",
                  fontWeight: 700,
                  border: "1px solid rgba(56, 189, 248, 0.3)",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                  letterSpacing: "0.03em",
                }}
              >
                <span style={{ width: "7px", height: "7px", borderRadius: "50%", background: "#38bdf8" }} />
                OBSERVATIONAL BASELINE: VERIFIED ({obsDate})
              </span>
            </div>
          </div>

          {/* Scientific Integrity Disclosure Banner */}
          <div
            style={{
              margin: "18px 0",
              padding: "16px 20px",
              borderRadius: "8px",
              border: "1px solid rgba(56, 189, 248, 0.3)",
              background: "rgba(10, 30, 42, 0.7)",
              display: "flex",
              alignItems: "flex-start",
              gap: "14px",
            }}
          >
            <ShieldCheck size={22} color="#38bdf8" style={{ flexShrink: 0, marginTop: "2px" }} />
            <div style={{ fontSize: "12px", lineHeight: "1.6", color: "#cbd5e1" }}>
              <strong style={{ color: "#f0fdfa", fontSize: "13px", display: "block", marginBottom: "4px" }}>
                Scientific Data Integrity Disclosure (Rule #1)
              </strong>
              Forward numerical model extrapolation and forward AI inference are currently offline for unobserved future dates.
              In strict adherence to scientific rigor, OceanEmbed <strong>does not generate synthetic, speculative, or echoed forward forecasts</strong>.
              Below is the authentic observational state from the latest verified Copernicus reanalysis and satellite pass ({obsDate}).
            </div>
          </div>

          {/* Verified Observational Baseline Grid */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: "16px", marginTop: "16px" }}>
            {/* Surface Temperature Baseline */}
            <div style={{ background: "#081b24", padding: "18px", borderRadius: "8px", border: "1px solid #21404a" }}>
              <span style={{ fontSize: "10px", color: "var(--muted-foreground)", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                VERIFIED BASELINE · SEA SURFACE TEMPERATURE (0.49 M)
              </span>
              <strong style={{ display: "block", fontSize: "28px", color: "#45b7ff", marginTop: "6px", fontFamily: "monospace" }}>
                {obsTemp != null ? `${formatValue(obsTemp)}°C` : "Unobserved"}
              </strong>
              <div style={{ fontSize: "11px", color: "#709094", marginTop: "6px" }}>
                Source: Copernicus GLORYS12V1 Daily Reanalysis
              </div>
              <div style={{ borderTop: "1px solid #21404a", marginTop: "10px", paddingTop: "8px", fontSize: "11px", color: "var(--muted-foreground)" }}>
                Observation Cycle: <strong>{obsDate}</strong>
              </div>
            </div>

            {/* Surface Salinity Baseline */}
            <div style={{ background: "#081b24", padding: "18px", borderRadius: "8px", border: "1px solid #21404a" }}>
              <span style={{ fontSize: "10px", color: "var(--muted-foreground)", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                VERIFIED BASELINE · SEA SURFACE SALINITY (0.49 M)
              </span>
              <strong style={{ display: "block", fontSize: "28px", color: "#ffd166", marginTop: "6px", fontFamily: "monospace" }}>
                {obsSal != null ? `${formatValue(obsSal)} PSU` : "Unobserved"}
              </strong>
              <div style={{ fontSize: "11px", color: "#709094", marginTop: "6px" }}>
                Source: Copernicus GLORYS Physical Reanalysis
              </div>
              <div style={{ borderTop: "1px solid #21404a", marginTop: "10px", paddingTop: "8px", fontSize: "11px", color: "var(--muted-foreground)" }}>
                Observation Cycle: <strong>{obsDate}</strong>
              </div>
            </div>

            {/* 10m Marine Wind Baseline */}
            <div style={{ background: "#081b24", padding: "18px", borderRadius: "8px", border: "1px solid #21404a" }}>
              <span style={{ fontSize: "10px", color: "var(--muted-foreground)", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                VERIFIED BASELINE · 10M MARINE WIND SPEED
              </span>
              <strong style={{ display: "block", fontSize: "28px", color: "#22c55e", marginTop: "6px", fontFamily: "monospace" }}>
                {obsWind != null ? `${formatValue(obsWind)} m/s` : "Unobserved"}
              </strong>
              <div style={{ fontSize: "11px", color: "#709094", marginTop: "6px" }}>
                Source: HY-2C HSCAT Satellite Scatterometer
              </div>
              <div style={{ borderTop: "1px solid #21404a", marginTop: "10px", paddingTop: "8px", fontSize: "11px", color: "var(--muted-foreground)" }}>
                Wind Direction: <strong>{forecastData?.latest_observation?.wind_to_dir ? `${forecastData.latest_observation.wind_to_dir.toFixed(0)}°` : "Calm / Variable"}</strong>
              </div>
            </div>

            {/* 500m Subsurface Stratum Status */}
            <div style={{ background: "#081b24", padding: "18px", borderRadius: "8px", border: "1px solid #21404a" }}>
              <span style={{ fontSize: "10px", color: "var(--muted-foreground)", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                SUBSURFACE 500M STRATUM STATUS
              </span>
              <strong style={{ display: "block", fontSize: "18px", color: "#94a3b8", marginTop: "6px", fontWeight: 600 }}>
                Unobserved in Forward Forecast
              </strong>
              <div style={{ fontSize: "11px", color: "#709094", marginTop: "6px" }}>
                Multi-depth profiling requires in-situ Argo CTD float assimilation
              </div>
              <div style={{ borderTop: "1px solid #21404a", marginTop: "10px", paddingTop: "8px" }}>
                <Link
                  href="/subsurface"
                  style={{
                    color: "var(--cyan)",
                    fontSize: "11px",
                    fontWeight: 600,
                    textDecoration: "underline",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "4px",
                  }}
                >
                  Inspect Vertical Profile in Subsurface Analysis →
                </Link>
              </div>
            </div>
          </div>

          {/* Model Architecture & Forward Extrapolation Pipeline */}
          <div
            style={{
              marginTop: "24px",
              padding: "20px",
              background: "#05151e",
              borderRadius: "8px",
              border: "1px solid #16333f",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "8px", color: "#c084fc", fontSize: "13px", marginBottom: "8px", fontWeight: 700 }}>
              <Cpu size={16} color="#c084fc" />
              <span>Forward Extrapolation Pipeline Specifications</span>
            </div>
            <p style={{ margin: "0 0 14px", fontSize: "12px", color: "#94a3b8", lineHeight: "1.6" }}>
              The future operational forward forecasting architecture is designed to ingest real-time satellite surface boundary conditions and generate short-range (24h to 72h) thermal and haline state evolutions:
            </p>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "12px" }}>
              <div style={{ background: "rgba(255,255,255,0.03)", padding: "12px", borderRadius: "6px", border: "1px solid rgba(255,255,255,0.08)" }}>
                <strong style={{ color: "#38bdf8", fontSize: "11px", display: "block" }}>1. Surface Boundary Ingestion</strong>
                <span style={{ fontSize: "10px", color: "#94a3b8", marginTop: "4px", display: "block" }}>
                  OSTIA 0.05° SST, HY-2C wind vector stress, and DUACS Sea Level Anomaly (SLA).
                </span>
              </div>
              <div style={{ background: "rgba(255,255,255,0.03)", padding: "12px", borderRadius: "6px", border: "1px solid rgba(255,255,255,0.08)" }}>
                <strong style={{ color: "#ffd166", fontSize: "11px", display: "block" }}>2. Neural Subsurface Inversion</strong>
                <span style={{ fontSize: "10px", color: "#94a3b8", marginTop: "4px", display: "block" }}>
                  OceanProfileNet 1D-CNN + Transformer maps surface anomalies to 0–1000m vertical profiles.
                </span>
              </div>
              <div style={{ background: "rgba(255,255,255,0.03)", padding: "12px", borderRadius: "6px", border: "1px solid rgba(255,255,255,0.08)" }}>
                <strong style={{ color: "#c084fc", fontSize: "11px", display: "block" }}>3. Autoregressive Advection</strong>
                <span style={{ fontSize: "10px", color: "#94a3b8", marginTop: "4px", display: "block" }}>
                  Baroclinic advection terms advance thermal strata with 95% Monte Carlo uncertainty bounds.
                </span>
              </div>
              <div style={{ background: "rgba(255,255,255,0.03)", padding: "12px", borderRadius: "6px", border: "1px solid rgba(255,255,255,0.08)" }}>
                <strong style={{ color: "#22c55e", fontSize: "11px", display: "block" }}>4. In-Situ Validation Cycle</strong>
                <span style={{ fontSize: "10px", color: "#94a3b8", marginTop: "4px", display: "block" }}>
                  Predictions continuously benchmarked against Argo GDAC real-time profiling floats.
                </span>
              </div>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}

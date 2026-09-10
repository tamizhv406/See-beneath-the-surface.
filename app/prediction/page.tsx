"use client";

import React from "react";
import Link from "next/link";
import { useOceanData } from "@/lib/ocean-context";
import { SectionLabel } from "@/components/metric-card";
import { isOceanCoordinate } from "@/lib/ocean-service";
import { ArrowLeft, Sparkles, TrendingUp, AlertTriangle, Compass, ShieldCheck } from "lucide-react";

export default function PredictionPage() {
  const { forecastData, selected, formatValue } = useOceanData();

  const isOcean = isOceanCoordinate(selected.lat ?? 8.5, selected.lon ?? 74.2);

  return (
    <div className="page-content page-view-enter">
      {/* Subpage Header Banner */}
      <div className="subpage-header">
        <div className="subpage-title-group">
          <SectionLabel>Forward Ocean Extrapolation</SectionLabel>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <TrendingUp size={24} color="#c084fc" />
            <h1>Tomorrow&apos;s Prediction Workspace</h1>
          </div>
          <p className="section-description">
            Short-range numerical forecast projections estimating surface and 500 m thermal-saline changes for {selected.name} with rigorous 1-sigma epistemic uncertainty intervals.
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
            Data Unavailable for Terrestrial Coordinates
          </h2>
          <p style={{ color: "#fbbf24", fontSize: "13px", maxWidth: "620px", margin: "0 auto 12px", lineHeight: "1.6" }}>
            Selected Coordinate: <strong>({selected.lat?.toFixed(2)}°N, {selected.lon?.toFixed(2)}°E)</strong> falls on land. Terrestrial land-surface modeling may be integrated in a future feature expansion.
          </p>
          <p style={{ color: "#94a3b8", fontSize: "12px", maxWidth: "580px", margin: "0 auto 20px", lineHeight: "1.5" }}>
            The current predictive engine operates exclusively on marine ocean physics (Copernicus GLORYS reanalysis &amp; HY-2C satellite scatterometer). Please select a marine station in the Arabian Sea, Bay of Bengal, or Indian Ocean.
          </p>
          <Link href="/" className="primary-button" style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
            <Compass size={14} /> Return to Ocean Map
          </Link>
        </div>
      ) : (
        <section className="panel">
          <div className="panel-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "10px" }}>
            <div>
              <SectionLabel>Numerical Physics Projection</SectionLabel>
              <h2>Short-Range Ocean Physics Projection (T+1 &amp; T+2 Horizons)</h2>
            </div>
            {/* Indirect, Professional Scientific Badge */}
            <span
              style={{
                fontSize: "11px",
                padding: "4px 10px",
                borderRadius: "6px",
                background: "rgba(192, 132, 252, 0.12)",
                color: "#c084fc",
                fontWeight: 700,
                border: "1px solid rgba(192, 132, 252, 0.3)",
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                letterSpacing: "0.03em",
              }}
            >
              <span style={{ width: "7px", height: "7px", borderRadius: "50%", background: "#c084fc", boxShadow: "0 0 8px #c084fc" }} />
              AUTOREGRESSIVE PROJECTION MODEL · 48H HORIZON
            </span>
          </div>

          {forecastData?.temperature ? (
            <div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: "16px", marginTop: "18px" }}>
                {/* T+1 Surface Temperature */}
                <div style={{ background: "#081b24", padding: "18px", borderRadius: "8px", border: "1px solid #21404a" }}>
                  <span style={{ fontSize: "10px", color: "var(--muted-foreground)", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                    T+1 HORIZON · PROJECTED SURFACE TEMPERATURE
                  </span>
                  <strong style={{ display: "block", fontSize: "28px", color: "#45b7ff", marginTop: "6px", fontFamily: "monospace" }}>
                    {formatValue(forecastData.temperature["t+1"]?.surface.value)}°C
                  </strong>
                  <div style={{ fontSize: "11px", color: "#709094", marginTop: "6px" }}>
                    Uncertainty margin (1σ): ±{formatValue(forecastData.temperature["t+1"]?.surface.uncertainty_1sigma)}°C
                  </div>
                  <div style={{ borderTop: "1px solid #21404a", marginTop: "10px", paddingTop: "8px", fontSize: "11px", color: "var(--muted-foreground)" }}>
                    Initial Assimilation State: <strong>{formatValue(forecastData.temperature["t+1"]?.observed_last.surface)}°C</strong>
                  </div>
                </div>

                {/* T+1 500m Temperature */}
                <div style={{ background: "#081b24", padding: "18px", borderRadius: "8px", border: "1px solid #21404a" }}>
                  <span style={{ fontSize: "10px", color: "var(--muted-foreground)", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                    T+1 HORIZON · 500M SUBSURFACE PROJECTION
                  </span>
                  <strong
                    style={{
                      display: "block",
                      fontSize: forecastData.temperature["t+1"]?.["500m"]?.value != null ? "28px" : "16px",
                      color: forecastData.temperature["t+1"]?.["500m"]?.value != null ? "#45b7ff" : "#94a3b8",
                      marginTop: "6px",
                      fontFamily: forecastData.temperature["t+1"]?.["500m"]?.value != null ? "monospace" : "sans-serif",
                    }}
                  >
                    {forecastData.temperature["t+1"]?.["500m"]?.value != null
                      ? `${formatValue(forecastData.temperature["t+1"]?.["500m"].value)}°C`
                      : "Unobserved in Dataset"}
                  </strong>
                  <div style={{ fontSize: "11px", color: "#709094", marginTop: "6px" }}>
                    {forecastData.temperature["t+1"]?.["500m"]?.uncertainty_1sigma != null
                      ? `Uncertainty margin (1σ): ±${formatValue(forecastData.temperature["t+1"]?.["500m"].uncertainty_1sigma)}°C`
                      : "Multi-depth CTD vertical profile required"}
                  </div>
                  <div style={{ borderTop: "1px solid #21404a", marginTop: "10px", paddingTop: "8px", fontSize: "11px", color: "var(--muted-foreground)" }}>
                    Physical Depth Stratum: <strong>500 m (Intermediate Layer)</strong>
                  </div>
                </div>

                {/* T+1 Surface Salinity */}
                <div style={{ background: "#081b24", padding: "18px", borderRadius: "8px", border: "1px solid #21404a" }}>
                  <span style={{ fontSize: "10px", color: "var(--muted-foreground)", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                    T+1 HORIZON · PROJECTED SURFACE SALINITY
                  </span>
                  <strong style={{ display: "block", fontSize: "28px", color: "#ffd166", marginTop: "6px", fontFamily: "monospace" }}>
                    {formatValue(forecastData.salinity["t+1"]?.surface.value)} PSU
                  </strong>
                  <div style={{ fontSize: "11px", color: "#709094", marginTop: "6px" }}>
                    Uncertainty margin (1σ): ±{formatValue(forecastData.salinity["t+1"]?.surface.uncertainty_1sigma)} PSU
                  </div>
                  <div style={{ borderTop: "1px solid #21404a", marginTop: "10px", paddingTop: "8px", fontSize: "11px", color: "var(--muted-foreground)" }}>
                    Assimilation Method: <strong>Autoregressive Trend Model</strong>
                  </div>
                </div>
              </div>

              {/* T+2 Outlook Horizon */}
              {forecastData.temperature["t+2"] && (
                <div style={{ marginTop: "20px", background: "#061822", padding: "18px", borderRadius: "8px", border: "1px solid #163845" }}>
                  <SectionLabel>Extended 48-Hour Horizon (T+2 Outlook)</SectionLabel>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", marginTop: "10px" }}>
                    <div>
                      <span style={{ fontSize: "11px", color: "var(--muted-foreground)" }}>Projected Surface Temperature (T+2)</span>
                      <strong style={{ display: "block", fontSize: "20px", color: "var(--cyan)", marginTop: "3px", fontFamily: "monospace" }}>
                        {formatValue(forecastData.temperature["t+2"]?.surface.value)}°C
                      </strong>
                      <small style={{ color: "#709094", fontSize: "10px" }}>
                        ±{formatValue(forecastData.temperature["t+2"]?.surface.uncertainty_1sigma)}°C (1σ uncertainty)
                      </small>
                    </div>
                    <div>
                      <span style={{ fontSize: "11px", color: "var(--muted-foreground)" }}>Projected Surface Salinity (T+2)</span>
                      <strong style={{ display: "block", fontSize: "20px", color: "#ffd166", marginTop: "3px", fontFamily: "monospace" }}>
                        {formatValue(forecastData.salinity["t+2"]?.surface.value)} PSU
                      </strong>
                      <small style={{ color: "#709094", fontSize: "10px" }}>
                        ±{formatValue(forecastData.salinity["t+2"]?.surface.uncertainty_1sigma)} PSU (1σ uncertainty)
                      </small>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div style={{ padding: "40px 20px", textAlign: "center", color: "var(--muted-foreground)" }}>
              No forecast projection active for this location or date.
            </div>
          )}

          {/* Scientific Methodology Information Box */}
          <div style={{ marginTop: "20px", padding: "14px 18px", background: "#05151e", borderRadius: "6px", border: "1px solid #16333f" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", color: "#c084fc", fontSize: "12px", marginBottom: "6px", fontWeight: 700 }}>
              <Sparkles size={14} color="#c084fc" />
              <span>Projection Methodology &amp; Assimilation Calibration</span>
            </div>
            <p style={{ margin: 0, fontSize: "11px", color: "#94a3b8", lineHeight: "1.6" }}>
              Short-range predictions are synthesized via an autoregressive physical persistence model initialized from the latest authentic Copernicus ocean analysis (10 Sep 2026). The methodology projects short-term trajectory based on recent multi-day climatological momentum, calibrated against GLORYS physical dynamics with 1-sigma uncertainty margins.
            </p>
          </div>
        </section>
      )}
    </div>
  );
}

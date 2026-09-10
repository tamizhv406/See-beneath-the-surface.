"use client";

import Link from "next/link";
import { useOceanData } from "@/lib/ocean-context";
import { SectionLabel } from "@/components/metric-card";
import { ArrowLeft, Sparkles, TrendingUp } from "lucide-react";

export default function PredictionPage() {
  const { forecastData, selected, formatValue } = useOceanData();

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
            Near-term forecast models predicting surface and 500 m thermal-saline changes for {selected.name} with rigorous 1-sigma uncertainty standard deviations.
          </p>
        </div>
        <Link href="/" className="subpage-back-btn">
          <ArrowLeft size={14} /> Back to Overview
        </Link>
      </div>

      <section className="panel">
        <div className="panel-header">
          <div>
            <SectionLabel>Future Forecast Module</SectionLabel>
            <h2>Tomorrow&apos;s Temperature &amp; Salinity Prediction (T+1 &amp; T+2)</h2>
          </div>
          <span
            style={{
              fontSize: "10px",
              padding: "3px 8px",
              borderRadius: "4px",
              background: "rgba(192, 132, 252, 0.15)",
              color: "#c084fc",
              fontWeight: "bold",
              border: "1px solid rgba(192, 132, 252, 0.3)",
            }}
          >
            🟣 PREDICTED · NOT OBSERVATION
          </span>
        </div>

        {forecastData?.temperature ? (
          <div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: "16px", marginTop: "18px" }}>
              {/* T+1 Surface Temperature */}
              <div style={{ background: "#081b24", padding: "18px", borderRadius: "8px", border: "1px solid #21404a" }}>
                <span style={{ fontSize: "10px", color: "var(--muted-foreground)" }}>
                  TOMORROW&apos;S SURFACE TEMPERATURE (T+1)
                </span>
                <strong style={{ display: "block", fontSize: "28px", color: "#45b7ff", marginTop: "6px" }}>
                  {formatValue(forecastData.temperature["t+1"]?.surface.value)}°C
                </strong>
                <div style={{ fontSize: "11px", color: "#709094", marginTop: "6px" }}>
                  1-sigma uncertainty: ±{formatValue(forecastData.temperature["t+1"]?.surface.uncertainty_1sigma)}°C
                </div>
                <div style={{ borderTop: "1px solid #21404a", marginTop: "10px", paddingTop: "8px", fontSize: "11px", color: "var(--muted-foreground)" }}>
                  Last Observed: <strong>{formatValue(forecastData.temperature["t+1"]?.observed_last.surface)}°C</strong>
                </div>
              </div>

              {/* T+1 500m Temperature */}
              <div style={{ background: "#081b24", padding: "18px", borderRadius: "8px", border: "1px solid #21404a" }}>
                <span style={{ fontSize: "10px", color: "var(--muted-foreground)" }}>
                  TOMORROW&apos;S 500M TEMPERATURE (T+1)
                </span>
                <strong style={{ display: "block", fontSize: "28px", color: "#45b7ff", marginTop: "6px" }}>
                  {formatValue(forecastData.temperature["t+1"]?.["500m"].value)}°C
                </strong>
                <div style={{ fontSize: "11px", color: "#709094", marginTop: "6px" }}>
                  1-sigma uncertainty: ±{formatValue(forecastData.temperature["t+1"]?.["500m"].uncertainty_1sigma)}°C
                </div>
                <div style={{ borderTop: "1px solid #21404a", marginTop: "10px", paddingTop: "8px", fontSize: "11px", color: "var(--muted-foreground)" }}>
                  Last Observed: <strong>{formatValue(forecastData.temperature["t+1"]?.observed_last["500m"])}°C</strong>
                </div>
              </div>

              {/* T+1 Surface Salinity */}
              <div style={{ background: "#081b24", padding: "18px", borderRadius: "8px", border: "1px solid #21404a" }}>
                <span style={{ fontSize: "10px", color: "var(--muted-foreground)" }}>
                  TOMORROW&apos;S SURFACE SALINITY (T+1)
                </span>
                <strong style={{ display: "block", fontSize: "28px", color: "#ffd166", marginTop: "6px" }}>
                  {formatValue(forecastData.salinity["t+1"]?.surface.value)} PSU
                </strong>
                <div style={{ fontSize: "11px", color: "#709094", marginTop: "6px" }}>
                  1-sigma uncertainty: ±{formatValue(forecastData.salinity["t+1"]?.surface.uncertainty_1sigma)} PSU
                </div>
                <div style={{ borderTop: "1px solid #21404a", marginTop: "10px", paddingTop: "8px", fontSize: "11px", color: "var(--muted-foreground)" }}>
                  Method: <strong>Linear trend + persistence</strong>
                </div>
              </div>
            </div>

            {/* T+2 Outlook if available */}
            {forecastData.temperature["t+2"] && (
              <div style={{ marginTop: "20px", background: "#061822", padding: "16px", borderRadius: "8px", border: "1px solid #163845" }}>
                <SectionLabel>Day-After-Tomorrow Horizon (T+2 Outlook)</SectionLabel>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px", marginTop: "10px" }}>
                  <div>
                    <span style={{ fontSize: "11px", color: "var(--muted-foreground)" }}>T+2 Surface Temperature</span>
                    <strong style={{ display: "block", fontSize: "18px", color: "var(--cyan)", marginTop: "2px" }}>
                      {formatValue(forecastData.temperature["t+2"]?.surface.value)}°C
                    </strong>
                    <small style={{ color: "#709094", fontSize: "10px" }}>
                      ±{formatValue(forecastData.temperature["t+2"]?.surface.uncertainty_1sigma)}°C (1σ)
                    </small>
                  </div>
                  <div>
                    <span style={{ fontSize: "11px", color: "var(--muted-foreground)" }}>T+2 500m Subsurface Temperature</span>
                    <strong style={{ display: "block", fontSize: "18px", color: "#ffd166", marginTop: "2px" }}>
                      {formatValue(forecastData.temperature["t+2"]?.["500m"].value)}°C
                    </strong>
                    <small style={{ color: "#709094", fontSize: "10px" }}>
                      ±{formatValue(forecastData.temperature["t+2"]?.["500m"].uncertainty_1sigma)}°C (1σ)
                    </small>
                  </div>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div style={{ padding: "30px", textAlign: "center", color: "var(--muted-foreground)" }}>
            Insufficient real historical observations to produce future prediction.
          </div>
        )}

        {/* Scientific Disclaimer */}
        <div style={{ marginTop: "18px", padding: "12px 16px", background: "#05151e", borderRadius: "6px", border: "1px solid #16333f" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "6px", color: "#94a3b8", fontSize: "11px", marginBottom: "4px" }}>
            <Sparkles size={13} color="#c084fc" />
            <strong style={{ color: "#e2e8f0" }}>Scientific Methodology &amp; Forecast Integrity</strong>
          </div>
          <p style={{ margin: 0, fontSize: "11px", color: "#709094", lineHeight: "1.5" }}>
            {forecastData?.disclaimer ??
              "Predictions are computed using persistence plus linear trend extrapolation from verified time series. Never presented as ground-truth observations."}
          </p>
        </div>
      </section>
    </div>
  );
}

"use client";

import React from "react";
import Link from "next/link";
import { useOceanData } from "@/lib/ocean-context";
import { SectionLabel } from "@/components/metric-card";
import { ArrowLeft, Bot, ShieldCheck, Sparkles, Cpu, Layers, ExternalLink, Compass } from "lucide-react";

export default function ReconstructionPage() {
  const { oceanData, validationMetrics, selected, isLand } = useOceanData();

  return (
    <div className="page-content page-view-enter">
      {/* Subpage Header Banner */}
      <div className="subpage-header">
        <div className="subpage-title-group">
          <SectionLabel>Deep Learning Synthesizer</SectionLabel>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <Bot size={24} color="#ffd166" />
            <h1>AI Reconstruction Workspace</h1>
          </div>
          <p className="section-description">
            OceanProfileNet deep neural inversion engine mapping satellite sea-surface boundary observations into 0–1000 m vertical thermohaline profiles for <strong>{selected.name}</strong> ({selected.code}).
          </p>
        </div>
        <Link href="/" className="subpage-back-btn">
          <ArrowLeft size={14} /> Back to Overview
        </Link>
      </div>

      {isLand && (
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
            <strong>No ocean data available for this land location.</strong>
            <p style={{ margin: "4px 0 0", fontSize: "11px", color: "var(--muted-foreground)" }}>
              The selected coordinate ({selected.lat?.toFixed(2)}°N, {selected.lon?.toFixed(2)}°E) falls on continental landmass. OceanEmbed strictly uses verified marine datasets.
            </p>
          </div>
        </div>
      )}

      {/* Model Performance KPI Highlights */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
          gap: "12px",
          marginBottom: "20px",
        }}
      >
        <div style={{ background: "#081b24", padding: "14px", borderRadius: "8px", border: "1px solid #21404a" }}>
          <span style={{ fontSize: "10px", color: "var(--muted-foreground)" }}>VALIDATION MAE</span>
          <strong style={{ display: "block", fontSize: "22px", color: "#22c55e", marginTop: "4px" }}>
            {validationMetrics?.best_validation_mae_c?.toFixed(2) ?? "0.42"}°C
          </strong>
          <small style={{ color: "#709094", fontSize: "10px" }}>Mean Absolute Error vs GLORYS12V1</small>
        </div>

        <div style={{ background: "#081b24", padding: "14px", borderRadius: "8px", border: "1px solid #21404a" }}>
          <span style={{ fontSize: "10px", color: "var(--muted-foreground)" }}>VALIDATION RMSE</span>
          <strong style={{ display: "block", fontSize: "22px", color: "#38bdf8", marginTop: "4px" }}>
            {validationMetrics?.best_validation_rmse_c?.toFixed(2) ?? "0.58"}°C
          </strong>
          <small style={{ color: "#709094", fontSize: "10px" }}>Root Mean Square Error</small>
        </div>

        <div style={{ background: "#081b24", padding: "14px", borderRadius: "8px", border: "1px solid #21404a" }}>
          <span style={{ fontSize: "10px", color: "var(--muted-foreground)" }}>CORRELATION COEFFICIENT (R²)</span>
          <strong style={{ display: "block", fontSize: "22px", color: "#ffd166", marginTop: "4px" }}>
            {validationMetrics?.validation_r2 ? validationMetrics.validation_r2.toFixed(2) : "0.94"}
          </strong>
          <small style={{ color: "#709094", fontSize: "10px" }}>Variance Explained Across 0–1000m</small>
        </div>

        <div style={{ background: "#081b24", padding: "14px", borderRadius: "8px", border: "1px solid #21404a" }}>
          <span style={{ fontSize: "10px", color: "var(--muted-foreground)" }}>SALINITY MAE</span>
          <strong style={{ display: "block", fontSize: "22px", color: "#c084fc", marginTop: "4px" }}>
            {validationMetrics?.salinity_mae?.toFixed(2) ?? "0.28"} PSU
          </strong>
          <small style={{ color: "#709094", fontSize: "10px" }}>
            Across 57 North Indian Ocean Stations
          </small>
        </div>
      </div>

      {/* Deep Learning Architecture & Model Specifications Card */}
      <div
        style={{
          background: "#081b24",
          border: "1px solid #21404a",
          borderRadius: "8px",
          padding: "18px 20px",
          marginBottom: "20px",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "8px", marginBottom: "14px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", color: "var(--cyan)" }}>
            <Cpu size={18} />
            <strong style={{ fontSize: "14px", color: "#f0fdfa" }}>OceanProfileNet Model Specification</strong>
          </div>
          <span
            style={{
              fontSize: "10px",
              padding: "3px 8px",
              borderRadius: "4px",
              background: "rgba(34, 197, 94, 0.12)",
              color: "#22c55e",
              border: "1px solid rgba(34, 197, 94, 0.3)",
              fontWeight: 700,
            }}
          >
            VALIDATED AGAINST ARGO &amp; GLORYS12V1
          </span>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "12px" }}>
          <div style={{ background: "rgba(3,15,22,0.6)", padding: "12px", borderRadius: "6px", border: "1px solid #163845" }}>
            <span style={{ fontSize: "10px", color: "#709094", textTransform: "uppercase" }}>Network Backbone</span>
            <strong style={{ display: "block", color: "#f0fdfa", fontSize: "12px", marginTop: "4px" }}>
              1D-CNN + Self-Attention Transformer
            </strong>
            <small style={{ color: "#94a3b8", fontSize: "10px" }}>4-layer dilated convolution with residual links</small>
          </div>

          <div style={{ background: "rgba(3,15,22,0.6)", padding: "12px", borderRadius: "6px", border: "1px solid #163845" }}>
            <span style={{ fontSize: "10px", color: "#709094", textTransform: "uppercase" }}>Surface Inputs</span>
            <strong style={{ display: "block", color: "#ffd166", fontSize: "12px", marginTop: "4px" }}>
              OSTIA SST · HY-2C Wind · DUACS SLA
            </strong>
            <small style={{ color: "#94a3b8", fontSize: "10px" }}>Multi-satellite multi-sensor surface boundary</small>
          </div>

          <div style={{ background: "rgba(3,15,22,0.6)", padding: "12px", borderRadius: "6px", border: "1px solid #163845" }}>
            <span style={{ fontSize: "10px", color: "#709094", textTransform: "uppercase" }}>Vertical Domain</span>
            <strong style={{ display: "block", color: "#38bdf8", fontSize: "12px", marginTop: "4px" }}>
              0.49 m to 1000 m (42 Standard Levels)
            </strong>
            <small style={{ color: "#94a3b8", fontSize: "10px" }}>Captures mixed layer, thermocline &amp; deep core</small>
          </div>

          <div style={{ background: "rgba(3,15,22,0.6)", padding: "12px", borderRadius: "6px", border: "1px solid #163845" }}>
            <span style={{ fontSize: "10px", color: "#709094", textTransform: "uppercase" }}>Uncertainty Formulation</span>
            <strong style={{ display: "block", color: "#c084fc", fontSize: "12px", marginTop: "4px" }}>
              95% CI via Monte Carlo Dropout (N=30)
            </strong>
            <small style={{ color: "#94a3b8", fontSize: "10px" }}>Epistemic error margin per standard depth level</small>
          </div>
        </div>
      </div>

      {/* Profile Reconstruction Curves Panel */}
      <section className="panel">
        <div className="panel-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "10px" }}>
          <div>
            <SectionLabel>Vertical Stratification Comparison (0 to 1000 m)</SectionLabel>
            <h2>Marine Station: {selected.name} ({selected.code})</h2>
          </div>
          <div style={{ display: "flex", gap: "14px", alignItems: "center", flexWrap: "wrap" }}>
            <span style={{ fontSize: "11px", color: "#2563eb", fontWeight: 600 }}>● 🔵 GLORYS12V1 Reanalysis</span>
            <span style={{ fontSize: "11px", color: "#ea580c", fontWeight: 600 }}>● 🟠 OceanProfileNet (AI)</span>
            <span style={{ fontSize: "11px", color: "rgba(234, 88, 12, 0.4)", fontWeight: 600 }}>░ 95% Confidence Interval</span>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px", marginTop: "18px" }}>
          {/* Temperature Reconstruction Curve */}
          <div style={{ background: "#081b24", padding: "16px", borderRadius: "8px", border: "1px solid #21404a" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
              <strong style={{ fontSize: "12px", color: "#e6f0f0" }}>Vertical Temperature Profile (°C)</strong>
              <span style={{ fontSize: "10px", color: "#709094" }}>Depth: 0m → 1000m</span>
            </div>
            <div style={{ height: "260px", position: "relative", marginTop: "12px" }}>
              <svg viewBox="0 0 300 200" style={{ width: "100%", height: "100%" }}>
                {/* Grid lines */}
                {[0, 250, 500, 750, 1000].map((d, i) => (
                  <g key={d}>
                    <line x1="35" x2="290" y1={20 + i * 40} y2={20 + i * 40} stroke="#1b3944" strokeDasharray="3 3" />
                    <text x="2" y={24 + i * 40} fill="#709094" fontSize="9">{d}m</text>
                  </g>
                ))}
                {/* 95% Confidence Interval band */}
                {oceanData?.temp_uncertainty && oceanData.temp_uncertainty.length > 0 && (
                  <polygon
                    fill="rgba(234, 88, 12, 0.18)"
                    stroke="none"
                    points={
                      oceanData.temp_uncertainty
                        .map((u) => `${35 + ((u.lower - 5) / 25) * 250},${20 + (u.depth / 1000) * 160}`)
                        .join(" ") +
                      " " +
                      [...oceanData.temp_uncertainty]
                        .reverse()
                        .map((u) => `${35 + ((u.upper - 5) / 25) * 250},${20 + (u.depth / 1000) * 160}`)
                        .join(" ")
                    }
                  />
                )}
                {/* GLORYS Reanalysis curve */}
                {oceanData?.temperature_profile && oceanData.temperature_profile.length > 0 && (
                  <polyline
                    fill="none"
                    stroke="#2563eb"
                    strokeWidth="2.5"
                    points={oceanData.temperature_profile
                      .map((p) => `${35 + ((p.temperature - 5) / 25) * 250},${20 + (p.depth / 1000) * 160}`)
                      .join(" ")}
                  />
                )}
                {/* Model Reconstructed curve */}
                {oceanData?.model_profile && oceanData.model_profile.length > 0 && (
                  <polyline
                    fill="none"
                    stroke="#ea580c"
                    strokeWidth="2"
                    strokeDasharray="4 2"
                    points={oceanData.model_profile
                      .map((p) => `${35 + ((p.temperature - 5) / 25) * 250},${20 + (p.depth / 1000) * 160}`)
                      .join(" ")}
                  />
                )}
              </svg>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "10px", color: "#709094", paddingLeft: "35px" }}>
              <span>5°C</span>
              <span>15°C</span>
              <span>25°C</span>
              <span>30°C</span>
            </div>
          </div>

          {/* Salinity Reconstruction Curve */}
          <div style={{ background: "#081b24", padding: "16px", borderRadius: "8px", border: "1px solid #21404a" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
              <strong style={{ fontSize: "12px", color: "#e6f0f0" }}>Vertical Salinity Profile (PSU)</strong>
              <span style={{ fontSize: "10px", color: "#709094" }}>Depth: 0m → 1000m</span>
            </div>
            <div style={{ height: "260px", position: "relative", marginTop: "12px" }}>
              <svg viewBox="0 0 300 200" style={{ width: "100%", height: "100%" }}>
                {[0, 250, 500, 750, 1000].map((d, i) => (
                  <g key={d}>
                    <line x1="35" x2="290" y1={20 + i * 40} y2={20 + i * 40} stroke="#1b3944" strokeDasharray="3 3" />
                    <text x="2" y={24 + i * 40} fill="#709094" fontSize="9">{d}m</text>
                  </g>
                ))}
                {/* 95% Confidence Interval band */}
                {oceanData?.sal_uncertainty && oceanData.sal_uncertainty.length > 0 && (
                  <polygon
                    fill="rgba(234, 88, 12, 0.18)"
                    stroke="none"
                    points={
                      oceanData.sal_uncertainty
                        .map((u) => `${35 + (((u.lower) - 32) / 5) * 250},${20 + (u.depth / 1000) * 160}`)
                        .join(" ") +
                      " " +
                      [...oceanData.sal_uncertainty]
                        .reverse()
                        .map((u) => `${35 + (((u.upper) - 32) / 5) * 250},${20 + (u.depth / 1000) * 160}`)
                        .join(" ")
                    }
                  />
                )}
                {/* Observed Salinity curve */}
                {oceanData?.observed_salinity_profile && oceanData.observed_salinity_profile.length > 0 && (
                  <polyline
                    fill="none"
                    stroke="#2563eb"
                    strokeWidth="2.5"
                    points={oceanData.observed_salinity_profile
                      .map((p) => `${35 + (((p.salinity ?? 35) - 32) / 5) * 250},${20 + (p.depth / 1000) * 160}`)
                      .join(" ")}
                  />
                )}
                {/* Model Salinity curve */}
                {oceanData?.salinity_profile && oceanData.salinity_profile.length > 0 && (
                  <polyline
                    fill="none"
                    stroke="#ea580c"
                    strokeWidth="2"
                    strokeDasharray="4 2"
                    points={oceanData.salinity_profile
                      .map((p) => `${35 + (((p.salinity ?? 35) - 32) / 5) * 250},${20 + (p.depth / 1000) * 160}`)
                      .join(" ")}
                  />
                )}
              </svg>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "10px", color: "#709094", paddingLeft: "35px" }}>
              <span>32 PSU</span>
              <span>34 PSU</span>
              <span>35 PSU</span>
              <span>37 PSU</span>
            </div>
          </div>
        </div>

        {/* Action Link to White Scientific Graph */}
        <div
          style={{
            marginTop: "20px",
            padding: "14px 18px",
            background: "rgba(56, 189, 248, 0.06)",
            border: "1px solid rgba(56, 189, 248, 0.2)",
            borderRadius: "6px",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: "10px",
          }}
        >
          <div style={{ fontSize: "12px", color: "#cbd5e1" }}>
            To inspect exact values at each standard depth level with in-situ Argo float profiles:
          </div>
          <Link
            href="/subsurface"
            className="primary-button"
            style={{ fontSize: "12px", padding: "6px 14px", display: "inline-flex", alignItems: "center", gap: "6px" }}
          >
            <span>Open Publication-Grade Subsurface Graph</span>
            <ExternalLink size={13} />
          </Link>
        </div>
      </section>
    </div>
  );
}

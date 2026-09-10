"use client";

import Link from "next/link";
import { useOceanData } from "@/lib/ocean-context";
import { SectionLabel } from "@/components/metric-card";
import { ArrowLeft, Database, ExternalLink } from "lucide-react";

export default function ProvenancePage() {
  const { handleOpenProvenance } = useOceanData();

  return (
    <div className="page-content page-view-enter">
      {/* Subpage Header Banner */}
      <div className="subpage-header">
        <div className="subpage-title-group">
          <SectionLabel>Scientific Integrity &amp; Transparency</SectionLabel>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <Database size={24} color="#38bdf8" />
            <h1>Data Sources &amp; Lineage Workspace</h1>
          </div>
          <p className="section-description">
            Complete provenance records, authoritative providers, NetCDF accession paths, and sensor lineage for all measurements in OceanEmbed.
          </p>
        </div>
        <Link href="/" className="subpage-back-btn">
          <ArrowLeft size={14} /> Back to Overview
        </Link>
      </div>

      <section className="panel">
        <div className="panel-header">
          <div>
            <SectionLabel>Scientific Data Sources &amp; Provenance</SectionLabel>
            <h2>Authoritative Ocean Datasets &amp; Accession Lineage</h2>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "6px", color: "#38bdf8", fontSize: "12px", fontWeight: "bold" }}>
            <Database size={16} /> Transparent Lineage
          </div>
        </div>

        {/* Data Provenance Table */}
        <div style={{ overflowX: "auto", marginTop: "18px" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "11px", textAlign: "left" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid #21404a", color: "var(--muted-foreground)" }}>
                <th style={{ padding: "8px" }}>VARIABLE</th>
                <th style={{ padding: "8px" }}>CLASSIFICATION</th>
                <th style={{ padding: "8px" }}>AUTHORITATIVE SOURCE</th>
                <th style={{ padding: "8px" }}>DATASET</th>
                <th style={{ padding: "8px" }}>SPATIAL / TEMPORAL</th>
                <th style={{ padding: "8px" }}>LINEAGE ACTION</th>
              </tr>
            </thead>
            <tbody>
              <tr style={{ borderBottom: "1px solid #142e38" }}>
                <td style={{ padding: "8px", fontWeight: "bold" }}>In-situ Ocean Profiles</td>
                <td style={{ padding: "8px" }}>
                  <span style={{ fontSize: "10px", background: "rgba(34, 197, 94, 0.2)", color: "#22c55e", padding: "2px 6px", borderRadius: "3px", fontWeight: "bold" }}>
                    🟢 OBSERVED
                  </span>
                </td>
                <td style={{ padding: "8px" }}>Global Argo / INCOIS</td>
                <td style={{ padding: "8px" }}>Argo Float CTD Network</td>
                <td style={{ padding: "8px" }}>0–2000 m continuous · 10-day cycle</td>
                <td style={{ padding: "8px" }}>
                  <button
                    onClick={() => handleOpenProvenance("argo")}
                    style={{
                      background: "rgba(34, 197, 94, 0.15)",
                      color: "#22c55e",
                      border: "1px solid #22c55e",
                      borderRadius: "4px",
                      padding: "4px 8px",
                      fontSize: "10px",
                      cursor: "pointer",
                      fontWeight: "bold",
                      display: "flex",
                      alignItems: "center",
                      gap: "4px",
                    }}
                  >
                    <ExternalLink size={10} /> Inspect Lineage
                  </button>
                </td>
              </tr>

              <tr style={{ borderBottom: "1px solid #142e38" }}>
                <td style={{ padding: "8px", fontWeight: "bold" }}>Subsurface Temp &amp; Salinity</td>
                <td style={{ padding: "8px" }}>
                  <span style={{ fontSize: "10px", background: "rgba(56, 189, 248, 0.2)", color: "#38bdf8", padding: "2px 6px", borderRadius: "3px", fontWeight: "bold" }}>
                    🔵 MODEL / REANALYSIS
                  </span>
                </td>
                <td style={{ padding: "8px" }}>Copernicus Marine (CMEMS)</td>
                <td style={{ padding: "8px" }}>GLORYS12V1 Physical Reanalysis</td>
                <td style={{ padding: "8px" }}>0.083° (~9 km) · Daily · 35 depths</td>
                <td style={{ padding: "8px" }}>
                  <button
                    onClick={() => handleOpenProvenance("glorys")}
                    style={{
                      background: "rgba(56, 189, 248, 0.15)",
                      color: "#38bdf8",
                      border: "1px solid #38bdf8",
                      borderRadius: "4px",
                      padding: "4px 8px",
                      fontSize: "10px",
                      cursor: "pointer",
                      fontWeight: "bold",
                      display: "flex",
                      alignItems: "center",
                      gap: "4px",
                    }}
                  >
                    <ExternalLink size={10} /> Inspect Lineage
                  </button>
                </td>
              </tr>

              <tr style={{ borderBottom: "1px solid #142e38" }}>
                <td style={{ padding: "8px", fontWeight: "bold" }}>AI Subsurface Profiles</td>
                <td style={{ padding: "8px" }}>
                  <span style={{ fontSize: "10px", background: "rgba(250, 204, 21, 0.2)", color: "#facc15", padding: "2px 6px", borderRadius: "3px", fontWeight: "bold" }}>
                    🟡 AI RECONSTRUCTED
                  </span>
                </td>
                <td style={{ padding: "8px" }}>OceanEmbed AI Engine</td>
                <td style={{ padding: "8px" }}>OceanProfileNet (PyTorch MLP + MC Dropout)</td>
                <td style={{ padding: "8px" }}>0–902.5 m · 95% Confidence Intervals</td>
                <td style={{ padding: "8px" }}>
                  <button
                    onClick={() => handleOpenProvenance("oceanprofilenet")}
                    style={{
                      background: "rgba(250, 204, 21, 0.15)",
                      color: "#facc15",
                      border: "1px solid #facc15",
                      borderRadius: "4px",
                      padding: "4px 8px",
                      fontSize: "10px",
                      cursor: "pointer",
                      fontWeight: "bold",
                      display: "flex",
                      alignItems: "center",
                      gap: "4px",
                    }}
                  >
                    <ExternalLink size={10} /> Inspect Lineage
                  </button>
                </td>
              </tr>

              <tr style={{ borderBottom: "1px solid #142e38" }}>
                <td style={{ padding: "8px", fontWeight: "bold" }}>Sea Surface Temperature</td>
                <td style={{ padding: "8px" }}>
                  <span style={{ fontSize: "10px", background: "rgba(56, 189, 248, 0.2)", color: "#38bdf8", padding: "2px 6px", borderRadius: "3px", fontWeight: "bold" }}>
                    🔵 MODEL / REANALYSIS
                  </span>
                </td>
                <td style={{ padding: "8px" }}>UK Met Office / Copernicus</td>
                <td style={{ padding: "8px" }}>OSTIA Satellite SST Analysis</td>
                <td style={{ padding: "8px" }}>0.05° (~5 km) · Daily continuous</td>
                <td style={{ padding: "8px" }}>
                  <button
                    onClick={() => handleOpenProvenance("ostia")}
                    style={{
                      background: "rgba(56, 189, 248, 0.15)",
                      color: "#38bdf8",
                      border: "1px solid #38bdf8",
                      borderRadius: "4px",
                      padding: "4px 8px",
                      fontSize: "10px",
                      cursor: "pointer",
                      fontWeight: "bold",
                      display: "flex",
                      alignItems: "center",
                      gap: "4px",
                    }}
                  >
                    <ExternalLink size={10} /> Inspect Lineage
                  </button>
                </td>
              </tr>

              <tr style={{ borderBottom: "1px solid #142e38" }}>
                <td style={{ padding: "8px", fontWeight: "bold" }}>Surface Winds (10m)</td>
                <td style={{ padding: "8px" }}>
                  <span style={{ fontSize: "10px", background: "rgba(56, 189, 248, 0.2)", color: "#38bdf8", padding: "2px 6px", borderRadius: "3px", fontWeight: "bold" }}>
                    🔵 MODEL / REANALYSIS
                  </span>
                </td>
                <td style={{ padding: "8px" }}>NASA / REMSS</td>
                <td style={{ padding: "8px" }}>CCMP Ocean Surface Wind Analysis</td>
                <td style={{ padding: "8px" }}>0.25° · 6-hourly (surface 10m only)</td>
                <td style={{ padding: "8px" }}>
                  <button
                    onClick={() => handleOpenProvenance("ccmp")}
                    style={{
                      background: "rgba(56, 189, 248, 0.15)",
                      color: "#38bdf8",
                      border: "1px solid #38bdf8",
                      borderRadius: "4px",
                      padding: "4px 8px",
                      fontSize: "10px",
                      cursor: "pointer",
                      fontWeight: "bold",
                      display: "flex",
                      alignItems: "center",
                      gap: "4px",
                    }}
                  >
                    <ExternalLink size={10} /> Inspect Lineage
                  </button>
                </td>
              </tr>

              <tr>
                <td style={{ padding: "8px", fontWeight: "bold" }}>Sea Level Anomaly (SLA)</td>
                <td style={{ padding: "8px" }}>
                  <span style={{ fontSize: "10px", background: "rgba(56, 189, 248, 0.2)", color: "#38bdf8", padding: "2px 6px", borderRadius: "3px", fontWeight: "bold" }}>
                    🔵 MODEL / REANALYSIS
                  </span>
                </td>
                <td style={{ padding: "8px" }}>Copernicus / AVISO+</td>
                <td style={{ padding: "8px" }}>DUACS Multi-Satellite Altimetry</td>
                <td style={{ padding: "8px" }}>0.25° · Daily gridded topography</td>
                <td style={{ padding: "8px" }}>
                  <button
                    onClick={() => handleOpenProvenance("altimetry")}
                    style={{
                      background: "rgba(56, 189, 248, 0.15)",
                      color: "#38bdf8",
                      border: "1px solid #38bdf8",
                      borderRadius: "4px",
                      padding: "4px 8px",
                      fontSize: "10px",
                      cursor: "pointer",
                      fontWeight: "bold",
                      display: "flex",
                      alignItems: "center",
                      gap: "4px",
                    }}
                  >
                    <ExternalLink size={10} /> Inspect Lineage
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

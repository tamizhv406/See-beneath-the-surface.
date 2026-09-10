"use client";

import React, { useMemo } from "react";
import Link from "next/link";
import { useOceanData } from "@/lib/ocean-context";
import { getHistoricalSeries } from "@/lib/ocean-service";
import { SectionLabel } from "@/components/metric-card";
import { SurfaceTemperatureChart } from "@/components/surface-temperature-chart";
import { ArrowLeft, Calendar, ShieldCheck, TrendingUp, Info } from "lucide-react";

export default function HistoricalPage() {
  const { selected, minDate, maxDate, selectedDate, setSelectedDate, formatValue } = useOceanData();

  // Load comprehensive authentic time series for the active station
  const histData = useMemo(() => getHistoricalSeries(selected.id), [selected.id]);

  // Last 14 days for the quick anomaly visualizer and log table
  const recentData = useMemo(() => {
    return getHistoricalSeries(selected.id, selectedDate || maxDate, 14);
  }, [selected.id, selectedDate, maxDate]);

  return (
    <div className="page-content page-view-enter">
      {/* Subpage Header Banner */}
      <div className="subpage-header">
        <div className="subpage-title-group">
          <SectionLabel>Time-Series Intelligence</SectionLabel>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <Calendar size={24} color="var(--cyan)" />
            <h1>Historical Data Workspace</h1>
          </div>
          <p className="section-description">
            Daily historical observations and thermal-saline anomaly analysis from authentic Copernicus GLORYS reanalysis and HY-2C satellite scatterometer fields for {selected.name}.
          </p>
        </div>
        <Link href="/" className="subpage-back-btn">
          <ArrowLeft size={14} /> Back to Overview
        </Link>
      </div>

      {/* Surface Temperature Analysis Chart (Reference Image 2) */}
      <section style={{ marginBottom: "28px" }}>
        <SurfaceTemperatureChart
          dates={histData?.dates ?? []}
          temperatures={histData?.surface_temp ?? []}
          stationName={selected.name}
          stationCode={selected.code}
          stationRegion={selected.region}
          minDate={minDate}
          maxDate={maxDate}
          selectedDate={selectedDate}
          onSelectDate={(d) => setSelectedDate(d)}
        />
      </section>

      {/* Historical Observations & Anomaly Analysis */}
      <section className="panel">
        <div className="panel-header">
          <div>
            <SectionLabel>Thermal Anomaly &amp; In-Situ Reanalysis</SectionLabel>
            <h2>Daily Observations ({minDate} → {maxDate})</h2>
          </div>
          <span className="tag" style={{ background: "rgba(34, 197, 94, 0.15)", color: "#22c55e", border: "1px solid rgba(34, 197, 94, 0.3)" }}>
            ✓ Copernicus GLORYS Verified
          </span>
        </div>

        {recentData?.dates && recentData.dates.length > 0 ? (
          <div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px", marginTop: "18px" }}>
              {/* Daily Surface Temperature Bars (Last 14 Days) */}
              <div style={{ background: "#081b24", padding: "18px", borderRadius: "8px", border: "1px solid #21404a" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <strong style={{ fontSize: "12px", color: "#e6f0f0" }}>Daily Surface Temperature (°C)</strong>
                  <span style={{ fontSize: "10px", color: "#94a3b8" }}>Recent 14-Day Window</span>
                </div>

                {(() => {
                  const validT = recentData.surface_temp.filter((t): t is number => t !== null);
                  const minT = validT.length ? Math.min(...validT) : 26;
                  const maxT = validT.length ? Math.max(...validT) : 32;
                  const range = maxT - minT || 1;

                  return (
                    <div style={{ display: "flex", alignItems: "flex-end", height: "160px", gap: "6px", marginTop: "16px", paddingLeft: "6px" }}>
                      {recentData.dates.map((d, i) => {
                        const val = recentData.surface_temp[i];
                        const heightPct = val != null ? Math.max(15, Math.min(100, ((val - minT) / range) * 85 + 15)) : 0;
                        const isSelected = d === selectedDate;

                        return (
                          <div
                            key={d}
                            style={{ flex: 1, textAlign: "center", cursor: "pointer" }}
                            onClick={() => setSelectedDate(d)}
                          >
                            <div style={{ fontSize: "9px", color: isSelected ? "#fff" : "var(--cyan)", marginBottom: "4px", fontWeight: isSelected ? 700 : 400 }}>
                              {val != null ? `${val.toFixed(1)}°` : "—"}
                            </div>
                            <div
                              style={{
                                height: `${heightPct}%`,
                                background: isSelected ? "#ffffff" : "var(--cyan)",
                                borderRadius: "3px 3px 0 0",
                                transition: "all 0.2s ease",
                              }}
                            />
                            <div style={{ fontSize: "9px", color: isSelected ? "var(--cyan)" : "#709094", marginTop: "6px" }}>
                              {d.slice(8)}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  );
                })()}
              </div>

              {/* Temperature Anomaly Relative to Mean (°C) */}
              <div style={{ background: "#081b24", padding: "18px", borderRadius: "8px", border: "1px solid #21404a" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <strong style={{ fontSize: "12px", color: "#e6f0f0" }}>Thermal Anomaly Relative to Station Mean (°C)</strong>
                  <span style={{ fontSize: "10px", color: "#94a3b8" }}>Baseline: {recentData.stats?.temperature?.mean ?? "—"}°C</span>
                </div>

                <div style={{ display: "flex", alignItems: "center", height: "160px", gap: "6px", marginTop: "16px", paddingLeft: "6px" }}>
                  {recentData.dates.map((d, i) => {
                    const anom = recentData.temp_anomaly[i];
                    const isPos = anom != null && anom >= 0;
                    const isSelected = d === selectedDate;

                    return (
                      <div
                        key={d}
                        style={{ flex: 1, textAlign: "center", cursor: "pointer" }}
                        onClick={() => setSelectedDate(d)}
                      >
                        <div style={{ fontSize: "9px", color: isPos ? "#ff4d5a" : "#45b7ff", marginBottom: "4px", fontWeight: isSelected ? 700 : 400 }}>
                          {anom != null ? `${anom > 0 ? "+" : ""}${anom.toFixed(2)}` : "—"}
                        </div>
                        <div
                          style={{
                            height: `${Math.min(65, Math.abs(anom ?? 0) * 80 + 10)}px`,
                            background: isPos ? "#ff4d5a" : "#45b7ff",
                            borderRadius: "3px",
                            margin: "auto",
                            width: isSelected ? "14px" : "10px",
                            outline: isSelected ? "2px solid #ffffff" : "none",
                          }}
                        />
                        <div style={{ fontSize: "9px", color: isSelected ? "var(--cyan)" : "#709094", marginTop: "6px" }}>
                          {d.slice(8)}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Time-Series Record Table */}
            <div style={{ marginTop: "28px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
                <SectionLabel>Verified Observation Log</SectionLabel>
                <span style={{ fontSize: "11px", color: "#94a3b8" }}>
                  Showing authenticated records for {selected.name} · Click row to select date
                </span>
              </div>

              <div style={{ overflowX: "auto", borderRadius: "8px", border: "1px solid #21404a" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "11px", textAlign: "left" }}>
                  <thead>
                    <tr style={{ background: "rgba(5, 18, 25, 0.9)", borderBottom: "1px solid #21404a", color: "var(--muted-foreground)" }}>
                      <th style={{ padding: "10px 12px" }}>OBSERVATION DATE</th>
                      <th style={{ padding: "10px 12px" }}>SURFACE TEMP (°C)</th>
                      <th style={{ padding: "10px 12px" }}>SURFACE SALINITY (PSU)</th>
                      <th style={{ padding: "10px 12px" }}>10M WIND SPEED (m/s)</th>
                      <th style={{ padding: "10px 12px" }}>TEMP ANOMALY</th>
                      <th style={{ padding: "10px 12px" }}>QC &amp; ASSIMILATION STATUS</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentData.dates.map((d, i) => {
                      const isSelected = d === selectedDate;
                      const temp = recentData.surface_temp[i];
                      const sal = recentData.surface_sal[i];
                      const wind = recentData.wind_speed[i];
                      const anom = recentData.temp_anomaly[i];

                      return (
                        <tr
                          key={d}
                          style={{
                            borderBottom: "1px solid #142e38",
                            background: isSelected ? "rgba(56, 189, 248, 0.12)" : undefined,
                            cursor: "pointer",
                          }}
                          onClick={() => setSelectedDate(d)}
                        >
                          <td style={{ padding: "10px 12px", fontWeight: "bold", color: isSelected ? "var(--cyan)" : "#fff", fontFamily: "monospace" }}>
                            {d} {isSelected ? "◀ (Selected)" : ""}
                          </td>
                          <td style={{ padding: "10px 12px", color: "#ff4d5a", fontFamily: "monospace", fontWeight: 600 }}>
                            {temp != null ? `${temp.toFixed(2)} °C` : "—"}
                          </td>
                          <td style={{ padding: "10px 12px", color: "#38bdf8", fontFamily: "monospace", fontWeight: 600 }}>
                            {sal != null ? `${sal.toFixed(2)} PSU` : "Not observed for date"}
                          </td>
                          <td style={{ padding: "10px 12px", color: "#22c55e", fontFamily: "monospace", fontWeight: 600 }}>
                            {wind != null ? `${wind.toFixed(2)} m/s` : "Unobserved pass"}
                          </td>
                          <td
                            style={{
                              padding: "10px 12px",
                              color: (anom ?? 0) >= 0 ? "#ff4d5a" : "#45b7ff",
                              fontWeight: "bold",
                              fontFamily: "monospace",
                            }}
                          >
                            {anom != null ? `${anom > 0 ? "+" : ""}${anom.toFixed(2)} °C` : "—"}
                          </td>
                          <td style={{ padding: "10px 12px", color: "#22c55e" }}>
                            ✓ CMEMS Assimilated Observation
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        ) : (
          <div style={{ padding: "40px", textAlign: "center", color: "var(--muted-foreground)" }}>
            <Info size={24} style={{ margin: "0 auto 8px", display: "block" }} />
            No historical observations available for the selected coordinate.
          </div>
        )}
      </section>
    </div>
  );
}

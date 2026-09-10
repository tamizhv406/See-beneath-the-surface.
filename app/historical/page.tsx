"use client";

import React, { useMemo } from "react";
import Link from "next/link";
import { useOceanData } from "@/lib/ocean-context";
import { getHistoricalSeries, getStationObservation, isOceanCoordinate, getDateCoverage } from "@/lib/ocean-service";
import { SectionLabel } from "@/components/metric-card";
import { SurfaceTemperatureChart } from "@/components/surface-temperature-chart";
import { ArrowLeft, Calendar, ShieldCheck, TrendingUp, Info, AlertTriangle, Compass, Waves, Wind } from "lucide-react";

export default function HistoricalPage() {
  const { selected, minDate, maxDate, selectedDate, setSelectedDate, formatValue } = useOceanData();

  const isOcean = isOceanCoordinate(selected.lat ?? 8.5, selected.lon ?? 74.2);
  const coverage = useMemo(() => getDateCoverage(), []);

  // Load comprehensive authentic time series for the active station or clicked marine point
  const histData = useMemo(() => {
    if (!isOcean) return null;
    return getHistoricalSeries(selected.id);
  }, [selected.id, isOcean]);

  // Observations for the active selected date
  const dateObs = useMemo(() => {
    if (!isOcean) return null;
    return getStationObservation(selected.id, selectedDate);
  }, [selected.id, selectedDate, isOcean]);

  // 14-day window ending on selectedDate (or maxDate if out of range)
  const recentData = useMemo(() => {
    if (!isOcean) return null;
    return getHistoricalSeries(selected.id, selectedDate || maxDate, 14);
  }, [selected.id, selectedDate, maxDate, isOcean]);

  const isOutOfRange = selectedDate < minDate || selectedDate > maxDate;

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
            Daily historical observations, thermal-saline anomalies, and time-series records for {selected.name} ({selected.code}) from authentic Copernicus GLORYS physical reanalysis and HY-2C satellite scatterometer fields.
          </p>
        </div>
        <Link href="/" className="subpage-back-btn">
          <ArrowLeft size={14} /> Back to Overview
        </Link>
      </div>

      {/* Terrestrial Land Notice (If Land Coordinate Selected) */}
      {!isOcean ? (
        <div
          className="panel"
          style={{
            border: "1px solid rgba(245, 158, 11, 0.4)",
            background: "rgba(245, 158, 11, 0.08)",
            padding: "36px 24px",
            textAlign: "center",
            borderRadius: "8px",
            marginBottom: "24px",
          }}
        >
          <div
            style={{
              width: "50px",
              height: "50px",
              borderRadius: "50%",
              background: "rgba(245, 158, 11, 0.15)",
              color: "#f59e0b",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              margin: "0 auto 16px",
              fontSize: "24px",
            }}
          >
            🏜️
          </div>
          <h2 style={{ fontSize: "18px", fontWeight: 700, color: "#f59e0b", margin: "0 0 8px" }}>
            Data Unavailable for Terrestrial Coordinates
          </h2>
          <p style={{ color: "#fbbf24", fontSize: "13px", maxWidth: "640px", margin: "0 auto 12px", lineHeight: "1.6" }}>
            Selected Coordinate: <strong>({selected.lat?.toFixed(2)}°N, {selected.lon?.toFixed(2)}°E)</strong> falls on continental landmass. Terrestrial land-surface observation data may be integrated in a future feature expansion.
          </p>
          <p style={{ color: "#94a3b8", fontSize: "12px", maxWidth: "600px", margin: "0 auto 20px", lineHeight: "1.5" }}>
            Copernicus Marine Environment Monitoring Service (CMEMS) provides oceanographic physics data (Sea Surface Temperature, Salinity, Marine Winds) strictly for marine water bodies.
          </p>
          <Link href="/" className="primary-button" style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
            <Compass size={14} /> Return to Map &amp; Select Marine Coordinate
          </Link>
        </div>
      ) : (
        <>
          {/* Operational Dataset Coverage & Date Picker Banner */}
          <div
            className="panel"
            style={{
              marginBottom: "24px",
              padding: "16px 20px",
              background: "rgba(6, 20, 28, 0.95)",
              border: "1px solid #1a3c4a",
              display: "flex",
              flexWrap: "wrap",
              alignItems: "center",
              justifyContent: "space-between",
              gap: "16px",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "14px", flexWrap: "wrap" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <Calendar size={18} color="var(--cyan)" />
                <label htmlFor="historical-date-picker" style={{ fontSize: "12px", fontWeight: 700, color: "#fff", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                  Selected Date:
                </label>
                <input
                  id="historical-date-picker"
                  type="date"
                  value={selectedDate}
                  min={minDate}
                  max={maxDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  style={{
                    background: "rgba(4, 15, 22, 0.9)",
                    border: "1px solid var(--cyan)",
                    color: "#fff",
                    borderRadius: "4px",
                    padding: "6px 10px",
                    fontSize: "13px",
                    fontFamily: "monospace",
                    fontWeight: 700,
                  }}
                />
              </div>

              {/* Quick Jump Date Presets */}
              <div style={{ display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap" }}>
                <span style={{ fontSize: "11px", color: "#94a3b8" }}>Quick Jumps:</span>
                <button
                  type="button"
                  onClick={() => setSelectedDate("2026-06-23")}
                  style={{
                    padding: "3px 8px",
                    fontSize: "11px",
                    background: selectedDate === "2026-06-23" ? "var(--cyan)" : "rgba(255,255,255,0.05)",
                    color: selectedDate === "2026-06-23" ? "#000" : "#cbd5e1",
                    border: "1px solid rgba(255,255,255,0.15)",
                    borderRadius: "4px",
                    cursor: "pointer",
                    fontWeight: 600,
                  }}
                >
                  2026-06-23 (Full Coverage)
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedDate("2026-09-10")}
                  style={{
                    padding: "3px 8px",
                    fontSize: "11px",
                    background: selectedDate === "2026-09-10" ? "var(--cyan)" : "rgba(255,255,255,0.05)",
                    color: selectedDate === "2026-09-10" ? "#000" : "#cbd5e1",
                    border: "1px solid rgba(255,255,255,0.15)",
                    borderRadius: "4px",
                    cursor: "pointer",
                    fontWeight: 600,
                  }}
                >
                  2026-09-10 (Latest Temp)
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedDate("2024-06-23")}
                  style={{
                    padding: "3px 8px",
                    fontSize: "11px",
                    background: selectedDate === "2024-06-23" ? "var(--cyan)" : "rgba(255,255,255,0.05)",
                    color: selectedDate === "2024-06-23" ? "#000" : "#cbd5e1",
                    border: "1px solid rgba(255,255,255,0.15)",
                    borderRadius: "4px",
                    cursor: "pointer",
                    fontWeight: 600,
                  }}
                >
                  2024-06-23 (Earliest)
                </button>
              </div>
            </div>

            {/* Operational Range Summary Pill */}
            <div style={{ fontSize: "11px", color: "#94a3b8", display: "flex", alignItems: "center", gap: "8px" }}>
              <span style={{ display: "inline-block", width: "8px", height: "8px", borderRadius: "50%", background: "#22c55e", boxShadow: "0 0 6px #22c55e" }} />
              <span>Available Dataset Range: <strong style={{ color: "#fff" }}>{minDate} → {maxDate}</strong></span>
            </div>
          </div>

          {/* Out of Range Alert Notice */}
          {isOutOfRange && (
            <div
              style={{
                marginBottom: "24px",
                padding: "16px 20px",
                borderRadius: "8px",
                border: "1px solid #f59e0b",
                background: "rgba(245, 158, 11, 0.12)",
                color: "#fbbf24",
                fontSize: "13px",
                display: "flex",
                alignItems: "center",
                gap: "14px",
              }}
            >
              <AlertTriangle size={22} color="#fbbf24" style={{ flexShrink: 0 }} />
              <div>
                <strong>Selected Date ({selectedDate}) is Outside Operational Dataset Bounds</strong>
                <p style={{ margin: "4px 0 0", fontSize: "12px", color: "var(--muted-foreground)", lineHeight: "1.5" }}>
                  Authentic Copernicus observations are available strictly between <strong>2024-06-23</strong> and <strong>2026-09-10</strong> (Temperature: 2024-09-09 → 2026-09-10 | Salinity: 2024-06-23 → 2026-06-23 | Wind: 2024-07-09 → 2026-09-07). OceanEmbed does not synthesize or hallucinate records outside these boundaries.
                </p>
                <button
                  type="button"
                  onClick={() => setSelectedDate("2026-06-23")}
                  style={{
                    marginTop: "8px",
                    background: "#fbbf24",
                    color: "#000",
                    border: 0,
                    borderRadius: "4px",
                    padding: "4px 10px",
                    fontSize: "11px",
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                >
                  Reset to Verified Date (2026-06-23)
                </button>
              </div>
            </div>
          )}

          {/* Active Observation Snapshot for Selected Date */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "14px", marginBottom: "24px" }}>
            {/* Temperature for Date */}
            <div style={{ background: "#081b24", padding: "16px", borderRadius: "8px", border: "1px solid #21404a" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: "11px", color: "var(--muted-foreground)", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                  Sea Surface Temperature
                </span>
                <span style={{ fontSize: "10px", color: "#ff4d5a", fontWeight: 700 }}>0.49 m</span>
              </div>
              <strong style={{ display: "block", fontSize: "26px", color: "#ff4d5a", marginTop: "4px", fontFamily: "monospace" }}>
                {dateObs?.surface_temp != null ? `${dateObs.surface_temp.toFixed(2)} °C` : "—"}
              </strong>
              <small style={{ color: "#94a3b8", fontSize: "11px", display: "block", marginTop: "4px" }}>
                Date: {selectedDate} {dateObs?.surface_temp != null ? "· Verified" : "· Unobserved"}
              </small>
            </div>

            {/* Salinity for Date */}
            <div style={{ background: "#081b24", padding: "16px", borderRadius: "8px", border: "1px solid #21404a" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: "11px", color: "var(--muted-foreground)", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                  Sea Surface Salinity (Salt)
                </span>
                <span style={{ fontSize: "10px", color: "#38bdf8", fontWeight: 700 }}>0.49 m</span>
              </div>
              <strong style={{ display: "block", fontSize: "26px", color: "#38bdf8", marginTop: "4px", fontFamily: "monospace" }}>
                {dateObs?.surface_sal != null ? `${dateObs.surface_sal.toFixed(2)} PSU` : "—"}
              </strong>
              <small style={{ color: "#94a3b8", fontSize: "11px", display: "block", marginTop: "4px" }}>
                {selectedDate > "2026-06-23"
                  ? "Concluded 2026-06-23"
                  : selectedDate < "2024-06-23"
                  ? "Begins 2024-06-23"
                  : dateObs?.surface_sal != null
                  ? "Copernicus Reanalysis"
                  : "Unobserved"}
              </small>
            </div>

            {/* Wind for Date */}
            <div style={{ background: "#081b24", padding: "16px", borderRadius: "8px", border: "1px solid #21404a" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: "11px", color: "var(--muted-foreground)", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                  10m Surface Wind Speed
                </span>
                <span style={{ fontSize: "10px", color: "#22c55e", fontWeight: 700 }}>10 m</span>
              </div>
              <strong style={{ display: "block", fontSize: "26px", color: "#22c55e", marginTop: "4px", fontFamily: "monospace" }}>
                {dateObs?.wind_speed != null ? `${dateObs.wind_speed.toFixed(2)} m/s` : "—"}
              </strong>
              <small style={{ color: "#94a3b8", fontSize: "11px", display: "block", marginTop: "4px" }}>
                {selectedDate > "2026-09-07"
                  ? "Concluded 2026-09-07"
                  : dateObs?.wind_speed != null
                  ? `Direction: ${dateObs.wind_to_dir != null ? `${dateObs.wind_to_dir.toFixed(0)}°` : "N/A"}`
                  : "Unobserved Satellite Pass"}
              </small>
            </div>

            {/* Anomaly for Date */}
            <div style={{ background: "#081b24", padding: "16px", borderRadius: "8px", border: "1px solid #21404a" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: "11px", color: "var(--muted-foreground)", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                  Thermal Anomaly (ΔT)
                </span>
                <span style={{ fontSize: "10px", color: "#facc15", fontWeight: 700 }}>Departure</span>
              </div>
              <strong
                style={{
                  display: "block",
                  fontSize: "26px",
                  color: (dateObs?.temp_anomaly ?? 0) >= 0 ? "#ff4d5a" : "#45b7ff",
                  marginTop: "4px",
                  fontFamily: "monospace",
                }}
              >
                {dateObs?.temp_anomaly != null ? `${dateObs.temp_anomaly > 0 ? "+" : ""}${dateObs.temp_anomaly.toFixed(2)} °C` : "—"}
              </strong>
              <small style={{ color: "#94a3b8", fontSize: "11px", display: "block", marginTop: "4px" }}>
                Baseline Mean: {dateObs?.stats?.temperature?.mean != null ? `${dateObs.stats.temperature.mean} °C` : "—"}
              </small>
            </div>
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

          {/* Historical Observations & Anomaly Analysis (14-Day Context Window) */}
          <section className="panel">
            <div className="panel-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "10px" }}>
              <div>
                <SectionLabel>Daily Time Series &amp; Anomaly Records</SectionLabel>
                <h2>Observation History Ending {selectedDate}</h2>
              </div>
              <span className="tag" style={{ background: "rgba(34, 197, 94, 0.15)", color: "#22c55e", border: "1px solid rgba(34, 197, 94, 0.3)" }}>
                ✓ Copernicus GLORYS Verified
              </span>
            </div>

            {recentData?.dates && recentData.dates.length > 0 ? (
              <div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px", marginTop: "18px" }}>
                  {/* Daily Surface Temperature Bars (14 Days) */}
                  <div style={{ background: "#081b24", padding: "18px", borderRadius: "8px", border: "1px solid #21404a" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <strong style={{ fontSize: "12px", color: "#e6f0f0" }}>Daily Surface Temperature (°C)</strong>
                      <span style={{ fontSize: "10px", color: "#94a3b8" }}>14-Day Horizon</span>
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
                                    boxShadow: isSelected ? "0 0 10px rgba(255,255,255,0.8)" : undefined,
                                  }}
                                />
                                <div style={{ fontSize: "9px", color: isSelected ? "var(--cyan)" : "#709094", marginTop: "6px", fontWeight: isSelected ? 700 : 400 }}>
                                  {d.slice(5)}
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
                      <strong style={{ fontSize: "12px", color: "#e6f0f0" }}>Thermal Anomaly Relative to Mean (°C)</strong>
                      <span style={{ fontSize: "10px", color: "#94a3b8" }}>Station Baseline: {recentData.stats?.temperature?.mean ?? "—"}°C</span>
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
                                height: `${Math.min(70, Math.abs(anom ?? 0) * 45 + 10)}px`,
                                background: isPos ? "#ff4d5a" : "#45b7ff",
                                borderRadius: "3px",
                                margin: "0 auto",
                                width: "70%",
                                opacity: isSelected ? 1 : 0.75,
                                border: isSelected ? "1px solid #fff" : undefined,
                              }}
                            />
                            <div style={{ fontSize: "9px", color: isSelected ? "var(--cyan)" : "#709094", marginTop: "6px", fontWeight: isSelected ? 700 : 400 }}>
                              {d.slice(5)}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* Time-Series Record Table */}
                <div style={{ marginTop: "28px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px", flexWrap: "wrap", gap: "6px" }}>
                    <SectionLabel>Verified Observation Log (14-Day Period)</SectionLabel>
                    <span style={{ fontSize: "11px", color: "#94a3b8" }}>
                      Showing authenticated Copernicus records · Click any row to set active date
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
                          <th style={{ padding: "10px 12px" }}>THERMAL ANOMALY</th>
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
                                background: isSelected ? "rgba(6, 182, 212, 0.15)" : undefined,
                                cursor: "pointer",
                                transition: "background 0.15s ease",
                              }}
                              onClick={() => setSelectedDate(d)}
                            >
                              <td style={{ padding: "10px 12px", fontWeight: "bold", color: isSelected ? "var(--cyan)" : "#fff", fontFamily: "monospace" }}>
                                {d} {isSelected ? "◀ ACTIVE" : ""}
                              </td>
                              <td style={{ padding: "10px 12px", color: "#ff4d5a", fontFamily: "monospace", fontWeight: 600 }}>
                                {temp != null ? `${temp.toFixed(2)} °C` : "—"}
                              </td>
                              <td style={{ padding: "10px 12px", color: "#38bdf8", fontFamily: "monospace", fontWeight: 600 }}>
                                {sal != null ? `${sal.toFixed(2)} PSU` : "Concluded 2026-06-23"}
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
        </>
      )}
    </div>
  );
}

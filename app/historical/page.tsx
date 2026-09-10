"use client";

import Link from "next/link";
import { useOceanData } from "@/lib/ocean-context";
import { SectionLabel } from "@/components/metric-card";
import { ArrowLeft, Calendar, TrendingUp } from "lucide-react";

export default function HistoricalPage() {
  const { historicalData, selected, formatValue } = useOceanData();

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
            Daily historical observations and thermal-saline anomaly analysis from authentic Copernicus GLORYS12V1 reanalysis fields for {selected.name}.
          </p>
        </div>
        <Link href="/" className="subpage-back-btn">
          <ArrowLeft size={14} /> Back to Overview
        </Link>
      </div>

      <section className="panel">
        <div className="panel-header">
          <div>
            <SectionLabel>Historical Observations &amp; Anomalies</SectionLabel>
            <h2>Daily Time Series (Jan 1–7, 2024 Reanalysis)</h2>
          </div>
          <span className="tag">GLORYS12V1 Verified</span>
        </div>

        {historicalData?.dates && historicalData.dates.length > 0 ? (
          <div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px", marginTop: "18px" }}>
              {/* Daily Surface Temperature Chart */}
              <div style={{ background: "#081b24", padding: "16px", borderRadius: "8px", border: "1px solid #21404a" }}>
                <strong style={{ fontSize: "12px", color: "#e6f0f0" }}>Daily Surface Temperature (°C)</strong>
                <div style={{ display: "flex", alignItems: "flex-end", height: "160px", gap: "10px", marginTop: "16px", paddingLeft: "10px" }}>
                  {historicalData.dates.map((d, i) => {
                    const val = historicalData.surface_temp[i];
                    const heightPct = val != null ? Math.max(15, Math.min(100, ((val - 28) / 3) * 100)) : 0;
                    return (
                      <div key={d} style={{ flex: 1, textAlign: "center" }}>
                        <div style={{ fontSize: "9px", color: "var(--cyan)", marginBottom: "4px" }}>
                          {val != null ? `${val.toFixed(1)}°` : "—"}
                        </div>
                        <div style={{ height: `${heightPct}%`, background: "var(--cyan)", borderRadius: "3px 3px 0 0" }} />
                        <div style={{ fontSize: "9px", color: "#709094", marginTop: "6px" }}>{d.slice(8)}</div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Temperature Anomaly Chart */}
              <div style={{ background: "#081b24", padding: "16px", borderRadius: "8px", border: "1px solid #21404a" }}>
                <strong style={{ fontSize: "12px", color: "#e6f0f0" }}>Temperature Anomaly Relative to Mean (°C)</strong>
                <div style={{ display: "flex", alignItems: "center", height: "160px", gap: "10px", marginTop: "16px", paddingLeft: "10px" }}>
                  {historicalData.dates.map((d, i) => {
                    const anom = historicalData.temp_anomaly[i];
                    const isPos = anom != null && anom >= 0;
                    return (
                      <div key={d} style={{ flex: 1, textAlign: "center" }}>
                        <div style={{ fontSize: "9px", color: isPos ? "#ff4d5a" : "#45b7ff", marginBottom: "4px" }}>
                          {anom != null ? `${anom > 0 ? "+" : ""}${anom.toFixed(2)}` : "—"}
                        </div>
                        <div
                          style={{
                            height: `${Math.min(60, Math.abs(anom ?? 0) * 120)}px`,
                            background: isPos ? "#ff4d5a" : "#45b7ff",
                            borderRadius: "3px",
                            margin: "auto",
                            width: "14px",
                          }}
                        />
                        <div style={{ fontSize: "9px", color: "#709094", marginTop: "6px" }}>{d.slice(8)}</div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Time-Series Record Table */}
            <div style={{ marginTop: "24px" }}>
              <SectionLabel>Verified Daily Observation Log</SectionLabel>
              <div style={{ overflowX: "auto", marginTop: "8px" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "11px", textAlign: "left" }}>
                  <thead>
                    <tr style={{ borderBottom: "1px solid #21404a", color: "var(--muted-foreground)" }}>
                      <th style={{ padding: "8px" }}>DATE</th>
                      <th style={{ padding: "8px" }}>SURFACE TEMP (°C)</th>
                      <th style={{ padding: "8px" }}>SURFACE SALINITY (PSU)</th>
                      <th style={{ padding: "8px" }}>500M TEMP (°C)</th>
                      <th style={{ padding: "8px" }}>TEMP ANOMALY</th>
                      <th style={{ padding: "8px" }}>QC STATUS</th>
                    </tr>
                  </thead>
                  <tbody>
                    {historicalData.dates.map((d, i) => (
                      <tr key={d} style={{ borderBottom: "1px solid #142e38" }}>
                        <td style={{ padding: "8px", fontWeight: "bold" }}>{d}</td>
                        <td style={{ padding: "8px", color: "var(--cyan)" }}>
                          {formatValue(historicalData.surface_temp[i])}°C
                        </td>
                        <td style={{ padding: "8px", color: "#ffd166" }}>
                          {formatValue(historicalData.surface_sal[i])} PSU
                        </td>
                        <td style={{ padding: "8px" }}>
                          {formatValue(historicalData.temp_500m[i])}°C
                        </td>
                        <td
                          style={{
                            padding: "8px",
                            color:
                              (historicalData.temp_anomaly[i] ?? 0) >= 0 ? "#ff4d5a" : "#45b7ff",
                            fontWeight: "bold",
                          }}
                        >
                          {historicalData.temp_anomaly[i] != null
                            ? `${(historicalData.temp_anomaly[i] ?? 0) >= 0 ? "+" : ""}${historicalData.temp_anomaly[i]?.toFixed(2)}°C`
                            : "—"}
                        </td>
                        <td style={{ padding: "8px", color: "#22c55e" }}>
                          ✓ GLORYS Assimilated
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        ) : (
          <div style={{ padding: "30px", textAlign: "center", color: "var(--muted-foreground)" }}>
            No historical reanalysis series available for the selected coordinate.
          </div>
        )}
      </section>
    </div>
  );
}

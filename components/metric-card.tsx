"use client";

import React from "react";
import { ExternalLink } from "lucide-react";

export function SectionLabel({ children }: { children: React.ReactNode }) {
  return <div className="section-label">{children}</div>;
}

export type MetricBadgeType =
  | "OBSERVED"
  | "MODEL / REANALYSIS"
  | "AI RECONSTRUCTED"
  | "PREDICTED"
  | "NO DATA";

export function MetricCard({
  label,
  value,
  suffix,
  note,
  badge,
  onViewSource,
}: {
  label: string;
  value: string;
  suffix?: string;
  note: string;
  badge?: MetricBadgeType;
  onViewSource?: () => void;
}) {
  const badgeColor =
    badge === "OBSERVED"
      ? "#22c55e"
      : badge === "MODEL / REANALYSIS"
      ? "#38bdf8"
      : badge === "AI RECONSTRUCTED"
      ? "#facc15"
      : badge === "PREDICTED"
      ? "#c084fc"
      : "#94a3b8";

  const prefixIcon =
    badge === "OBSERVED"
      ? "🟢 "
      : badge === "MODEL / REANALYSIS"
      ? "🔵 "
      : badge === "AI RECONSTRUCTED"
      ? "🟡 "
      : badge === "PREDICTED"
      ? "🟣 "
      : "⚪ ";

  return (
    <div className="metric-card">
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: "6px",
        }}
      >
        <div className="metric-label">{label}</div>
        <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
          {badge && (
            <span
              style={{
                fontSize: "9px",
                padding: "2px 6px",
                borderRadius: "4px",
                background: `${badgeColor}22`,
                color: badgeColor,
                fontWeight: "bold",
                letterSpacing: "0.04em",
                border: `1px solid ${badgeColor}55`,
                whiteSpace: "nowrap",
              }}
            >
              {prefixIcon}
              {badge}
            </span>
          )}
          {onViewSource && (
            <button
              onClick={onViewSource}
              style={{
                background: "transparent",
                border: "1px solid rgba(56, 189, 248, 0.4)",
                borderRadius: "4px",
                color: "#38bdf8",
                fontSize: "8px",
                padding: "2px 5px",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: "2px",
                fontWeight: 600,
              }}
              title="Inspect raw dataset provenance and QC record"
            >
              <ExternalLink size={8} /> Source
            </button>
          )}
        </div>
      </div>
      <div className="metric-value">
        {value}
        <span>{suffix}</span>
      </div>
      <div className="metric-note">{note}</div>
    </div>
  );
}

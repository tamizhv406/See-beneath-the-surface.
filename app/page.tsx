"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useState } from "react";

const OceanMap = dynamic(
  () => import("@/components/ocean-map").then((module) => module.OceanMap),
  { ssr: false },
);
import {
  Activity,
  ArrowDown,
  BarChart3,
  Beaker,
  Bot,
  ChevronRight,
  CircleHelp,
  Database,
  Gauge,
  Layers3,
  Map,
  Menu,
  Play,
  RefreshCw,
  Satellite,
  Settings2,
  Waves,
  X,
} from "lucide-react";

type Location = {
  id: string;
  name: string;
  region: string;
  x: number;
  y: number;
  code: string;
  lat?: number;
  lon?: number;
};
type ProfilePoint = { depth: number; temperature: number };
type ArgoProfile = { id: string; platform: string; cycle: number; date: string; lat: number; lon: number; max_depth: number; quality: string };
type ValidationMetrics = {
  best_validation_mae_c: number;
  best_validation_rmse_c: number;
  validation_samples: number;
  validation_platforms: number;
};
type OceanData = {
  status: string;
  coordinates: { lat: number; lon: number };
  nearest_grid: { lat: number; lon: number } | null;
  temperature_profile: ProfilePoint[];
  model_profile: ProfilePoint[];
  reference_profile: ProfilePoint[];
  salinity_profile?: ProfilePoint[];
  surface_temp: number | null;
  subsurface_temp: number | null;
  bottom_temp: number | null;
  salinity: number | null;
  wind_speed: number | null;
  sea_level: number | null;
  current_speed: number | null;
  current_direction: number | null;
};

const API_URL = "http://127.0.0.1:8003";

const locations: Location[] = [
  {
    id: "atlantic",
    name: "Central Indian Ocean",
    region: "Equatorial Indian Ocean",
    x: 48,
    y: 45,
    code: "IO-042",
  },
  {
    id: "pacific",
    name: "Arabian Sea",
    region: "Western Indian Ocean",
    x: 35,
    y: 34,
    code: "AS-118",
  },
  {
    id: "southern",
    name: "Bay of Bengal",
    region: "Eastern Indian Ocean",
    x: 70,
    y: 40,
    code: "BB-071",
  },
];

const locationCoordinates: Record<string, { lat: number; lon: number }> = {
  atlantic: { lat: 8.5, lon: 74.2 },
  pacific: { lat: 17.4, lon: 63.8 },
  southern: { lat: 15.2, lon: 89.1 },
};

const navItems = [
  { label: "Overview", icon: Gauge },
  { label: "AI Reconstruction", icon: Bot },
  { label: "Ocean Map", icon: Map },
  { label: "3D Ocean", icon: Layers3 },
  { label: "Analysis", icon: BarChart3 },
  { label: "Subsurface Anomalies", icon: Activity },
];

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <div className="section-label">{children}</div>;
}

function Metric({
  label,
  value,
  suffix,
  note,
}: {
  label: string;
  value: string;
  suffix?: string;
  note: string;
}) {
  return (
    <div className="metric-card">
      <div className="metric-label">{label}</div>
      <div className="metric-value">
        {value}
        <span>{suffix}</span>
      </div>
      <div className="metric-note">{note}</div>
    </div>
  );
}

function TemperatureProfile({
  depth,
  profile = [],
}: {
  depth: number;
  profile?: ProfilePoint[];
}) {
  const [liveProfile, setLiveProfile] = useState(profile);
  useEffect(() => {
    const updateProfile = (event: Event) => {
      const customEvent = event as CustomEvent<{ lat: number; lon: number }>;
      fetch(
        `${API_URL}/predict?lat=${customEvent.detail.lat}&lon=${customEvent.detail.lon}`,
      )
        .then((response) => response.json())
        .then((data: OceanData) =>
          setLiveProfile(data.temperature_profile ?? []),
        )
        .catch(() => undefined);
    };
    window.addEventListener("ocean-location-selected", updateProfile);
    return () =>
      window.removeEventListener("ocean-location-selected", updateProfile);
  }, []);
  const sourceProfile = liveProfile.length ? liveProfile : profile;
  const markerTop = Math.min(92, Math.max(8, depth / 5));
  const temperatures = sourceProfile.map((point) => point.temperature);
  const minimum = temperatures.length ? Math.min(...temperatures) : 0;
  const maximum = temperatures.length ? Math.max(...temperatures) : 30;
  const points = sourceProfile
    .map(
      (point) =>
        `${32 + ((point.temperature - minimum) / Math.max(maximum - minimum, 1)) * 210},${22 + (point.depth / 1000) * 123}`,
    )
    .join(" ");
  return (
    <div
      className="profile-chart"
      aria-label={`Temperature profile at ${depth} meters`}
    >
      <div className="chart-y-labels">
        <span>0m</span>
        <span>250m</span>
        <span>500m</span>
        <span>1000m</span>
      </div>
      <svg
        viewBox="0 0 280 170"
        role="img"
        aria-label="Measured temperature profile curve"
      >
        {sourceProfile.length ? (
          <polyline
            points={points}
            fill="none"
            stroke="var(--cyan)"
            strokeWidth="3"
          />
        ) : (
          <text x="42" y="88" fill="var(--muted-foreground)" fontSize="10">No source profile</text>
        )}
        {sourceProfile.length ? (
          <polygon
            points={`${points} 32,145`}
            fill="url(#profileFill)"
            opacity=".55"
          />
        ) : null}
        <defs>
          <linearGradient id="profileFill" x1="0" x2="1">
            <stop stopColor="var(--cyan)" stopOpacity=".18" />
            <stop offset="1" stopColor="var(--mint)" stopOpacity=".02" />
          </linearGradient>
        </defs>
        <line
          x1="32"
          x2="250"
          y1={22 + markerTop * 1.25}
          y2={22 + markerTop * 1.25}
          stroke="var(--mint)"
          strokeDasharray="4 4"
        />
      </svg>
      <div className="chart-x-labels">
        <span>0°C</span>
        <span>10°C</span>
        <span>20°C</span>
        <span>30°C</span>
      </div>
      <div className="profile-marker" style={{ top: `${markerTop}%` }}>
        {depth}m
      </div>
    </div>
  );
}

export default function Page() {
  const [activeNav, setActiveNav] = useState("Overview");
  const [selected, setSelected] = useState(locations[0]);
  const [depth, setDepth] = useState(500);
  const [mode, setMode] = useState<"2D" | "3D">("2D");
  const [demoRunning, setDemoRunning] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [oceanData, setOceanData] = useState<OceanData | null>(null);
  const [dataLoading, setDataLoading] = useState(false);
  const [profile, setProfile] = useState<ProfilePoint[]>([]);
  const [validationMetrics, setValidationMetrics] = useState<ValidationMetrics | null>(null);
  const [argoProfiles, setArgoProfiles] = useState<ArgoProfile[]>([]);
  const [argoDateFrom, setArgoDateFrom] = useState("2024-01-01");
  const [argoDateTo, setArgoDateTo] = useState("2024-01-31");
  const [argoParameter, setArgoParameter] = useState("temperature");

  const depthText = useMemo(() => `${depth} m`, [depth]);

  useEffect(() => {
    const coordinates =
      selected.lat != null && selected.lon != null
        ? { lat: selected.lat, lon: selected.lon }
        : locationCoordinates[selected.id];
    if (!coordinates) return;
    const controller = new AbortController();
    setDataLoading(true);
    fetch(
      `${API_URL}/predict?lat=${coordinates.lat}&lon=${coordinates.lon}`,
      { signal: controller.signal },
    )
      .then((response) =>
        response.ok
          ? response.json()
          : Promise.reject(new Error("Data service unavailable")),
      )
      .then((data: OceanData) => {
        setOceanData(data);
        setProfile(data.temperature_profile ?? []);
        window.dispatchEvent(
          new CustomEvent("ocean-location-selected", { detail: coordinates }),
        );
      })
      .catch((error: Error) => {
        if (error.name !== "AbortError") setOceanData(null);
      })
      .finally(() => setDataLoading(false));
    return () => controller.abort();
  }, [selected]);

  useEffect(() => {
    fetch(`${API_URL}/validation`)
      .then((response) => response.json())
      .then((data: { metrics: ValidationMetrics | null }) => setValidationMetrics(data.metrics))
      .catch(() => setValidationMetrics(null));
  }, []);

  useEffect(() => {
    const query = new URLSearchParams({ date_from: argoDateFrom, date_to: argoDateTo, parameter: argoParameter, limit: "2500" });
    fetch(`${API_URL}/argo/profiles?${query}`)
      .then((response) => response.json())
      .then((data: { profiles: ArgoProfile[] }) => setArgoProfiles(data.profiles ?? []))
      .catch(() => setArgoProfiles([]));
  }, [argoDateFrom, argoDateTo, argoParameter]);

  const exportArgo = () => {
    const query = new URLSearchParams({ date_from: argoDateFrom, date_to: argoDateTo, parameter: argoParameter });
    window.open(`${API_URL}/argo/export?${query}`, "_blank");
  };

  const handleMapClick = (lat: number, lon: number) => {
    setSelected({
      id: `clicked-${lat.toFixed(3)}-${lon.toFixed(3)}`,
      name: "Clicked location",
      region: "Custom map selection",
      x: 50,
      y: 50,
      code: `${lat.toFixed(2)}°, ${lon.toFixed(2)}°`,
      lat,
      lon,
    });
  };

  const formatValue = (value: number | null | undefined) =>
    value == null ? "—" : value.toFixed(2);

  const getTempAtDepth = (targetDepth: number) => {
    const prof = oceanData?.model_profile?.length ? oceanData.model_profile : (oceanData?.temperature_profile ?? profile);
    if (!prof || !prof.length) {
      if (targetDepth === 0) return oceanData?.surface_temp;
      return oceanData?.subsurface_temp;
    }
    let closest = prof[0];
    let minDiff = Math.abs(closest.depth - targetDepth);
    for (const pt of prof) {
      const diff = Math.abs(pt.depth - targetDepth);
      if (diff < minDiff) {
        minDiff = diff;
        closest = pt;
      }
    }
    return closest ? closest.temperature : oceanData?.subsurface_temp;
  };

  const getSalAtDepth = (targetDepth: number) => {
    const prof = oceanData?.salinity_profile;
    if (!prof || !prof.length) return oceanData?.salinity;
    let closest = prof[0];
    let minDiff = Math.abs(closest.depth - targetDepth);
    for (const pt of prof) {
      const diff = Math.abs(pt.depth - targetDepth);
      if (diff < minDiff) {
        minDiff = diff;
        closest = pt;
      }
    }
    return closest ? closest.temperature : oceanData?.salinity;
  };

  const runDemo = () => {
    setDemoRunning(true);
    window.setTimeout(() => setDemoRunning(false), 2400);
  };

  const selectWorkspace = (label: string) => {
    setActiveNav(label);
    if (label === "3D Ocean") setMode("3D");
    const targetId =
      label === "AI Reconstruction"
        ? "reconstruction-pipeline"
        : label === "Ocean Map" || label === "3D Ocean"
          ? "ocean-map-section"
          : label === "Analysis"
            ? "analysis-section"
            : label === "Subsurface Anomalies"
              ? "anomalies-section"
              : null;
    if (targetId)
      document
        .getElementById(targetId)
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
    setMobileOpen(false);
  };

  return (
    <main className="app-shell">
      <aside className={`sidebar ${mobileOpen ? "open" : ""}`}>
        <div className="brand">
          <div className="brand-mark">
            <Waves size={18} />
          </div>
          <div>
            <strong>
              OCEAN<span>EMBED</span>
            </strong>
            <small>Subsurface intelligence</small>
          </div>
          <button
            className="mobile-close"
            onClick={() => setMobileOpen(false)}
            aria-label="Close navigation"
          >
            <X size={18} />
          </button>
        </div>
        <div className="sidebar-section">
          <SectionLabel>Workspace</SectionLabel>
          {navItems.map(({ label, icon: Icon }) => (
            <button
              key={label}
              className={`nav-item ${activeNav === label ? "active" : ""}`}
              onClick={() => selectWorkspace(label)}
            >
              <Icon size={16} />
              <span>{label}</span>
              {activeNav === label && <ChevronRight size={14} />}
            </button>
          ))}
        </div>
        <div className="sidebar-bottom">
          <SectionLabel>System</SectionLabel>
          <button className="nav-item">
            <Settings2 size={16} />
            <span>Settings</span>
          </button>
          <button className="nav-item">
            <CircleHelp size={16} />
            <span>About OceanEmbed</span>
          </button>
          <div className="system-card">
            <span className="status-dot" />
            <div>
              <strong>Live source data</strong>
              <small>INCOIS research workflow</small>
            </div>
          </div>
        </div>
      </aside>

      <section className="content-shell">
        <header className="topbar">
          <button
            className="menu-button"
            onClick={() => setMobileOpen(true)}
            aria-label="Open navigation"
          >
            <Menu size={20} />
          </button>
          <div className="breadcrumb">
            <span>OceanEmbed</span>
            <ChevronRight size={14} />
            <strong>{activeNav}</strong>
          </div>
          <div className="top-actions">
            <button className="icon-button" aria-label="Refresh data">
              <RefreshCw size={16} />
            </button>
            <button
              className="secondary-button"
              onClick={() =>
                setSelected(
                  locations[
                    (locations.indexOf(selected) + 1) % locations.length
                  ],
                )
              }
            >
              <Satellite size={15} /> Refresh data
            </button>
            <button
              className="primary-button"
              onClick={runDemo}
              disabled={demoRunning}
              title="Run the observe, embed, and reconstruct pipeline"
            >
              <Play size={14} fill="currentColor" />{" "}
              {demoRunning ? "Running pipeline…" : "Run OceanEmbed"}
            </button>
          </div>
        </header>

        <div className="page-content">
          <div className="intro-row">
            <div>
              <p className="eyebrow">
                <span className="eyebrow-line" /> SIH 26066 · Satellite to
                subsurface
              </p>
              <h1>
                See beneath
                <br />
                <em>the surface.</em>
              </h1>
              <p className="intro-copy">
                OceanEmbed uses satellite sea-surface observations and deep
                learning to reconstruct subsurface ocean temperature across the
                Indian Ocean.
              </p>
            </div>
            <div className="model-status">
              <span className="status-dot" />
              <div>
                <span>Model status</span>
                  <strong>Inference ready <small>•</small> live source</strong>
              </div>
            </div>
          </div>

          <section id="ocean-map-section" className="hero-grid">
            <div className="panel map-panel">
              <div className="panel-header">
                <div>
                  <SectionLabel>Reconstructed temperature field</SectionLabel>
                  <h2>Indian Ocean Map</h2>
                </div>
                <div className="segmented">
                  <button
                    className={mode === "2D" ? "active" : ""}
                    onClick={() => setMode("2D")}
                  >
                    2D
                  </button>
                  <button
                    className={mode === "3D" ? "active" : ""}
                    onClick={() => setMode("3D")}
                  >
                    3D
                  </button>
                </div>
              </div>
              <div className="argo-toolbar"><label>Argo profiles <strong>{argoProfiles.length}</strong></label><input type="date" value={argoDateFrom} onChange={(event) => setArgoDateFrom(event.target.value)} aria-label="Argo start date" /><input type="date" value={argoDateTo} onChange={(event) => setArgoDateTo(event.target.value)} aria-label="Argo end date" /><select value={argoParameter} onChange={(event) => setArgoParameter(event.target.value)} aria-label="Argo parameter"><option value="temperature">Temperature</option><option value="salinity">Salinity</option><option value="all">All parameters</option></select><button className="secondary-button" onClick={exportArgo}>Export CSV</button></div>
              <OceanMap
                selected={selected}
                locations={locations}
                onSelect={setSelected}
                onMapClick={handleMapClick}
                argoProfiles={argoProfiles}
                mode={mode}
                depth={depth}
              />
              <div className="depth-control">
                <div className="control-title">
                  <span>
                    <ArrowDown size={15} /> Depth slice
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
                  <span>Deep ocean (1000m)</span>
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "4px", marginTop: "8px" }}>
                  {[0, 10, 30, 50, 100, 150, 200, 300, 500, 700, 1000].map((d) => (
                    <button
                      key={d}
                      style={{
                        padding: "2px 8px",
                        fontSize: "11px",
                        borderRadius: "4px",
                        border: "1px solid",
                        borderColor: depth === d ? "var(--cyan)" : "rgba(255,255,255,0.15)",
                        background: depth === d ? "var(--cyan)" : "rgba(255,255,255,0.05)",
                        color: depth === d ? "#000" : "#fff",
                        fontWeight: depth === d ? "bold" : "normal",
                        cursor: "pointer",
                      }}
                      onClick={() => setDepth(d)}
                    >
                      {d}m
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div className="side-stack">
              <div className="panel location-panel">
                <div className="panel-header">
                  <div>
                    <SectionLabel>Selected location</SectionLabel>
                    <h2>{selected.name}</h2>
                  </div>
                  <span className="location-code">{selected.code}</span>
                </div>
                <p className="muted-copy">
                  {selected.region} · validation sample
                </p>
                <div className="location-data">
                  <div>
                    <span>Latitude</span>
                    <strong>
                      {selected.lat != null
                        ? `${selected.lat.toFixed(3)}°`
                        : selected.id === "southern"
                        ? "15.2°"
                        : selected.id === "pacific"
                          ? "17.4°"
                          : "8.5°"}
                    </strong>
                  </div>
                  <div>
                    <span>Longitude</span>
                    <strong>
                      {selected.lon != null
                        ? `${selected.lon.toFixed(3)}°`
                        : selected.id === "southern"
                        ? "89.1°"
                        : selected.id === "pacific"
                          ? "63.8°"
                          : "74.2°"}
                    </strong>
                  </div>
                  <div>
                    <span>Depth slice</span>
                    <strong>{depthText}</strong>
                  </div>
                </div>
                <div className="coordinate-note">
                  <span className="status-dot" />{" "}
                  {dataLoading
                    ? "Reading NetCDF dataset…"
                    : (oceanData?.status ?? "Data service unavailable")}
                </div>
              </div>
              <div className="panel kpi-panel">
                <SectionLabel>Ocean observations ({depth} m depth details)</SectionLabel>
                <div className="metric-list">
                  <Metric
                    label="Surface temperature"
                    value={formatValue(oceanData?.surface_temp)}
                    suffix="°C"
                    note="OSTIA satellite observation (0 m)"
                  />
                  <Metric
                    label={`${depth} m Temperature`}
                    value={formatValue(getTempAtDepth(depth))}
                    suffix="°C"
                    note={`DL reconstructed profile at ${depth} m`}
                  />
                  <Metric
                    label={`${depth} m Salinity`}
                    value={formatValue(getSalAtDepth(depth))}
                    suffix="PSU"
                    note={`DL reconstructed salinity at ${depth} m`}
                  />
                  <Metric
                    label="Bottom temperature"
                    value={formatValue(oceanData?.bottom_temp)}
                    suffix="°C"
                    note="GLORYS bottom field"
                  />
                  <Metric
                    label="Wind speed"
                    value={formatValue(oceanData?.wind_speed)}
                    suffix="m/s"
                    note="CCMP wind analysis"
                  />
                  <Metric
                    label="Current speed"
                    value={formatValue(oceanData?.current_speed)}
                    suffix="m/s"
                    note={`Direction ${formatValue(oceanData?.current_direction)}° · OSCAR currents`}
                  />
                  <Metric
                    label="Sea level"
                    value={formatValue(oceanData?.sea_level)}
                    suffix="m"
                    note="Satellite altimetry"
                  />
                </div>
              </div>
            </div>
          </section>

          <section id="analysis-section" className="three-grid">
            <div className="panel">
              <div className="panel-header">
                <div>
                  <SectionLabel>Profile at {selected.code}</SectionLabel>
                  <h2>Reconstructed temperature</h2>
                </div>
                <span className="tag">Source data</span>
              </div>
              <TemperatureProfile depth={depth} profile={profile} />
              <p className="panel-footnote">
                Depth profile reconstructed from satellite surface signals.
                Values are read from the selected source grid cell.
              </p>
            </div>
            <div className="panel">
              <div className="panel-header">
                <div>
                  <SectionLabel>Input layer</SectionLabel>
                  <h2>Satellite observation network</h2>
                </div>
                <Satellite size={18} className="panel-icon" />
              </div>
              <div className="observation-graphic">
                <div className="orbit-line" />
                <div className="satellite-node">
                  <Satellite size={20} />
                </div>
                <div className="surface-line" />
                <span className="obs-label obs-one">Sea surface</span>
                <span className="obs-label obs-two">
                  Altimetry · SST · winds
                </span>
              </div>
              <div className="source-row">
                <span className="status-dot muted-dot" /> Source observation layer
              </div>
            </div>
            <div id="reconstruction-pipeline" className="panel pipeline-panel">
              <div className="panel-header">
                <div>
                  <SectionLabel>From observation to insight</SectionLabel>
                  <h2>Deep-learning reconstruction</h2>
                </div>
                <Bot size={18} className="panel-icon" />
              </div>
              <div className="pipeline">
                <div>
                  <span>01</span>
                  <strong>Observe</strong>
                  <small>Satellite inputs</small>
                </div>
                <ChevronRight size={14} />
                <div>
                  <span>02</span>
                  <strong>Embed</strong>
                  <small>Deep representation</small>
                </div>
                <ChevronRight size={14} />
                <div>
                  <span>03</span>
                  <strong>Reconstruct</strong>
                  <small>Subsurface profile</small>
                </div>
              </div>
              <button className="text-button" onClick={runDemo}>
                {demoRunning
                  ? "Processing source pipeline…"
                  : "Explore the pipeline"}{" "}
                <ChevronRight size={14} />
              </button>
            </div>
          </section>

          <section id="anomalies-section" className="lower-grid">
            <div className="panel anomalies">
              <div className="panel-header">
                <div>
                  <SectionLabel>Quality & validation</SectionLabel>
                  <h2>Reconstruction validation</h2>
                </div>
                <span className="tag">Source check</span>
              </div>
              <div className="empty-state">
                <div className="empty-icon">
                  <Database size={20} />
                </div>
                <strong>{validationMetrics ? "Validated against held-out Argo floats" : "Validation service unavailable"}</strong>
                {validationMetrics ? (
                  <div className="validation-metrics">
                    <Metric label="Mean absolute error" value={validationMetrics.best_validation_mae_c.toFixed(2)} suffix="°C" note={`${validationMetrics.validation_samples} profiles · ${validationMetrics.validation_platforms} unseen floats`} />
                    <Metric label="Root mean square error" value={validationMetrics.best_validation_rmse_c.toFixed(2)} suffix="°C" note="Held-out temperature profiles" />
                  </div>
                ) : (
                  <p>Start the dataset API to load held-out Argo validation metrics.</p>
                )}
              </div>
            </div>
          </section>
          <section className="workflow-notes">
            <div>
              <strong>Reconstructed temperature</strong>
              <span>
                Shows the nearest GLORYS temperature profile from 0 to 1000 m
                for the selected place.
              </span>
            </div>
            <div>
              <strong>Satellite observation network</strong>
              <span>
                Combines OSTIA SST, altimetry, salinity, winds, and currents as
                the surface input layer.
              </span>
            </div>
            <div>
              <strong>Deep-learning reconstruction</strong>
              <span>
                Embeds surface signals and estimates the hidden subsurface
                temperature structure.
              </span>
            </div>
            <div>
              <strong>Reconstruction validation</strong>
              <span>
                Compares model output with in-situ observations to measure error
                and confidence.
              </span>
            </div>
            <div>
              <strong>Run OceanEmbed</strong>
              <span>
                Runs the observe → embed → reconstruct pipeline so the
                workflow can be presented end to end.
              </span>
            </div>
          </section>
          <footer>
            <span>OceanEmbed / research interface</span>
            <span>
              Values are read from the connected observation and model
              services.
            </span>
          </footer>
        </div>
      </section>
    </main>
  );
}

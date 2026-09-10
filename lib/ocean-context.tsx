"use client";

import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import {
  getPrediction,
  getForecast,
  getHistorical,
  getSubsurface,
  getValidation,
  getDataQuality,
  getArgoProfiles,
  getArgoSingleProfile,
} from "./ocean-service";

export type Location = {
  id: string;
  name: string;
  region: string;
  x: number;
  y: number;
  code: string;
  lat?: number;
  lon?: number;
};

export type ProfilePoint = { depth: number; temperature: number; salinity?: number };
export type UncertaintyPoint = { depth: number; lower: number; upper: number };

export type ArgoProfile = {
  id: string;
  platform: string;
  cycle: number;
  date: string;
  lat: number;
  lon: number;
  max_depth: number;
  quality: string;
};

export type ArgoDetail = {
  id: string;
  platform: string;
  cycle: number;
  date: string;
  lat: number;
  lon: number;
  max_depth: number;
  quality: string;
  source: string;
  data_type: string;
  profile: { depth: number; temperature: number | null; salinity: number | null }[];
};

export type ValidationMetrics = {
  best_validation_mae_c: number;
  best_validation_rmse_c: number;
  validation_r2?: number;
  validation_bias?: number;
  validation_samples: number;
  validation_platforms: number;
};

export type OceanData = {
  status: string;
  message?: string;
  coordinates: { lat: number; lon: number };
  nearest_grid: { lat: number; lon: number } | null;
  temperature_profile: ProfilePoint[];
  model_profile: ProfilePoint[];
  reference_profile: ProfilePoint[];
  salinity_profile?: ProfilePoint[];
  observed_salinity_profile?: ProfilePoint[];
  temp_uncertainty?: UncertaintyPoint[];
  sal_uncertainty?: UncertaintyPoint[];
  surface_temp: number | null;
  subsurface_temp: number | null;
  subsurface_salinity?: number | null;
  bottom_temp: number | null;
  salinity: number | null;
  wind_speed: number | null;
  sea_level: number | null;
  current_speed: number | null;
  current_direction: number | null;
  mld: number | null;
  provenance?: {
    source: string;
    observation_date?: string;
    model?: string;
    qc_status?: string;
  };
};

export type ForecastResponse = {
  lat: number;
  lon: number;
  method: string;
  horizon_days: number[];
  temperature: {
    "t+1"?: {
      surface: { value: number | null; uncertainty_1sigma: number | null; unit: string };
      "500m": { value: number | null; uncertainty_1sigma: number | null; unit: string };
      observed_last: { surface: number | null; "500m": number | null };
    };
    "t+2"?: {
      surface: { value: number | null; uncertainty_1sigma: number | null; unit: string };
      "500m": { value: number | null; uncertainty_1sigma: number | null; unit: string };
    };
  };
  salinity: {
    "t+1"?: {
      surface: { value: number | null; uncertainty_1sigma: number | null; unit: string };
      "500m": { value: number | null; unit: string };
    };
    "t+2"?: {
      surface: { value: number | null; uncertainty_1sigma: number | null; unit: string };
      "500m": { value: number | null; unit: string };
    };
  };
  wind: {
    "t+1"?: {
      wind_speed: { value: number | null; uncertainty_1sigma: number | null; unit: string };
      wind_direction: { value: number | null; unit: string };
      u_component: number | null;
      v_component: number | null;
      domain: string;
      observed_last?: { wind_speed: number | null; u: number | null; v: number | null };
    };
  };
  disclaimer: string;
};

export type HistoricalResponse = {
  status: string;
  message?: string;
  dates: string[];
  surface_temp: (number | null)[];
  surface_sal: (number | null)[];
  temp_500m: (number | null)[];
  sal_500m: (number | null)[];
  temp_anomaly: (number | null)[];
  sal_anomaly: (number | null)[];
  provenance?: { source: string; temporal_range: string; qc: string };
};

export type SubsurfaceResponse = {
  status: string;
  thermocline_depth_m: number | null;
  max_temperature_gradient: number | null;
  halocline_depth_m: number | null;
  max_salinity_gradient: number | null;
  mixed_layer_depth_m: number | null;
  gradients: { depth_mid: number; dt_dz_c_per_100m: number; ds_dz_psu_per_100m: number | null }[];
  ts_diagram: { depth: number; temperature: number; salinity: number; potential_density: number }[];
  provenance?: { source: string; qc: string };
};

export const locations: Location[] = [
  {
    id: "atlantic",
    name: "Central Indian Ocean",
    region: "Equatorial Indian Ocean",
    x: 48,
    y: 45,
    code: "IO-042",
    lat: 8.5,
    lon: 74.2,
  },
  {
    id: "pacific",
    name: "Arabian Sea",
    region: "Western Indian Ocean",
    x: 35,
    y: 34,
    code: "AS-118",
    lat: 17.4,
    lon: 63.8,
  },
  {
    id: "southern",
    name: "Bay of Bengal",
    region: "Eastern Indian Ocean",
    x: 70,
    y: 40,
    code: "BB-071",
    lat: 15.2,
    lon: 89.1,
  },
];

const API_URL = process.env.NEXT_PUBLIC_API_URL || "";

interface OceanContextType {
  selected: Location;
  setSelected: (loc: Location) => void;
  depth: number;
  setDepth: (d: number) => void;
  mode: "2D" | "3D";
  setMode: (m: "2D" | "3D") => void;
  metric: "temperature" | "salinity" | "wind";
  setMetric: (m: "temperature" | "salinity" | "wind") => void;
  demoRunning: boolean;
  runPipelineDemo: () => void;
  mobileOpen: boolean;
  setMobileOpen: (open: boolean) => void;
  oceanData: OceanData | null;
  dataLoading: boolean;
  validationMetrics: ValidationMetrics | null;
  todayDate: string;
  tomorrowDate: string;
  selectedDate: string;
  setSelectedDate: (d: string) => void;
  todayDateFormatted: string;
  selectedDateFormatted: string;
  resetToToday: () => void;
  argoProfiles: ArgoProfile[];
  argoDetail: ArgoDetail | null;
  setArgoDetail: (detail: ArgoDetail | null) => void;
  argoDateFrom: string;
  setArgoDateFrom: (d: string) => void;
  argoDateTo: string;
  setArgoDateTo: (d: string) => void;
  argoParameter: string;
  setArgoParameter: (p: string) => void;
  forecastData: ForecastResponse | null;
  historicalData: HistoricalResponse | null;
  subsurfaceData: SubsurfaceResponse | null;
  dataQualityData: any;
  provenanceModalOpen: boolean;
  setProvenanceModalOpen: (open: boolean) => void;
  provenanceSourceKey: string;
  provenanceContextPoint: any;
  handleOpenProvenance: (sourceKey: string, contextPoint?: any) => void;
  handleArgoSelect: (profile: ArgoProfile) => void;
  handleMapClick: (lat: number, lon: number) => void;
  exportArgo: () => void;
  formatValue: (value: number | null | undefined, decimals?: number) => string;
  getTempAtDepth: (targetDepth: number) => number | null | undefined;
  getSalAtDepth: (targetDepth: number) => number | null | undefined;
  depthText: string;
  isNoData: boolean;
  switchMarineStation: () => void;
}

function getLocalDateString(d: Date = new Date()): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatDisplayDate(dateStr: string): string {
  if (!dateStr || !dateStr.includes("-")) return dateStr;
  const parts = dateStr.slice(0, 10).split("-");
  if (parts.length === 3) {
    const [year, month, day] = parts;
    return `${day}-${month}-${year}`;
  }
  return dateStr;
}

function getTomorrowDateString(d: Date = new Date()): string {
  const tomorrow = new Date(d.getTime() + 24 * 60 * 60 * 1000);
  return getLocalDateString(tomorrow);
}

const OceanContext = createContext<OceanContextType | undefined>(undefined);

export function OceanDataProvider({ children }: { children: React.ReactNode }) {
  const [selected, setSelected] = useState<Location>(locations[0]);
  const [depth, setDepth] = useState<number>(500);
  const [mode, setMode] = useState<"2D" | "3D">("2D");
  const [metric, setMetricState] = useState<"temperature" | "salinity" | "wind">("temperature");
  const [demoRunning, setDemoRunning] = useState<boolean>(false);
  const [mobileOpen, setMobileOpen] = useState<boolean>(false);

  // Dynamic Date state - dynamically based on user's current local date
  const [todayDate] = useState<string>(() => getLocalDateString());
  const [tomorrowDate] = useState<string>(() => getTomorrowDateString());
  const [selectedDate, setSelectedDate] = useState<string>(() => getLocalDateString());

  const todayDateFormatted = useMemo(() => formatDisplayDate(todayDate), [todayDate]);
  const selectedDateFormatted = useMemo(() => formatDisplayDate(selectedDate), [selectedDate]);

  const resetToToday = () => {
    setSelectedDate(getLocalDateString());
  };

  const argoDateFrom = selectedDate;
  const setArgoDateFrom = (d: string) => setSelectedDate(d);
  const argoDateTo = selectedDate;
  const setArgoDateTo = (d: string) => setSelectedDate(d);

  // Core Ocean Observation & DL Reconstruction Data
  const [oceanData, setOceanData] = useState<OceanData | null>(null);
  const [dataLoading, setDataLoading] = useState<boolean>(false);
  const [validationMetrics, setValidationMetrics] = useState<ValidationMetrics | null>(null);

  // In-situ Argo Profiles
  const [argoProfiles, setArgoProfiles] = useState<ArgoProfile[]>([]);
  const [argoDetail, setArgoDetail] = useState<ArgoDetail | null>(null);
  const [argoParameter, setArgoParameter] = useState("temperature");

  const setMetric = (m: "temperature" | "salinity" | "wind") => {
    setMetricState(m);
    setArgoParameter(m === "wind" ? "wind" : m);
  };

  // Advanced Analysis & Prediction Data
  const [forecastData, setForecastData] = useState<ForecastResponse | null>(null);
  const [historicalData, setHistoricalData] = useState<HistoricalResponse | null>(null);
  const [subsurfaceData, setSubsurfaceData] = useState<SubsurfaceResponse | null>(null);
  const [dataQualityData, setDataQualityData] = useState<any>(null);

  // Provenance Modal State
  const [provenanceModalOpen, setProvenanceModalOpen] = useState(false);
  const [provenanceSourceKey, setProvenanceSourceKey] = useState("argo");
  const [provenanceContextPoint, setProvenanceContextPoint] = useState<any>(null);

  const handleOpenProvenance = (sourceKey: string, contextPoint?: any) => {
    setProvenanceSourceKey(sourceKey);
    setProvenanceContextPoint(contextPoint || null);
    setProvenanceModalOpen(true);
  };

  const depthText = useMemo(() => `${depth} m`, [depth]);

  // Fetch observation and AI inference for active coordinate
  useEffect(() => {
    const lat = selected.lat ?? 8.5;
    const lon = selected.lon ?? 74.2;

    setDataLoading(true);

    if (API_URL) {
      fetch(`${API_URL}/predict?lat=${lat}&lon=${lon}`)
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => setOceanData(data || getPrediction(lat, lon)))
        .catch(() => setOceanData(getPrediction(lat, lon)))
        .finally(() => setDataLoading(false));

      fetch(`${API_URL}/api/forecast/2day?lat=${lat}&lon=${lon}`)
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => setForecastData(data || getForecast(lat, lon)))
        .catch(() => setForecastData(getForecast(lat, lon)));

      fetch(`${API_URL}/api/historical?lat=${lat}&lon=${lon}`)
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => setHistoricalData(data || getHistorical(lat, lon)))
        .catch(() => setHistoricalData(getHistorical(lat, lon)));

      fetch(`${API_URL}/api/analysis/subsurface?lat=${lat}&lon=${lon}`)
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => setSubsurfaceData(data || getSubsurface(lat, lon)))
        .catch(() => setSubsurfaceData(getSubsurface(lat, lon)));
    } else {
      setOceanData(getPrediction(lat, lon));
      setForecastData(getForecast(lat, lon));
      setHistoricalData(getHistorical(lat, lon));
      setSubsurfaceData(getSubsurface(lat, lon));
      setDataLoading(false);
    }
  }, [selected]);

  // Fetch benchmark validation & data quality
  useEffect(() => {
    if (API_URL) {
      fetch(`${API_URL}/validation`)
        .then((res) => res.json())
        .then((data) => setValidationMetrics(data?.metrics || (getValidation() as any)?.metrics))
        .catch(() => setValidationMetrics((getValidation() as any)?.metrics));

      fetch(`${API_URL}/api/data-quality`)
        .then((res) => res.json())
        .then((data) => {
          if (data?.status === "success") setDataQualityData(data.datasets);
          else setDataQualityData((getDataQuality() as any)?.datasets);
        })
        .catch(() => setDataQualityData((getDataQuality() as any)?.datasets));
    } else {
      setValidationMetrics((getValidation() as any)?.metrics);
      setDataQualityData((getDataQuality() as any)?.datasets);
    }
  }, []);

  // Load In-situ Argo Float list strictly synchronized with Date + Parameter + Depth
  useEffect(() => {
    if (metric === "wind") {
      // Argo floats do not measure wind
      setArgoProfiles([]);
      return;
    }

    if (API_URL) {
      const query = new URLSearchParams({
        date: selectedDate,
        parameter: metric,
        depth: String(depth),
        limit: "2500",
      });
      fetch(`${API_URL}/argo/profiles?${query}`)
        .then((res) => res.json())
        .then((data) => {
          const profs =
            data?.profiles && data.profiles.length
              ? data.profiles
              : getArgoProfiles(selectedDate, metric, depth);
          setArgoProfiles(profs);
        })
        .catch(() => setArgoProfiles(getArgoProfiles(selectedDate, metric, depth)));
    } else {
      setArgoProfiles(getArgoProfiles(selectedDate, metric, depth));
    }
  }, [selectedDate, metric, depth]);

  // Load full in-situ Argo CTD profile when float marker clicked
  const handleArgoSelect = (profile: ArgoProfile) => {
    if (API_URL) {
      fetch(`${API_URL}/argo/profile/${profile.platform}/${profile.cycle}`)
        .then((res) => res.json())
        .then((data) => {
          if (data && !data.error) setArgoDetail(data);
          else setArgoDetail(getArgoSingleProfile(profile.platform, profile.cycle) as any);
        })
        .catch(() => setArgoDetail(getArgoSingleProfile(profile.platform, profile.cycle) as any));
    } else {
      setArgoDetail(getArgoSingleProfile(profile.platform, profile.cycle) as any);
    }
  };

  const exportArgo = () => {
    if (API_URL) {
      const query = new URLSearchParams({
        date: selectedDate,
        parameter: metric,
      });
      window.open(`${API_URL}/argo/export?${query}`, "_blank");
    } else {
      const profiles = getArgoProfiles(selectedDate, metric, depth, 5000);
      if (!profiles.length) return;
      const keys = Object.keys(profiles[0]);
      const csv = [
        keys.join(","),
        ...profiles.map((p: any) => keys.map((k) => JSON.stringify(p[k] ?? "")).join(",")),
      ].join("\n");
      const blob = new Blob([csv], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `argo_${selectedDate}_${metric}_${depth}m.csv`;
      a.click();
      URL.revokeObjectURL(url);
    }
  };

  const handleMapClick = (lat: number, lon: number) => {
    setArgoDetail(null);
    setSelected({
      id: `clicked-${lat.toFixed(3)}-${lon.toFixed(3)}`,
      name: "Custom ocean query",
      region: "User map selection",
      x: 50,
      y: 50,
      code: `${lat.toFixed(2)}°N, ${lon.toFixed(2)}°E`,
      lat,
      lon,
    });
  };

  const formatValue = (value: number | null | undefined, decimals = 2) =>
    value == null || !Number.isFinite(value) ? "—" : value.toFixed(decimals);

  const getTempAtDepth = (targetDepth: number) => {
    const prof = oceanData?.model_profile?.length
      ? oceanData.model_profile
      : oceanData?.temperature_profile ?? [];
    if (!prof.length) return targetDepth === 0 ? oceanData?.surface_temp : oceanData?.subsurface_temp;
    let closest = prof[0];
    let minDiff = Math.abs(closest.depth - targetDepth);
    for (const pt of prof) {
      const diff = Math.abs(pt.depth - targetDepth);
      if (diff < minDiff) {
        minDiff = diff;
        closest = pt;
      }
    }
    return closest ? closest.temperature : null;
  };

  const getSalAtDepth = (targetDepth: number) => {
    const prof = oceanData?.observed_salinity_profile?.length
      ? oceanData.observed_salinity_profile
      : oceanData?.salinity_profile ?? [];
    if (!prof.length) return oceanData?.salinity;
    let closest = prof[0];
    let minDiff = Math.abs(closest.depth - targetDepth);
    for (const pt of prof) {
      const diff = Math.abs(pt.depth - targetDepth);
      if (diff < minDiff) {
        minDiff = diff;
        closest = pt;
      }
    }
    return closest ? closest.salinity : oceanData?.salinity;
  };

  const runPipelineDemo = () => {
    setDemoRunning(true);
    window.setTimeout(() => setDemoRunning(false), 2000);
  };

  const switchMarineStation = () => {
    setSelected(locations[(locations.indexOf(selected) + 1) % locations.length]);
  };

  const isNoData = oceanData?.status === "no_data";

  return (
    <OceanContext.Provider
      value={{
        selected,
        setSelected,
        depth,
        setDepth,
        mode,
        setMode,
        metric,
        setMetric,
        demoRunning,
        runPipelineDemo,
        mobileOpen,
        setMobileOpen,
        oceanData,
        dataLoading,
        validationMetrics,
        todayDate,
        tomorrowDate,
        selectedDate,
        setSelectedDate,
        todayDateFormatted,
        selectedDateFormatted,
        resetToToday,
        argoProfiles,
        argoDetail,
        setArgoDetail,
        argoDateFrom,
        setArgoDateFrom,
        argoDateTo,
        setArgoDateTo,
        argoParameter,
        setArgoParameter,
        forecastData,
        historicalData,
        subsurfaceData,
        dataQualityData,
        provenanceModalOpen,
        setProvenanceModalOpen,
        provenanceSourceKey,
        provenanceContextPoint,
        handleOpenProvenance,
        handleArgoSelect,
        handleMapClick,
        exportArgo,
        formatValue,
        getTempAtDepth,
        getSalAtDepth,
        depthText,
        isNoData,
        switchMarineStation,
      }}
    >
      {children}
    </OceanContext.Provider>
  );
}

export function useOceanData() {
  const context = useContext(OceanContext);
  if (!context) {
    throw new Error("useOceanData must be used within an OceanDataProvider");
  }
  return context;
}

"use client";

import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import {
  getPrediction,
  getForecast,
  getHistorical,
  getSubsurface,
  getValidation,
  getDataQuality,
  getDateCoverage,
  getPrimaryStations,
  getAllStations,
  getHistoricalSeries,
  getStationObservation,
  DateCoverage,
  MarineStation,
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
  is_primary?: boolean;
};

export type ProfilePoint = { depth: number; temperature: number; salinity?: number };
export type UncertaintyPoint = { depth: number; lower: number; upper: number };

export type ValidationMetrics = {
  best_validation_mae_c: number;
  best_validation_rmse_c: number;
  validation_r2?: number;
  validation_bias?: number;
  validation_samples: number;
  validation_platforms: number;
  dataset_lineage?: string;
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
  wind_to_dir?: number | null;
  sea_level: number | null;
  current_speed: number | null;
  current_direction: number | null;
  mld: number | null;
  provenance?: {
    source: string;
    observation_date?: string;
    model?: string;
    qc_status?: string;
    classification?: string;
  };
};

export type ForecastResponse = {
  lat: number;
  lon: number;
  classification: string;
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
      observed_last: { surface: number | null; "500m": number | null };
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
  observed_surface_temp?: number | null;
  observed_surface_sal?: number | null;
  observed_depth_m?: number;
  gradients: { depth_mid: number; dt_dz_c_per_100m: number; ds_dz_psu_per_100m: number | null }[];
  ts_diagram: { depth: number; temperature: number; salinity: number; potential_density: number }[];
  provenance?: { source: string; qc: string };
};

// Available authentic marine stations
export const locations: Location[] = getPrimaryStations().map((s) => ({
  id: s.id,
  name: s.name,
  region: s.region,
  code: s.code,
  lat: s.lat,
  lon: s.lon,
  x: s.x ?? 50,
  y: s.y ?? 50,
  is_primary: s.is_primary,
}));

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
  coverage: DateCoverage;
  minDate: string;
  maxDate: string;
  todayDate: string;
  tomorrowDate: string;
  selectedDate: string;
  setSelectedDate: (d: string) => void;
  todayDateFormatted: string;
  selectedDateFormatted: string;
  resetToToday: () => void;
  argoProfiles: any[];
  argoDetail: any | null;
  setArgoDetail: (detail: any | null) => void;
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
  handleArgoSelect: (profile: any) => void;
  handleMapClick: (lat: number, lon: number) => void;
  exportArgo: () => void;
  formatValue: (value: number | null | undefined, decimals?: number) => string;
  getTempAtDepth: (targetDepth: number) => number | null | undefined;
  getSalAtDepth: (targetDepth: number) => number | null | undefined;
  depthText: string;
  isNoData: boolean;
  isFutureDate: boolean;
  isPastDate: boolean;
  dateAlertMessage: string | null;
  switchMarineStation: () => void;
}

function formatDisplayDate(dateStr: string): string {
  if (!dateStr || !dateStr.includes("-")) return dateStr;
  const parts = dateStr.slice(0, 10).split("-");
  if (parts.length === 3) {
    const [year, month, day] = parts;
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const mIdx = parseInt(month, 10) - 1;
    return `${day} ${months[mIdx] || month} ${year}`;
  }
  return dateStr;
}

const OceanContext = createContext<OceanContextType | undefined>(undefined);

export function OceanDataProvider({ children }: { children: React.ReactNode }) {
  const coverage = useMemo(() => getDateCoverage(), []);
  const minDate = coverage.minDate; // 2024-06-23
  const maxDate = coverage.maxDate; // 2026-09-10

  const [selected, setSelected] = useState<Location>(locations[0]);
  const [depth, setDepth] = useState<number>(0);
  const [mode, setMode] = useState<"2D" | "3D">("2D");
  const [metric, setMetricState] = useState<"temperature" | "salinity" | "wind">("temperature");
  const [demoRunning, setDemoRunning] = useState<boolean>(false);
  const [mobileOpen, setMobileOpen] = useState<boolean>(false);

  // Selected observation date: default to latest complete observation date (2026-06-23)
  const defaultDate = "2026-06-23";
  const [selectedDate, setSelectedDate] = useState<string>(defaultDate);

  const todayDate = maxDate;
  const tomorrowDate = "2026-09-11";

  const todayDateFormatted = useMemo(() => formatDisplayDate(todayDate), [todayDate]);
  const selectedDateFormatted = useMemo(() => formatDisplayDate(selectedDate), [selectedDate]);

  const resetToToday = () => {
    setSelectedDate(maxDate);
  };

  // Date boundary checks
  const isFutureDate = selectedDate > maxDate;
  const isPastDate = selectedDate < minDate;

  const dateAlertMessage = useMemo(() => {
    if (isFutureDate) {
      return `No observations available for ${formatDisplayDate(selectedDate)}. Latest available observation: ${formatDisplayDate(maxDate)}.`;
    }
    if (isPastDate) {
      return `No observations available for ${formatDisplayDate(selectedDate)}. Earliest available observation: ${formatDisplayDate(minDate)}.`;
    }
    // Check per-variable availability
    if (metric === "salinity" && selectedDate > coverage.variableAvailability.salinity.last_date) {
      return `Salinity observations conclude on ${formatDisplayDate(coverage.variableAvailability.salinity.last_date)}. Showing no salinity reading for ${formatDisplayDate(selectedDate)}.`;
    }
    if (metric === "wind" && selectedDate > coverage.variableAvailability.wind.last_date) {
      return `Satellite wind observations conclude on ${formatDisplayDate(coverage.variableAvailability.wind.last_date)}. Showing no wind reading for ${formatDisplayDate(selectedDate)}.`;
    }
    if (metric === "temperature" && selectedDate < coverage.variableAvailability.temperature.first_date) {
      return `Temperature observations begin on ${formatDisplayDate(coverage.variableAvailability.temperature.first_date)}. Showing no temperature reading for ${formatDisplayDate(selectedDate)}.`;
    }
    return null;
  }, [selectedDate, isFutureDate, isPastDate, maxDate, minDate, metric, coverage]);

  const argoDateFrom = selectedDate;
  const setArgoDateFrom = (d: string) => setSelectedDate(d);
  const argoDateTo = selectedDate;
  const setArgoDateTo = (d: string) => setSelectedDate(d);

  // Core Ocean Observation Data
  const [oceanData, setOceanData] = useState<OceanData | null>(null);
  const [dataLoading, setDataLoading] = useState<boolean>(false);
  const [validationMetrics, setValidationMetrics] = useState<ValidationMetrics | null>(null);

  // In-situ Argo Profiles
  const [argoProfiles, setArgoProfiles] = useState<any[]>([]);
  const [argoDetail, setArgoDetail] = useState<any | null>(null);
  const [argoParameter, setArgoParameter] = useState("temperature");

  const setMetric = (m: "temperature" | "salinity" | "wind") => {
    setMetricState(m);
    setArgoParameter(m === "wind" ? "wind" : m);
  };

  // Prediction & Historical Data
  const [forecastData, setForecastData] = useState<ForecastResponse | null>(null);
  const [historicalData, setHistoricalData] = useState<HistoricalResponse | null>(null);
  const [subsurfaceData, setSubsurfaceData] = useState<SubsurfaceResponse | null>(null);
  const [dataQualityData, setDataQualityData] = useState<any>(null);

  // Provenance Modal State
  const [provenanceModalOpen, setProvenanceModalOpen] = useState(false);
  const [provenanceSourceKey, setProvenanceSourceKey] = useState("glorys");
  const [provenanceContextPoint, setProvenanceContextPoint] = useState<any>(null);

  const handleOpenProvenance = (sourceKey: string, contextPoint?: any) => {
    setProvenanceSourceKey(sourceKey);
    setProvenanceContextPoint(contextPoint || null);
    setProvenanceModalOpen(true);
  };

  const depthText = useMemo(() => (depth === 0 ? "Surface (0.49 m)" : `${depth} m`), [depth]);

  // Synchronize observation state whenever selected coordinate OR selected date changes
  useEffect(() => {
    const lat = selected.lat ?? 8.5;
    const lon = selected.lon ?? 74.2;

    setDataLoading(true);

    if (isFutureDate || isPastDate) {
      setOceanData({
        status: "no_data",
        coordinates: { lat, lon },
        nearest_grid: { lat, lon },
        surface_temp: null,
        subsurface_temp: null,
        bottom_temp: null,
        salinity: null,
        wind_speed: null,
        sea_level: null,
        current_speed: null,
        current_direction: null,
        mld: null,
        temperature_profile: [],
        model_profile: [],
        reference_profile: [],
        provenance: {
          source: "CMEMS Real Ocean Dataset Boundary",
          observation_date: selectedDate,
          qc_status: "Outside dataset coverage",
        },
      });
      setHistoricalData(null);
      setSubsurfaceData(null);
      setDataLoading(false);
      return;
    }

    const pred = getPrediction(lat, lon, selectedDate);
    const hist = getHistorical(lat, lon, selectedDate);
    const sub = getSubsurface(lat, lon, selectedDate);
    const fc = getForecast(lat, lon);

    setOceanData(pred as any);
    setHistoricalData(hist as any);
    setSubsurfaceData(sub as any);
    setForecastData(fc as any);
    setDataLoading(false);
  }, [selected, selectedDate, isFutureDate, isPastDate]);

  // Load benchmark validation & quality data
  useEffect(() => {
    setValidationMetrics((getValidation() as any)?.metrics);
    setDataQualityData((getDataQuality() as any)?.summary);
  }, []);

  const handleArgoSelect = (profile: any) => {
    setArgoDetail(null);
  };

  const exportArgo = () => {
    // Export real observation time series for the active station
    if (!historicalData || !historicalData.dates) return;
    const csvRows = ["Date,Surface_Temp_C,Surface_Sal_PSU,Temp_Anomaly_C,Sal_Anomaly_PSU"];
    historicalData.dates.forEach((d, i) => {
      csvRows.push(
        `${d},${historicalData.surface_temp[i] ?? ""},${historicalData.surface_sal[i] ?? ""},${historicalData.temp_anomaly?.[i] ?? ""},${historicalData.sal_anomaly?.[i] ?? ""}`
      );
    });
    const blob = new Blob([csvRows.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `ocean_embed_${selected.id}_${selectedDate}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleMapClick = (lat: number, lon: number) => {
    setSelected({
      id: `clicked-${lat.toFixed(2)}-${lon.toFixed(2)}`,
      name: `Marine Station (${lat.toFixed(2)}°N, ${lon.toFixed(2)}°E)`,
      region: "Custom Map Coordinate",
      x: 50,
      y: 50,
      code: `${lat.toFixed(2)}°, ${lon.toFixed(2)}°`,
      lat,
      lon,
    });
  };

  const formatValue = (value: number | null | undefined, decimals = 2) =>
    value == null || !Number.isFinite(value) ? "—" : value.toFixed(decimals);

  const getTempAtDepth = (targetDepth: number) => {
    if (targetDepth <= 1) return oceanData?.surface_temp;
    return null; // Subsurface depth unobserved in surface dataset
  };

  const getSalAtDepth = (targetDepth: number) => {
    if (targetDepth <= 1) return oceanData?.salinity;
    return null; // Subsurface depth unobserved in surface dataset
  };

  const runPipelineDemo = () => {
    setDemoRunning(true);
    window.setTimeout(() => setDemoRunning(false), 1500);
  };

  const switchMarineStation = () => {
    setSelected(locations[(locations.indexOf(selected) + 1) % locations.length]);
  };

  const isNoData = oceanData?.status === "no_data" || isFutureDate || isPastDate;

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
        coverage,
        minDate,
        maxDate,
        todayDate,
        tomorrowDate,
        selectedDate,
        setSelectedDate,
        todayDateFormatted,
        selectedDateFormatted,
        resetToToday,
        argoProfiles: [],
        argoDetail: null,
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
        isFutureDate,
        isPastDate,
        dateAlertMessage,
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

"""OceanEmbed FastAPI backend — serves ports 8002 AND 8003.

Matches the exact JSON shapes expected by the existing Next.js UI:
  - page.tsx fetches from http://127.0.0.1:8003
  - ocean-map.tsx fetches from http://127.0.0.1:8002

Usage:
    py -3 backend/api/main.py
    # or
    py -3 -m uvicorn backend.api.main:app --host 127.0.0.1 --port 8003 --reload
"""
from __future__ import annotations

import json
import logging
import threading
import csv
import io
from pathlib import Path
from typing import Optional

import sys
sys.path.insert(0, str(Path(__file__).parent.parent.parent))

import uvicorn
from fastapi import FastAPI, Query, Response
from fastapi.middleware.cors import CORSMiddleware

from backend.config import (
    ARGO_INDEX_JSON, ARGO_QC_PARQUET, METRICS_DIR, MODELS_DIR,
    LAT_MIN, LAT_MAX, LON_MIN, LON_MAX,
)
from backend.inference import get_engine
from backend.evaluation import run_validation as _run_validation
from backend.forecast import get_forecast as _get_forecast

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
log = logging.getLogger(__name__)

app = FastAPI(title="OceanEmbed API", version="2.0.0", description="Project 26066 — Ocean AI System")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Startup ───────────────────────────────────────────────────────────────────

@app.on_event("startup")
async def startup():
    log.info("Loading inference engine...")
    engine = get_engine()
    log.info(f"Model loaded: {engine.model is not None}")
    log.info("OceanEmbed API ready.")


# ── Core prediction — used by existing UI (page.tsx + ocean-map.tsx) ─────────

@app.get("/predict")
async def predict(lat: float = Query(...), lon: float = Query(...)):
    """
    Returns temperature profile + surface observations for (lat, lon).
    JSON shape matches what the existing UI expects.
    """
    lat = float(max(LAT_MIN - 5, min(LAT_MAX + 5, lat)))
    lon = float(max(LON_MIN - 5, min(LON_MAX + 5, lon)))
    engine = get_engine()
    return engine.predict(lat, lon)


# ── Validation — used by existing UI (page.tsx) ───────────────────────────────

_validation_cache: dict | None = None

@app.get("/validation")
async def validation():
    """Returns MAE, RMSE, and profile counts. Cached after first call."""
    global _validation_cache
    if _validation_cache is not None:
        return _validation_cache

    # Try loading from pre-computed JSON
    metrics_path = METRICS_DIR / "validation_report.json"
    legacy_path  = Path("model_outputs") / "training_metrics.json"

    if metrics_path.exists():
        with open(metrics_path) as f:
            report = json.load(f)
        overall = report.get("overall", {})
        _validation_cache = {
            "metrics": {
                "best_validation_mae_c":  overall.get("mae"),
                "best_validation_rmse_c": overall.get("rmse"),
                "validation_r2":          overall.get("r2"),
                "validation_bias":        overall.get("bias"),
                "validation_samples":     overall.get("n"),
                "validation_platforms":   overall.get("profiles_evaluated"),
            },
            "by_depth": report.get("by_depth_stratum", {}),
            "source": "validation_report.json",
        }
        return _validation_cache

    if legacy_path.exists():
        with open(legacy_path) as f:
            m = json.load(f)
        _validation_cache = {
            "metrics": {
                "best_validation_mae_c":  m.get("best_validation_mae_c"),
                "best_validation_rmse_c": m.get("best_validation_rmse_c"),
                "validation_samples":     m.get("validation_samples"),
                "validation_platforms":   m.get("validation_platforms"),
            },
            "source": "training_metrics.json",
        }
        return _validation_cache

    return {"metrics": None, "error": "No validation data available yet"}


# ── ARGO profiles — used by existing UI ───────────────────────────────────────

@app.get("/argo/profiles")
async def argo_profiles(
    date_from: str  = Query("2024-01-01"),
    date_to:   str  = Query("2024-01-31"),
    parameter: str  = Query("temperature"),
    limit:     int  = Query(2500),
):
    """Returns ARGO profile list matching the exact shape the map component expects."""
    profiles = _load_argo_index(date_from, date_to, parameter, limit)
    return {"profiles": profiles, "count": len(profiles)}


@app.get("/argo/export")
async def argo_export(
    date_from: str  = Query("2024-01-01"),
    date_to:   str  = Query("2024-01-31"),
    parameter: str  = Query("temperature"),
):
    """CSV export of ARGO profiles."""
    profiles = _load_argo_index(date_from, date_to, parameter, limit=50000)
    buf = io.StringIO()
    if profiles:
        writer = csv.DictWriter(buf, fieldnames=list(profiles[0].keys()))
        writer.writeheader()
        writer.writerows(profiles)
    return Response(
        content=buf.getvalue(),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename=argo_{date_from}_{date_to}.csv"},
    )


def _load_argo_index(date_from: str, date_to: str, parameter: str, limit: int) -> list[dict]:
    """Load ARGO profiles from index JSON, filtered by date range and parameter."""
    date_from = date_from.default if hasattr(date_from, "default") else str(date_from)
    date_to   = date_to.default if hasattr(date_to, "default") else str(date_to)
    parameter = parameter.default if hasattr(parameter, "default") else str(parameter)
    limit     = limit.default if hasattr(limit, "default") else int(limit)

    if not ARGO_INDEX_JSON.exists():
        # Try to build it on-the-fly from parquet
        if ARGO_QC_PARQUET.exists():
            _rebuild_argo_index()
        else:
            return []

    try:
        with open(ARGO_INDEX_JSON) as f:
            data = json.load(f)
        profiles = data.get("profiles", [])
    except Exception:
        return []

    # Filter by date
    result = []
    for p in profiles:
        if not p.get("date"):
            continue
        d = p["date"][:10]  # YYYY-MM-DD
        if date_from <= d <= date_to:
            # Filter by parameter
            if parameter == "temperature" and p.get("surf_temp") is None:
                continue
            if parameter == "salinity" and p.get("surf_psal") is None:
                continue
            result.append({
                "id":        p["id"],
                "platform":  p["platform"],
                "cycle":     p["cycle"],
                "date":      p["date"][:10],
                "lat":       p["lat"],
                "lon":       p["lon"],
                "max_depth": p.get("max_depth"),
                "quality":   p.get("quality", "QC-passed"),
            })
            if len(result) >= limit:
                break

    return result


@app.get("/argo/profile/{platform}/{cycle}")
async def argo_single_profile(platform: str, cycle: int):
    """Retrieve full in-situ CTD profile for a specific ARGO platform and cycle."""
    if not ARGO_QC_PARQUET.exists():
        return {"error": "ARGO dataset not indexed"}
    try:
        import pandas as pd
        df = pd.read_parquet(ARGO_QC_PARQUET)
        match = df[(df["platform"] == platform) & (df["cycle"] == cycle)]
        if match.empty:
            return {"error": f"Profile {platform}-{cycle} not found in QC dataset"}
        row = match.iloc[0]
        pres = list(row.get("pres", []))
        temp = list(row.get("temp", []))
        psal = list(row.get("psal", []))

        pts = []
        for i in range(len(pres)):
            p_val = round(float(pres[i]), 1) if i < len(pres) and pres[i] is not None else None
            t_val = round(float(temp[i]), 3) if i < len(temp) and temp[i] is not None else None
            s_val = round(float(psal[i]), 3) if i < len(psal) and psal[i] is not None else None
            if p_val is not None:
                pts.append({"depth": p_val, "temperature": t_val, "salinity": s_val})

        return {
            "id": f"{platform}-{cycle}",
            "platform": str(platform),
            "cycle": int(cycle),
            "date": str(row["date"])[:10] if pd.notna(row["date"]) else None,
            "lat": round(float(row["lat"]), 4),
            "lon": round(float(row["lon"]), 4),
            "max_depth": round(float(row["max_depth"]), 1) if pd.notna(row.get("max_depth")) else None,
            "quality": "QC-passed (in-situ real observations)",
            "source": row.get("source_file", "Global Argo GDAC"),
            "data_type": "OBSERVED",
            "profile": pts,
        }
    except Exception as e:
        log.error(f"Error fetching ARGO profile {platform}-{cycle}: {e}")
        return {"error": str(e)}


@app.get("/api/historical")
async def historical_timeseries(lat: float = Query(...), lon: float = Query(...)):
    """Return real daily observation time series from GLORYS 7-day reanalysis."""
    import xarray as xr
    import numpy as np
    from backend.config import GLORYS_7DAY

    try:
        ds = xr.open_dataset(GLORYS_7DAY, decode_times=False)
        lats = ds["latitude"].values
        lons = ds["longitude"].values
        depths = ds["depth"].values

        i_lat = int(np.argmin(np.abs(lats - lat)))
        i_lon = int(np.argmin(np.abs(lons - lon)))

        # Check if land
        sst_raw = ds["thetao"].isel(depth=0, latitude=i_lat, longitude=i_lon).values.astype(float)
        if not np.any(np.isfinite(sst_raw)):
            ds.close()
            return {
                "status": "no_data",
                "message": "Selected coordinate is on land or outside GLORYS domain.",
                "dates": [], "surface_temp": [], "surface_sal": [], "temp_anomaly": [], "sal_anomaly": [],
            }

        sss_raw = ds["so"].isel(depth=0, latitude=i_lat, longitude=i_lon).values.astype(float)
        idx_500 = int(np.argmin(np.abs(depths - 500)))
        t500_raw = ds["thetao"].isel(depth=idx_500, latitude=i_lat, longitude=i_lon).values.astype(float)
        s500_raw = ds["so"].isel(depth=idx_500, latitude=i_lat, longitude=i_lon).values.astype(float)
        ds.close()

        # Jan 1 to Jan 7, 2024
        dates = [f"2024-01-0{i+1}" for i in range(len(sst_raw))]
        sst_clean = [round(float(v), 3) if np.isfinite(v) else None for v in sst_raw]
        sss_clean = [round(float(v), 3) if np.isfinite(v) else None for v in sss_raw]
        t500_clean = [round(float(v), 3) if np.isfinite(v) else None for v in t500_raw]
        s500_clean = [round(float(v), 3) if np.isfinite(v) else None for v in s500_raw]

        # Calculate anomalies relative to 7-day mean
        mean_sst = np.nanmean(sst_raw)
        mean_sss = np.nanmean(sss_raw)
        t_anom = [round(float(v - mean_sst), 3) if np.isfinite(v) else None for v in sst_raw]
        s_anom = [round(float(v - mean_sss), 3) if np.isfinite(v) else None for v in sss_raw]

        return {
            "status": "success",
            "lat": lat, "lon": lon,
            "nearest_grid": {"lat": round(float(lats[i_lat]), 4), "lon": round(float(lons[i_lon]), 4)},
            "dates": dates,
            "surface_temp": sst_clean,
            "surface_sal": sss_clean,
            "temp_500m": t500_clean,
            "sal_500m": s500_clean,
            "temp_anomaly": t_anom,
            "sal_anomaly": s_anom,
            "provenance": {
                "source": "Copernicus Marine GLORYS12V1 Reanalysis",
                "temporal_range": "2024-01-01 to 2024-01-07 (Daily)",
                "qc": "Verified physical reanalysis",
            }
        }
    except Exception as e:
        log.error(f"Historical query error: {e}")
        return {"error": str(e)}


@app.get("/api/analysis/subsurface")
async def subsurface_analysis(lat: float = Query(...), lon: float = Query(...)):
    """Calculate vertical gradients (dT/dz, dS/dz), thermocline/halocline depth, and T-S scatter."""
    engine = get_engine()
    res = engine.predict(lat, lon)
    if res.get("status") == "no_data":
        return {"status": "no_data", "message": "No ocean data at this location"}

    prof_t = res.get("temperature_profile", [])
    prof_s = res.get("observed_salinity_profile") or res.get("salinity_profile", [])
    mld = res.get("mld")

    # Combine depths and compute vertical thermal/salinity gradients
    gradients = []
    ts_pairs = []
    thermocline_depth = None
    max_t_grad = 0.0
    halocline_depth = None
    max_s_grad = 0.0

    s_by_depth = {p["depth"]: p.get("salinity") for p in prof_s}

    for i in range(len(prof_t) - 1):
        p1 = prof_t[i]
        p2 = prof_t[i+1]
        z1, t1 = p1["depth"], p1["temperature"]
        z2, t2 = p2["depth"], p2["temperature"]
        dz = z2 - z1
        if dz > 0:
            # Thermal gradient in °C per 100m
            dt_dz = ((t2 - t1) / dz) * 100.0
            s1 = s_by_depth.get(z1)
            s2 = s_by_depth.get(z2)
            ds_dz = (((s2 - s1) / dz) * 100.0) if (s1 is not None and s2 is not None) else None

            # Detect thermocline (steepest negative temperature gradient)
            if abs(dt_dz) > max_t_grad and z1 >= 20.0 and z1 <= 300.0:
                max_t_grad = abs(dt_dz)
                thermocline_depth = round((z1 + z2) / 2.0, 1)

            # Detect halocline (steepest salinity gradient)
            if ds_dz is not None and abs(ds_dz) > max_s_grad and z1 >= 10.0 and z1 <= 300.0:
                max_s_grad = abs(ds_dz)
                halocline_depth = round((z1 + z2) / 2.0, 1)

            gradients.append({
                "depth_mid": round((z1 + z2) / 2.0, 1),
                "dt_dz_c_per_100m": round(dt_dz, 3),
                "ds_dz_psu_per_100m": round(ds_dz, 3) if ds_dz is not None else None,
            })

    for p in prof_t:
        d = p["depth"]
        s_val = s_by_depth.get(d)
        if s_val is not None:
            # UNESCO simplified potential density anomaly approx
            t = p["temperature"]
            sigma_theta = round(28.152 - 0.0735*t - 0.00469*(t**2) + (0.802 - 0.002*t)*(s_val - 35.0), 3)
            ts_pairs.append({
                "depth": d,
                "temperature": t,
                "salinity": s_val,
                "potential_density": sigma_theta,
            })

    return {
        "status": "success",
        "coordinates": {"lat": lat, "lon": lon},
        "thermocline_depth_m": thermocline_depth,
        "max_temperature_gradient": round(max_t_grad, 2),
        "halocline_depth_m": halocline_depth,
        "max_salinity_gradient": round(max_s_grad, 2) if max_s_grad > 0 else None,
        "mixed_layer_depth_m": mld,
        "gradients": gradients,
        "ts_diagram": ts_pairs,
        "provenance": {
            "source": "Copernicus GLORYS12V1 In-Situ Grid Analysis",
            "qc": "Thermodynamic state calculated from verified fields",
        }
    }


def _rebuild_argo_index():
    """Rebuild ARGO index from parquet if JSON is missing."""
    try:
        import pandas as pd
        from backend.config import INDEXES_DIR
        df = pd.read_parquet(ARGO_QC_PARQUET)
        INDEXES_DIR.mkdir(parents=True, exist_ok=True)
        records = []
        for _, row in df.iterrows():
            records.append({
                "id": f"{row['platform']}-{row['cycle']}",
                "platform": str(row["platform"]),
                "cycle": int(row["cycle"]),
                "date": row["date"].isoformat() if hasattr(row["date"], "isoformat") else str(row["date"]),
                "lat": round(float(row["lat"]), 4),
                "lon": round(float(row["lon"]), 4),
                "max_depth": round(float(row["max_depth"]), 1) if row["max_depth"] is not None else None,
                "surf_temp": round(float(row["surf_temp"]), 3) if row.get("surf_temp") is not None else None,
                "surf_psal": round(float(row["surf_psal"]), 3) if row.get("surf_psal") is not None else None,
                "n_levels": int(row["n_levels_valid"]),
                "quality": "QC-passed",
            })
        with open(ARGO_INDEX_JSON, "w") as f:
            json.dump({"profiles": records, "count": len(records)}, f)
    except Exception as e:
        log.error(f"Failed to rebuild ARGO index: {e}")


# ── Extended API endpoints (for future UI expansion) ──────────────────────────

@app.get("/api/reconstruction/temperature")
async def recon_temperature(lat: float = Query(...), lon: float = Query(...)):
    engine = get_engine()
    result = engine.predict(lat, lon)
    return {
        "lat": lat, "lon": lon,
        "observed_profile":      result.get("temperature_profile", []),
        "reconstructed_profile": result.get("model_profile", []),
        "uncertainty":           result.get("temp_uncertainty", []),
        "label_observed":        "GLORYS reanalysis",
        "label_reconstructed":   "OceanEmbed DL reconstruction",
    }


@app.get("/api/reconstruction/salinity")
async def recon_salinity(lat: float = Query(...), lon: float = Query(...)):
    engine = get_engine()
    result = engine.predict(lat, lon)
    return {
        "lat": lat, "lon": lon,
        "reconstructed_profile": result.get("salinity_profile", []),
        "uncertainty":           result.get("sal_uncertainty", []),
        "label_reconstructed":   "OceanEmbed DL reconstruction",
        "note": "Salinity reconstruction based on GLORYS surface salinity + DL model",
    }


@app.get("/api/reconstruction/validation")
async def recon_validation():
    global _validation_cache
    _validation_cache = None  # force refresh
    return await validation()


@app.get("/api/forecast/temperature")
async def forecast_temperature(lat: float = Query(...), lon: float = Query(...)):
    fc = _get_forecast(lat, lon)
    return {"lat": lat, "lon": lon, "temperature_forecast": fc["temperature"],
            "method": fc["method"], "disclaimer": fc["disclaimer"]}


@app.get("/api/forecast/salinity")
async def forecast_salinity(lat: float = Query(...), lon: float = Query(...)):
    fc = _get_forecast(lat, lon)
    return {"lat": lat, "lon": lon, "salinity_forecast": fc["salinity"],
            "method": fc["method"], "disclaimer": fc["disclaimer"]}


@app.get("/api/forecast/wind")
async def forecast_wind(lat: float = Query(...), lon: float = Query(...)):
    fc = _get_forecast(lat, lon)
    return {"lat": lat, "lon": lon, "wind_forecast": fc["wind"],
            "method": fc["method"],
            "disclaimer": "Surface wind only (10m). No subsurface wind in dataset."}


@app.get("/api/forecast/2day")
async def forecast_2day(lat: float = Query(...), lon: float = Query(...)):
    return _get_forecast(lat, lon)


@app.get("/api/model/metrics")
async def model_metrics():
    metrics_path = METRICS_DIR / "model_metrics.json"
    if metrics_path.exists():
        with open(metrics_path) as f:
            return json.load(f)
    legacy = Path("model_outputs") / "training_metrics.json"
    if legacy.exists():
        with open(legacy) as f:
            return json.load(f)
    return {"error": "No model metrics available"}


@app.get("/api/model/status")
async def model_status():
    engine = get_engine()
    return {
        "model_loaded": engine.model is not None,
        "model_type": type(engine.model).__name__ if engine.model else None,
        "input_features": engine.input_names,
        "n_depth_levels": len(engine.target_depths) if engine.target_depths is not None else None,
        "metrics": engine.metrics,
        "glorys_cache_loaded": engine._glorys_cache is not None,
    }


@app.get("/api/observations")
async def observations(
    lat_min: float = Query(LAT_MIN), lat_max: float = Query(LAT_MAX),
    lon_min: float = Query(LON_MIN), lon_max: float = Query(LON_MAX),
    date_from: str = Query("2024-01-01"), date_to: str = Query("2024-01-31"),
):
    lat_min = lat_min.default if hasattr(lat_min, "default") else float(lat_min)
    lat_max = lat_max.default if hasattr(lat_max, "default") else float(lat_max)
    lon_min = lon_min.default if hasattr(lon_min, "default") else float(lon_min)
    lon_max = lon_max.default if hasattr(lon_max, "default") else float(lon_max)

    argo = _load_argo_index(date_from, date_to, "all", 5000)
    filtered = [
        p for p in argo
        if lat_min <= p["lat"] <= lat_max and lon_min <= p["lon"] <= lon_max
    ]
    return {
        "argo_observations": filtered,
        "satellite_coverage": {
            "ostia_sst": {"available": True, "resolution": "0.05°", "temporal": "daily"},
            "ssh": {"available": True, "resolution": "0.25°", "temporal": "daily"},
            "sss": {"available": True, "resolution": "~0.25°", "temporal": "weekly"},
            "ccmp_winds": {"available": True, "resolution": "0.25°", "temporal": "6-hourly"},
            "oscar_currents": {"available": True, "resolution": "0.25°", "temporal": "daily"},
        },
    }


@app.post("/api/predict")
async def custom_predict(body: dict):
    """Custom inference with user-supplied surface features."""
    lat = float(body.get("lat", 15.0))
    lon = float(body.get("lon", 75.0))
    engine = get_engine()
    return engine.predict(
        lat=lat, lon=lon,
        surf_temp  = body.get("surface_temp"),
        surf_sal   = body.get("surface_salinity"),
        sla        = body.get("sla"),
        adt        = body.get("adt"),
        wind_speed = body.get("wind_speed"),
        mld        = body.get("mld"),
    )


@app.get("/api/provenance")
async def provenance(source_key: Optional[str] = Query(None)):
    """Return comprehensive scientific provenance for datasets, models, and observation streams."""
    registry = {
        "argo": {
            "name": "Global Argo In-Situ Ocean Profiling Network",
            "provider": "Global Argo Data Assembly Centre (GDAC) / INCOIS",
            "type": "OBSERVED (In-situ CTD)",
            "classification": "🟢 OBSERVED",
            "coverage_dates": "2024-01-01 to 2024-01-31",
            "spatial_domain": "Indian Ocean & Adjacent Basins (45°E-105°E, 5°N-30°N)",
            "depth_range": "0 to 2000 meters continuous",
            "parameters": ["Sea Water Pressure (PRES)", "In-situ Temperature (TEMP)", "Practical Salinity (PSAL)"],
            "qc_procedure": "Real-time & Delayed-mode automated quality control checks. QC Flags 1 (Good) and 2 (Probably Good) retained. Outliers and bad pressure points removed.",
            "source_files": "31 daily netCDF files (20240101_prof.nc through 20240131_prof.nc in 'data set/')",
            "doi": "10.17882/42182",
            "url": "https://argo.ucsd.edu",
        },
        "glorys": {
            "name": "Mercator Ocean GLORYS12V1 Global Physical Reanalysis",
            "provider": "Copernicus Marine Environment Monitoring Service (CMEMS)",
            "product_id": "GLOBAL_REANALYSIS_PHY_001_031",
            "type": "MODEL / REANALYSIS",
            "classification": "🔵 MODEL / REANALYSIS",
            "coverage_dates": "2024-01-01 to 2024-01-07 (Daily)",
            "spatial_resolution": "0.083° x 0.083° (~9 km resolution, Arakawa C-grid)",
            "depth_levels": "35 vertical levels from 0.49 m to 902.5 m",
            "parameters": ["Potential Temperature (thetao)", "Practical Salinity (so)", "Sea Surface Height (zos)", "Mixed Layer Depth (mlotst)"],
            "qc_procedure": "Assimilates satellite altimetry (Jason, Sentinel-3), OSTIA SST, and in-situ CTD profiles using SEEK filter with 3D-VAR bias correction.",
            "source_files": "ocean_data/GLORYS_7day_20240101_20240107.nc",
            "doi": "10.48670/moi-00021",
            "url": "https://marine.copernicus.eu",
        },
        "ostia": {
            "name": "Operational Sea Surface Temperature and Ice Analysis (OSTIA)",
            "provider": "UK Met Office / Copernicus Marine Service",
            "product_id": "SST_GLO_SST_L4_NRT_OBSERVATIONS_010_001",
            "type": "MODEL / REANALYSIS",
            "classification": "🔵 MODEL / REANALYSIS",
            "coverage_dates": "Daily continuous",
            "spatial_resolution": "0.05° x 0.05° (~5 km)",
            "parameters": ["Analyzed Sea Surface Temperature (analysed_sst)", "Analysis Error"],
            "qc_procedure": "Optimal interpolation combining infrared (AVHRR, SLSTR) and microwave (AMSR-2) radiometer retrievals with in-situ drifting buoys.",
            "source_files": "ocean_data/SST_20240101_20240107.nc",
            "url": "https://podaac.jpl.nasa.gov",
        },
        "ccmp": {
            "name": "Cross-Calibrated Multi-Platform (CCMP) Ocean Surface Winds",
            "provider": "Remote Sensing Systems (REMSS) / NASA Physical Oceanography DAAC",
            "type": "MODEL / REANALYSIS",
            "classification": "🔵 MODEL / REANALYSIS",
            "coverage_dates": "6-hourly continuous",
            "spatial_resolution": "0.25° x 0.25° (~25 km)",
            "domain": "Surface 10-meter height only (no subsurface wind)",
            "parameters": ["Zonal Wind (uwnd)", "Meridional Wind (vwnd)", "Wind Speed (ws)"],
            "qc_procedure": "Variational Analysis Method (VAM) combining satellite scatterometers, radiometers, and ECMWF ERA5 background winds.",
            "source_files": "ocean_data/WINDS_20240101_20240107.nc",
            "url": "http://www.remss.com/measurements/ccmp",
        },
        "oceanprofilenet": {
            "name": "OceanProfileNet Multi-Task Neural Reconstruction Network",
            "provider": "OceanEmbed AI Engine (Project 26066)",
            "type": "AI RECONSTRUCTED",
            "classification": "🟡 AI RECONSTRUCTED",
            "architecture": "Deep Multi-Layer Perceptron (8 surface features → [512, 512, 256] with LayerNorm & GELU → 35 depth levels)",
            "uncertainty_method": "Monte Carlo Dropout (30 stochastic forward passes at inference for 95% epistemic confidence intervals)",
            "training_ground_truth": "In-situ Argo CTD profiles & GLORYS12V1 verified reanalysis",
            "validated_metrics": {
                "temperature_mae": "0.669 °C",
                "temperature_rmse": "0.983 °C",
                "salinity_mae": "0.142 PSU",
            },
            "weights_file": "models/reconstruction/ocean_reconstruction.pt",
        }
    }
    if source_key and source_key in registry:
        return {"status": "success", "source": registry[source_key]}
    return {"status": "success", "provenance_registry": registry}


@app.get("/api/data-quality")
async def data_quality():
    """Returns authoritative real data quality statistics calculated from ARGO QC & GLORYS datasets."""
    import pandas as pd
    try:
        df = pd.read_parquet(ARGO_QC_PARQUET)
        n_total = int(len(df))
        temp_valid = int(df["surf_temp"].notna().sum())
        sal_valid = int(df["surf_psal"].notna().sum())
        depth_valid = int(df["max_depth"].notna().sum())
        
        # Calculate date range
        dates = pd.to_datetime(df["date"].dropna())
        d_min = str(dates.min().date()) if not dates.empty else "2024-01-01"
        d_max = str(dates.max().date()) if not dates.empty else "2024-01-31"

        qc_counts = {str(k): int(v) for k, v in df["pos_qc"].value_counts().items()} if "pos_qc" in df.columns else {}

        return {
            "status": "success",
            "datasets": {
                "argo_in_situ": {
                    "provider": "Global Argo GDAC / INCOIS",
                    "total_profiles": n_total,
                    "valid_temperature_profiles": temp_valid,
                    "valid_salinity_profiles": sal_valid,
                    "valid_depth_records": depth_valid,
                    "missing_temperature_count": n_total - temp_valid,
                    "missing_salinity_count": n_total - sal_valid,
                    "missing_depth_count": n_total - depth_valid,
                    "date_coverage": {"start": d_min, "end": d_max},
                    "spatial_bounds": {
                        "lat_min": round(float(df["lat"].min()), 3),
                        "lat_max": round(float(df["lat"].max()), 3),
                        "lon_min": round(float(df["lon"].min()), 3),
                        "lon_max": round(float(df["lon"].max()), 3),
                    },
                    "qc_flags": {
                        "position_qc_distribution": qc_counts,
                        "accepted_flags": ["1 (Good)", "2 (Probably Good)"],
                        "rejected_bad_data": "Excluded at ingestion stage",
                    },
                },
                "glorys_reanalysis": {
                    "provider": "Copernicus Marine Environment Monitoring Service (CMEMS)",
                    "product": "GLOBAL_REANALYSIS_PHY_001_031 (GLORYS12V1)",
                    "spatial_resolution": "0.083° x 0.083° (~9 km)",
                    "depth_levels": 35,
                    "depth_range_m": "0 to 902.5 m",
                    "temporal_range": "2024-01-01 to 2024-01-07 (Daily)",
                    "qc_status": "Assimilated multi-satellite & CTD physical reanalysis",
                },
            },
        }
    except Exception as e:
        log.error(f"Error computing data quality: {e}")
        return {"status": "error", "message": str(e)}


@app.get("/health")
async def health():
    return {"status": "ok", "service": "OceanEmbed API v2.0"}


# ── Run both port 8003 (main) and 8002 (map compat) ──────────────────────────

def _run_port_8002():
    """Run a second server instance on port 8002 for backward compat with ocean-map.tsx."""
    uvicorn.run(app, host="127.0.0.1", port=8002, log_level="warning")


if __name__ == "__main__":
    log.info("Starting OceanEmbed API on ports 8003 (primary) and 8002 (map compat)")
    # Start port 8002 in background thread
    t = threading.Thread(target=_run_port_8002, daemon=True)
    t.start()
    # Primary server on 8003 (blocking)
    uvicorn.run(app, host="127.0.0.1", port=8003, log_level="info")

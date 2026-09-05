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

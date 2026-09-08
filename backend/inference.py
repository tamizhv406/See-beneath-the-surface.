"""Inference engine — load trained model, serve predictions + uncertainty.

Used by the FastAPI backend. Never touches raw GB-scale files at inference time.
"""
from __future__ import annotations

import logging
from pathlib import Path
from functools import lru_cache

import numpy as np
import pandas as pd
import torch
import xarray as xr

import sys
sys.path.insert(0, str(Path(__file__).parent.parent))
from backend.config import (
    GLORYS_7DAY, MODELS_DIR, GLORYS_DEPTHS_M,
    WINDS_025, LAT_MIN, LAT_MAX, LON_MIN, LON_MAX,
)
from backend.train import OceanProfileNet, Scaler

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
log = logging.getLogger(__name__)

MODEL_PT = MODELS_DIR / "reconstruction" / "ocean_reconstruction.pt"
LEGACY_PT = Path("model_outputs") / "ocean_profile_model.pt"  # original model


def _clean_float(v, decimals: int = 2) -> float | None:
    if v is None:
        return None
    try:
        f = float(v)
        return round(f, decimals) if np.isfinite(f) else None
    except (TypeError, ValueError):
        return None


class InferenceEngine:
    """Thread-safe inference wrapper. Call load() once at startup."""

    def __init__(self):
        self.model: OceanProfileNet | None = None
        self.x_scaler:  Scaler | None = None
        self.yt_scaler: Scaler | None = None
        self.ys_scaler: Scaler | None = None
        self.target_depths: np.ndarray | None = None
        self.input_names: list[str] = []
        self.metrics: dict = {}
        self._glorys_cache: dict | None = None
        self._wind_cache: dict | None = None
        self._device = torch.device("cpu")

    def load(self) -> bool:
        """Load model from disk. Returns True if successful."""
        if MODEL_PT.exists():
            log.info(f"Loading new model from {MODEL_PT}")
            ckpt = torch.load(MODEL_PT, map_location="cpu", weights_only=False)
            n_depths = ckpt["n_depths"]
            n_inputs = len(ckpt["input_names"])
            self.model = OceanProfileNet(n_inputs, n_depths)
            self.model.load_state_dict(ckpt["model_state_dict"])
            self.model.eval()
            self.x_scaler  = Scaler.from_dict(ckpt["x_scaler"])
            self.yt_scaler = Scaler.from_dict(ckpt["yt_scaler"])
            self.ys_scaler = Scaler.from_dict(ckpt["ys_scaler"])
            self.target_depths = np.array(ckpt["target_depths"], dtype=np.float32)
            self.input_names = ckpt["input_names"]
            self.metrics = ckpt.get("metrics", {})
            log.info(f"New model loaded: {n_inputs} inputs → {n_depths} depths")
            return True
        elif LEGACY_PT.exists():
            log.info(f"Loading legacy model from {LEGACY_PT}")
            return self._load_legacy(LEGACY_PT)

        log.warning("No trained model found — returning GLORYS reference data only")
        return False

    def _load_legacy(self, path: Path) -> bool:
        try:
            import sys
            sys.path.insert(0, str(Path(__file__).parent.parent))
            ckpt = torch.load(path, map_location="cpu", weights_only=False)
            from train_ocean_model import ProfileMLP
            hidden = ckpt.get("hidden_size", 256)
            input_mean  = ckpt["input_mean"].numpy()
            input_scale = ckpt["input_scale"].numpy()
            target_mean  = ckpt["target_mean"].numpy()
            target_scale = ckpt["target_scale"].numpy()
            target_depths = ckpt["target_depths"].numpy()

            n_inputs = input_mean.shape[0]
            n_depths = target_mean.shape[0]

            model = ProfileMLP(n_inputs, n_depths, hidden)
            model.load_state_dict(ckpt["model_state_dict"])
            model.eval()

            self.model = _LegacyWrapper(model, input_mean, input_scale, target_mean, target_scale)
            self.target_depths = target_depths
            self.input_names = ckpt.get("input_names", ["surface_temperature_c", "surface_salinity_psu", "latitude_deg", "longitude_deg"])
            self.metrics = {}
            log.info(f"Legacy model loaded: {n_inputs} inputs → {n_depths} depths")
            return True
        except Exception as e:
            log.error(f"Failed to load legacy model: {e}")
            return False

    def _load_glorys_cache(self) -> dict:
        """Load GLORYS surface + profile data into a fast lookup dict (≈7 time steps)."""
        if self._glorys_cache is not None:
            return self._glorys_cache
        log.info("Loading GLORYS cache (lazy, time-step by time-step)...")
        cache = {}
        try:
            ds = xr.open_dataset(GLORYS_7DAY, decode_times=False)
            lats = ds["latitude"].values
            lons = ds["longitude"].values
            depths = ds["depth"].values
            n_t = ds.sizes["time"]
            t_idx = n_t - 1

            sst   = ds["thetao"].isel(time=t_idx, depth=0).values
            sss   = ds["so"].isel(time=t_idx, depth=0).values
            ssh   = ds["zos"].isel(time=t_idx).values
            mld   = ds["mlotst"].isel(time=t_idx).values
            bott  = ds["bottomT"].isel(time=t_idx).values
            temp_mean = ds["thetao"].mean("time").values
            sal_mean  = ds["so"].mean("time").values
            observation_time = float(ds["time"].values[t_idx])
            ds.close()

            cache["lats"]       = lats
            cache["lons"]       = lons
            cache["depths"]     = depths
            cache["sst"]        = sst
            cache["sss"]        = sss
            cache["ssh"]        = ssh
            cache["mld"]        = mld
            cache["bottom_t"]   = bott
            cache["temp_mean"]  = temp_mean
            cache["sal_mean"]   = sal_mean
            cache["observation_date"] = (pd.Timestamp("1950-01-01") + pd.Timedelta(hours=observation_time)).date().isoformat()
        except Exception as e:
            log.error(f"GLORYS cache load failed: {e}")
            cache = {}
        self._glorys_cache = cache
        return cache

    def nearest_glorys(self, lat: float, lon: float) -> dict:
        """Return GLORYS data for the nearest grid cell to (lat, lon)."""
        cache = self._load_glorys_cache()
        if not cache:
            return {}
        lats = cache["lats"]
        lons = cache["lons"]
        i_lat = int(np.argmin(np.abs(lats - lat)))
        i_lon = int(np.argmin(np.abs(lons - lon)))

        temp_profile = cache["temp_mean"][:, i_lat, i_lon].astype(float).tolist()
        sal_profile  = cache["sal_mean"][:, i_lat, i_lon].astype(float).tolist()
        depths       = cache["depths"].tolist()

        return {
            "surf_temp":  float(cache["sst"][i_lat, i_lon]),
            "surf_sal":   float(cache["sss"][i_lat, i_lon]),
            "ssh":        float(cache["ssh"][i_lat, i_lon]),
            "mld":        float(cache["mld"][i_lat, i_lon]),
            "bottom_t":   float(cache["bottom_t"][i_lat, i_lon]),
            "temp_profile_glorys": temp_profile,
            "sal_profile_glorys":  sal_profile,
            "depths": depths,
            "nearest_lat": float(lats[i_lat]),
            "nearest_lon": float(lons[i_lon]),
            "observation_date": cache.get("observation_date"),
        }

    def nearest_wind(self, lat: float, lon: float) -> dict:
        """Return the latest real CCMP surface wind at the nearest grid cell."""
        if self._wind_cache is None:
            try:
                with xr.open_dataset(WINDS_025, decode_times=False) as ds:
                    lats = ds["latitude"].values
                    lons = ds["longitude"].values
                    time_values = ds["time"].values
                    i_lat = int(np.argmin(np.abs(lats - lat)))
                    i_lon = int(np.argmin(np.abs(lons - lon)))
                    t_idx = len(time_values) - 1
                    ws = ds["ws"].isel(time=t_idx, latitude=i_lat, longitude=i_lon).item()
                    uwnd = ds["uwnd"].isel(time=t_idx, latitude=i_lat, longitude=i_lon).item()
                    vwnd = ds["vwnd"].isel(time=t_idx, latitude=i_lat, longitude=i_lon).item()
                    units = ds["time"].attrs.get("units", "hours since 1987-01-01 00:00:00")
                    origin = pd.Timestamp(units.split(" since ", 1)[1])
                    date = (origin + pd.Timedelta(hours=float(time_values[t_idx]))).date().isoformat()
                self._wind_cache = {"speed": float(ws), "u": float(uwnd), "v": float(vwnd), "date": date}
            except Exception as exc:
                log.error("CCMP wind cache load failed: %s", exc)
                self._wind_cache = {}
        return self._wind_cache

    def predict(
        self, lat: float, lon: float,
        surf_temp: float | None = None,
        surf_sal:  float | None = None,
        sla: float | None       = None,
        adt: float | None       = None,
        wind_speed: float|None  = None,
        mld: float | None       = None,
        n_mc: int = 30,
    ) -> dict:
        """
        Return full prediction dict for given lat/lon.
        Falls back to GLORYS reference data if no trained model.
        Returns status 'no_data' if selected location is on land or missing data.
        """
        glorys = self.nearest_glorys(lat, lon)

        # Check if requested cell is land / missing in GLORYS
        raw_surf_t = glorys.get("surf_temp", np.nan)
        temp_prof_raw = glorys.get("temp_profile_glorys", [])
        has_ocean_data = np.isfinite(raw_surf_t) or any(np.isfinite(t) for t in temp_prof_raw)

        if not has_ocean_data:
            return {
                "status": "no_data",
                "message": "No real observation data available for this location (land or out of marine domain).",
                "coordinates": {"lat": lat, "lon": lon},
                "nearest_grid": {
                    "lat": _clean_float(glorys.get("nearest_lat"), 4),
                    "lon": _clean_float(glorys.get("nearest_lon"), 4),
                },
                "temperature_profile": [],
                "model_profile": [],
                "reference_profile": [],
                "salinity_profile": [],
                "observed_salinity_profile": [],
                "temp_uncertainty": [],
                "sal_uncertainty": [],
                "surface_temp": None,
                "subsurface_temp": None,
                "bottom_temp": None,
                "salinity": None,
                "wind_speed": None,
                "sea_level": None,
                "current_speed": None,
                "current_direction": None,
                "mld": None,
                "provenance": {
                    "source": "GLORYS12V1 / ARGO",
                    "status": "NO_OBSERVATION",
                    "reason": "Land mask or unobserved coordinate",
                },
            }

        # Valid surface features from real GLORYS
        surf_t  = surf_temp if surf_temp is not None and np.isfinite(surf_temp) else raw_surf_t
        surf_s  = surf_sal if surf_sal is not None and np.isfinite(surf_sal) else glorys.get("surf_sal", np.nan)
        sla_v   = sla if sla is not None and np.isfinite(sla) else glorys.get("ssh", 0.0)
        adt_v   = adt if adt is not None and np.isfinite(adt) else glorys.get("ssh", 0.1)
        wind = self.nearest_wind(lat, lon)
        ws_v    = wind_speed if wind_speed is not None and np.isfinite(wind_speed) else wind.get("speed", np.nan)
        mld_v   = mld if mld is not None and np.isfinite(mld) else glorys.get("mld", np.nan)

        depths = glorys.get("depths", GLORYS_DEPTHS_M)
        sal_prof_raw = glorys.get("sal_profile_glorys", [])

        # Observed profiles
        profile_points = [
            {"depth": round(float(d), 2), "temperature": round(float(t), 3)}
            for d, t in zip(depths, temp_prof_raw)
            if np.isfinite(t) and float(d) <= 1000.0
        ]
        observed_salinity_points = [
            {"depth": round(float(d), 2), "salinity": round(float(s), 3)}
            for d, s in zip(depths, sal_prof_raw)
            if np.isfinite(s) and float(d) <= 1000.0
        ]

        model_profile: list[dict] = []
        sal_profile_model: list[dict] = []
        temp_uncertainty: list[dict] = []
        sal_uncertainty: list[dict] = []

        if self.model is not None and np.isfinite(surf_t) and np.isfinite(surf_s):
            try:
                if isinstance(self.model, _LegacyWrapper):
                    x = np.array([[surf_t, surf_s, lat, lon]], dtype=np.float32)
                    pred_t = self.model.predict(x)[0]
                    model_profile = [
                        {"depth": round(float(d), 2), "temperature": round(float(t), 3)}
                        for d, t in zip(self.target_depths, pred_t)
                        if np.isfinite(t) and float(d) <= 1000.0
                    ]
                else:
                    feat = np.array([[surf_t, surf_s, sla_v, adt_v, ws_v, mld_v, lat, lon]], dtype=np.float32)
                    feat_norm = torch.tensor(self.x_scaler.transform(feat)).float()
                    mean_t, std_t, mean_s, std_s = self.model.predict_with_uncertainty(feat_norm, n_samples=n_mc)
                    pred_t = mean_t[0].numpy() * self.yt_scaler.scale + self.yt_scaler.mean
                    pred_t_lo = pred_t - 1.96 * std_t[0].numpy() * self.yt_scaler.scale
                    pred_t_hi = pred_t + 1.96 * std_t[0].numpy() * self.yt_scaler.scale
                    pred_s = mean_s[0].numpy() * self.ys_scaler.scale + self.ys_scaler.mean
                    pred_s_lo = pred_s - 1.96 * std_s[0].numpy() * self.ys_scaler.scale
                    pred_s_hi = pred_s + 1.96 * std_s[0].numpy() * self.ys_scaler.scale

                    for d, t, tlo, thi in zip(self.target_depths, pred_t, pred_t_lo, pred_t_hi):
                        if float(d) <= 1000.0 and np.isfinite(t):
                            model_profile.append({"depth": round(float(d), 2), "temperature": round(float(t), 3)})
                            temp_uncertainty.append({"depth": round(float(d), 2), "lower": round(float(tlo), 3), "upper": round(float(thi), 3)})
                    for d, s, slo, shi in zip(self.target_depths, pred_s, pred_s_lo, pred_s_hi):
                        if float(d) <= 1000.0 and np.isfinite(s):
                            sal_profile_model.append({"depth": round(float(d), 2), "salinity": round(float(s), 3)})
                            sal_uncertainty.append({"depth": round(float(d), 2), "lower": round(float(slo), 3), "upper": round(float(shi), 3)})

            except Exception as e:
                log.warning(f"Model inference error: {e}")

        surf_temp_val = profile_points[0]["temperature"] if profile_points else _clean_float(raw_surf_t)
        sub_temp_val = next((p["temperature"] for p in profile_points if p["depth"] >= 495), None)
        sub_sal_val = next((p["salinity"] for p in (observed_salinity_points or sal_profile_model) if p["depth"] >= 495), None)

        return {
            "status": "reconstructed" if model_profile else "glorys_reference",
            "coordinates": {"lat": lat, "lon": lon},
            "nearest_grid": {
                "lat": _clean_float(glorys.get("nearest_lat"), 4),
                "lon": _clean_float(glorys.get("nearest_lon"), 4),
            },
            "temperature_profile": profile_points,           # 🔵 Copernicus GLORYS12V1 Reanalysis
            "model_profile": model_profile,                   # 🟡 OceanProfileNet reconstructed
            "reference_profile": profile_points,
            "salinity_profile": sal_profile_model,           # 🟡 OceanProfileNet salinity
            "observed_salinity_profile": observed_salinity_points, # 🔵 Copernicus GLORYS12V1 Reanalysis
            "temp_uncertainty": temp_uncertainty,
            "sal_uncertainty":  sal_uncertainty,
            "surface_temp":     surf_temp_val,
            "subsurface_temp":  sub_temp_val,
            "subsurface_salinity": sub_sal_val,
            "bottom_temp":      _clean_float(glorys.get("bottom_t")),
            "salinity":         _clean_float(glorys.get("surf_sal")),
            "wind_speed":       _clean_float(ws_v),
            "wind_observation_date": wind.get("date"),
            "sea_level":        _clean_float(sla_v, 3),
            "current_speed":    None,
            "current_direction": None,
            "mld":              _clean_float(glorys.get("mld"), 1),
            "classification": {
                "surface_temp": "MODEL / REANALYSIS",
                "temperature_profile": "MODEL / REANALYSIS",
                "salinity_profile": "AI RECONSTRUCTED" if sal_profile_model else "MODEL / REANALYSIS",
                "model_profile": "AI RECONSTRUCTED",
                "wind_speed": "MODEL / REANALYSIS",
                "sea_level": "MODEL / REANALYSIS",
                "mld": "MODEL / REANALYSIS",
            },
            "provenance": {
                "source": "Copernicus Marine GLORYS12V1 Reanalysis",
                "dataset_id": "GLOBAL_REANALYSIS_PHY_001_031",
                "observation_date": glorys.get("observation_date"),
                "wind_observation_date": wind.get("date"),
                "spatial_resolution": "0.083° x 0.083° (~9 km)",
                "depth_levels": 35,
                "model": "OceanProfileNet (8 surface features -> 35 depths with MC Dropout)",
                "qc_status": "Assimilated physical reanalysis (Passed QC)",
                "doi": "10.48670/moi-00021",
            },
        }


class _LegacyWrapper:
    """Wraps the original 4-input ProfileMLP for backward compat."""
    def __init__(self, model, input_mean, input_scale, target_mean, target_scale):
        self.model = model
        self.input_mean = input_mean
        self.input_scale = input_scale
        self.target_mean = target_mean
        self.target_scale = target_scale

    def predict(self, x: np.ndarray) -> np.ndarray:
        x_norm = (x - self.input_mean) / self.input_scale
        with torch.no_grad():
            out = self.model(torch.tensor(x_norm).float())
        return out.numpy() * self.target_scale + self.target_mean


# Singleton engine
_engine: InferenceEngine | None = None

def get_engine() -> InferenceEngine:
    global _engine
    if _engine is None:
        _engine = InferenceEngine()
        _engine.load()
    return _engine

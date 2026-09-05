"""Inference engine — load trained model, serve predictions + uncertainty.

Used by the FastAPI backend. Never touches raw GB-scale files at inference time.
"""
from __future__ import annotations

import logging
from pathlib import Path
from functools import lru_cache

import numpy as np
import torch
import xarray as xr

import sys
sys.path.insert(0, str(Path(__file__).parent.parent))
from backend.config import (
    GLORYS_7DAY, MODELS_DIR, GLORYS_DEPTHS_M,
    LAT_MIN, LAT_MAX, LON_MIN, LON_MAX,
)
from backend.train import OceanProfileNet, Scaler

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
log = logging.getLogger(__name__)

MODEL_PT = MODELS_DIR / "reconstruction" / "ocean_reconstruction.pt"
LEGACY_PT = Path("model_outputs") / "ocean_profile_model.pt"  # original model


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
        self._device = torch.device("cpu")

    def load(self) -> bool:
        """Load model from disk. Returns True if successful."""
        # Prefer the new multi-head model
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

        # Fallback: legacy ProfileMLP (original train_ocean_model.py format)
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

            # Legacy checkpoint format from train_ocean_model.py
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
            t_idx = n_t - 1  # use most recent time step

            # Load relevant slices
            sst   = ds["thetao"].isel(time=t_idx, depth=0).values
            sss   = ds["so"].isel(time=t_idx, depth=0).values
            ssh   = ds["zos"].isel(time=t_idx).values
            mld   = ds["mlotst"].isel(time=t_idx).values
            bott  = ds["bottomT"].isel(time=t_idx).values
            # Full profiles for the map display (use mean across time)
            temp_mean = ds["thetao"].mean("time").values  # (depth, lat, lon)
            sal_mean  = ds["so"].mean("time").values
            ds.close()

            cache["lats"]       = lats
            cache["lons"]       = lons
            cache["depths"]     = depths
            cache["sst"]        = sst
            cache["sss"]        = sss
            cache["ssh"]        = ssh
            cache["mld"]        = mld
            cache["bottom_t"]   = bott
            cache["temp_mean"]  = temp_mean  # (depth, lat, lon)
            cache["sal_mean"]   = sal_mean
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
        }

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
        """
        glorys = self.nearest_glorys(lat, lon)

        # Fill missing surface features from GLORYS
        surf_t  = surf_temp  if surf_temp  is not None and np.isfinite(surf_temp)  else glorys.get("surf_temp", 28.0)
        surf_s  = surf_sal   if surf_sal   is not None and np.isfinite(surf_sal)   else glorys.get("surf_sal",  35.0)
        sla_v   = sla        if sla        is not None and np.isfinite(sla)        else glorys.get("ssh", 0.0)
        adt_v   = adt        if adt        is not None and np.isfinite(adt)        else glorys.get("ssh", 0.1)
        ws_v    = wind_speed if wind_speed is not None and np.isfinite(wind_speed) else 6.5
        mld_v   = mld        if mld        is not None and np.isfinite(mld)        else glorys.get("mld", 50.0)

        # Build response with GLORYS reference profile
        temp_profile   = glorys.get("temp_profile_glorys", [])
        depths         = glorys.get("depths", GLORYS_DEPTHS_M)
        profile_points = [
            {"depth": round(d, 2), "temperature": round(t, 3)}
            for d, t in zip(depths, temp_profile)
            if np.isfinite(t) and d <= 1000.0
        ]

        model_profile: list[dict] = []
        sal_profile_model: list[dict] = []
        temp_uncertainty: list[dict] = []
        sal_uncertainty: list[dict] = []

        if self.model is not None:
            try:
                if isinstance(self.model, _LegacyWrapper):
                    # Legacy 4-feature model
                    x = np.array([[surf_t, surf_s, lat, lon]], dtype=np.float32)
                    pred_t = self.model.predict(x)[0]
                    model_profile = [
                        {"depth": round(float(d), 2), "temperature": round(float(t), 3)}
                        for d, t in zip(self.target_depths, pred_t)
                        if np.isfinite(t) and d <= 1000.0
                    ]
                else:
                    # New 8-feature model with MC Dropout
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
                        if float(d) <= 1000.0:
                            model_profile.append({"depth": round(float(d),2), "temperature": round(float(t),3)})
                            temp_uncertainty.append({"depth": round(float(d),2), "lower": round(float(tlo),3), "upper": round(float(thi),3)})
                    for d, s, slo, shi in zip(self.target_depths, pred_s, pred_s_lo, pred_s_hi):
                        if float(d) <= 1000.0:
                            sal_profile_model.append({"depth": round(float(d),2), "salinity": round(float(s),3)})
                            sal_uncertainty.append({"depth": round(float(d),2), "lower": round(float(slo),3), "upper": round(float(shi),3)})

            except Exception as e:
                log.warning(f"Model inference error: {e}")

        # Surface value from first valid profile point
        surf_temp_val  = round(temp_profile[0], 2) if temp_profile else None
        sub_idx = next((i for i, (d, _) in enumerate(zip(depths, temp_profile)) if d >= 495), None)
        sub_temp_val = round(temp_profile[sub_idx], 2) if sub_idx is not None else None
        bottom_temp_val = round(glorys.get("bottom_t", np.nan), 2) if np.isfinite(glorys.get("bottom_t", np.nan)) else None

        return {
            "status": "reconstructed" if model_profile else "glorys_reference",
            "coordinates": {"lat": lat, "lon": lon},
            "nearest_grid": {"lat": glorys.get("nearest_lat"), "lon": glorys.get("nearest_lon")},
            "temperature_profile": profile_points,   # GLORYS observed
            "model_profile": model_profile,           # DL reconstructed
            "reference_profile": profile_points,      # same as observed for now
            "salinity_profile": sal_profile_model,
            "temp_uncertainty": temp_uncertainty,
            "sal_uncertainty":  sal_uncertainty,
            "surface_temp":     surf_temp_val,
            "subsurface_temp":  sub_temp_val,
            "bottom_temp":      bottom_temp_val,
            "salinity":         round(float(glorys.get("surf_sal", np.nan)), 2) if np.isfinite(glorys.get("surf_sal", np.nan)) else None,
            "wind_speed":       round(ws_v, 2),
            "sea_level":        round(sla_v, 3) if np.isfinite(sla_v) else None,
            "current_speed":    None,
            "current_direction": None,
            "mld":              round(float(glorys.get("mld", np.nan)), 1) if np.isfinite(glorys.get("mld", np.nan)) else None,
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

"""T+1 / T+2 forecasting using GLORYS time series lag features.

Wind forecasting: surface only (10m CCMP winds — NOT subsurface).
Temperature/Salinity forecasting: 0-1000 m subsurface from GLORYS 31-day series.
"""
from __future__ import annotations

import json
import logging
import math
from pathlib import Path

import numpy as np
import pandas as pd

import sys
sys.path.insert(0, str(Path(__file__).parent.parent))
from backend.config import (
    GLORYS_7DAY, WINDS_025, METRICS_DIR,
    LAT_MIN, LAT_MAX, LON_MIN, LON_MAX,
)

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
log = logging.getLogger(__name__)


def get_forecast(lat: float, lon: float) -> dict:
    """
    Return T+1 and T+2 forecasts for temperature, salinity, and wind at (lat, lon).

    Strategy:
    - Temperature/Salinity: persistence baseline + linear trend extrapolation
      from the 7-day GLORYS time series (all that's available).
    - Wind: persistence from WINDS_025 (28 6-hourly steps = 7 days).
    - Horizon is T+1 day and T+2 days only.
    """
    import xarray as xr

    result = {
        "lat": lat, "lon": lon,
        "method": "persistence_plus_linear_trend",
        "horizon_days": [1, 2],
        "temperature": {},
        "salinity": {},
        "wind": {},
        "disclaimer": (
            "Forecast based on 7-day GLORYS time series (Jan 2024 only). "
            "Persistence+linear trend extrapolation. Not suitable for operational forecasting."
        ),
    }

    try:
        ds = xr.open_dataset(GLORYS_7DAY, decode_times=False)
        lats = ds["latitude"].values
        lons = ds["longitude"].values
        depths = ds["depth"].values
        n_t = ds.sizes["time"]

        i_lat = int(np.argmin(np.abs(lats - lat)))
        i_lon = int(np.argmin(np.abs(lons - lon)))

        # Surface temperature time series (n_t,)
        sst_series = ds["thetao"].isel(depth=0, latitude=i_lat, longitude=i_lon).values.astype(float)
        sss_series = ds["so"].isel(depth=0, latitude=i_lat, longitude=i_lon).values.astype(float)

        # Subsurface temp at selected depth levels
        depth_500_idx = int(np.argmin(np.abs(depths - 500)))
        temp_500 = ds["thetao"].isel(depth=depth_500_idx, latitude=i_lat, longitude=i_lon).values.astype(float)
        sal_500  = ds["so"].isel(depth=depth_500_idx, latitude=i_lat, longitude=i_lon).values.astype(float)
        ds.close()

        def extrapolate(series: np.ndarray, horizon: int) -> tuple[float, float]:
            """Persistence + linear trend. Returns (t+horizon_mean, t+horizon_std)."""
            t = np.arange(len(series), dtype=float)
            finite = np.isfinite(series)
            if finite.sum() < 2:
                return float(series[-1]) if np.isfinite(series[-1]) else np.nan, np.nan
            slope = np.polyfit(t[finite], series[finite], 1)
            last_t = t[-1]
            pred = np.polyval(slope, last_t + horizon)
            # Uncertainty: residual std * sqrt(horizon)
            resid_std = float(np.std(series[finite] - np.polyval(slope, t[finite])))
            return float(pred), resid_std * math.sqrt(horizon)

        for h in [1, 2]:
            sst_pred, sst_std = extrapolate(sst_series, h)
            sss_pred, sss_std = extrapolate(sss_series, h)
            s500_pred, s500_std = extrapolate(temp_500, h)
            sal500_pred, sal500_std = extrapolate(sal_500, h)

            result["temperature"][f"t+{h}"] = {
                "surface": {
                    "value": round(sst_pred, 3) if np.isfinite(sst_pred) else None,
                    "uncertainty_1sigma": round(sst_std, 3) if np.isfinite(sst_std) else None,
                    "unit": "°C",
                },
                "500m": {
                    "value": round(s500_pred, 3) if np.isfinite(s500_pred) else None,
                    "uncertainty_1sigma": round(s500_std, 3) if np.isfinite(s500_std) else None,
                    "unit": "°C",
                },
                "observed_last": {
                    "surface": round(float(sst_series[-1]), 3) if np.isfinite(sst_series[-1]) else None,
                    "500m": round(float(temp_500[-1]), 3) if np.isfinite(temp_500[-1]) else None,
                },
            }
            result["salinity"][f"t+{h}"] = {
                "surface": {
                    "value": round(sss_pred, 3) if np.isfinite(sss_pred) else None,
                    "uncertainty_1sigma": round(sss_std, 3) if np.isfinite(sss_std) else None,
                    "unit": "PSU",
                },
                "500m": {
                    "value": round(sal500_pred, 3) if np.isfinite(sal500_pred) else None,
                    "unit": "PSU",
                },
            }

    except Exception as e:
        log.error(f"GLORYS forecast error: {e}")
        result["temperature"]["error"] = str(e)
        result["salinity"]["error"] = str(e)

    # Wind forecast (surface, 10m)
    try:
        ds_w = xr.open_dataset(WINDS_025, decode_times=False)
        w_lats = ds_w["latitude"].values
        w_lons = ds_w["longitude"].values
        i_wlat = int(np.argmin(np.abs(w_lats - lat)))
        i_wlon = int(np.argmin(np.abs(w_lons - lon)))

        # 28 6-hourly steps
        uwnd = ds_w["uwnd"].isel(latitude=i_wlat, longitude=i_wlon).values.astype(float)
        vwnd = ds_w["vwnd"].isel(latitude=i_wlat, longitude=i_wlon).values.astype(float)
        ws   = ds_w["ws"].isel(latitude=i_wlat, longitude=i_wlon).values.astype(float)
        ds_w.close()

        # Daily aggregates (4 steps per day)
        n_days = len(uwnd) // 4
        u_daily = np.array([uwnd[i*4:(i+1)*4].mean() for i in range(n_days)])
        v_daily = np.array([vwnd[i*4:(i+1)*4].mean() for i in range(n_days)])
        ws_daily= np.array([ws[i*4:(i+1)*4].mean() for i in range(n_days)])

        for h in [1, 2]:
            ws_pred, ws_std   = extrapolate(ws_daily, h)
            u_pred, _         = extrapolate(u_daily, h)
            v_pred, _         = extrapolate(v_daily, h)
            direction = float(np.degrees(np.arctan2(-u_pred, -v_pred)) % 360) if np.isfinite(u_pred) else None

            result["wind"][f"t+{h}"] = {
                "wind_speed": {"value": round(ws_pred, 3) if np.isfinite(ws_pred) else None,
                               "uncertainty_1sigma": round(ws_std, 3) if np.isfinite(ws_std) else None,
                               "unit": "m/s"},
                "wind_direction": {"value": round(direction, 1) if direction is not None else None,
                                   "unit": "degrees_from_north"},
                "u_component": round(u_pred, 3) if np.isfinite(u_pred) else None,
                "v_component": round(v_pred, 3) if np.isfinite(v_pred) else None,
                "domain": "surface_10m",
                "observed_last": {
                    "wind_speed": round(float(ws_daily[-1]), 3) if np.isfinite(ws_daily[-1]) else None,
                    "u": round(float(u_daily[-1]), 3),
                    "v": round(float(v_daily[-1]), 3),
                },
            }

    except Exception as e:
        log.error(f"Wind forecast error: {e}")
        result["wind"]["error"] = str(e)

    return result


if __name__ == "__main__":
    fc = get_forecast(8.5, 74.2)
    print(json.dumps(fc, indent=2))

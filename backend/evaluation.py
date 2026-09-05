"""Reconstruction validation — depth-stratified metrics against held-out ARGO."""
from __future__ import annotations

import json
import logging
from pathlib import Path

import numpy as np
import pandas as pd

import sys
sys.path.insert(0, str(Path(__file__).parent.parent))
from backend.config import (
    ARGO_QC_PARQUET, ARGO_INDEX_JSON, METRICS_DIR, GLORYS_7DAY, GLORYS_DEPTHS_M,
    LAT_MIN, LAT_MAX, LON_MIN, LON_MAX,
)

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
log = logging.getLogger(__name__)

DEPTH_STRATA = [
    ("0-50m",    0,    50),
    ("50-100m",  50,   100),
    ("100-200m", 100,  200),
    ("200-500m", 200,  500),
    ("500-1000m",500,  1000),
]


def compute_metrics(obs: np.ndarray, pred: np.ndarray) -> dict:
    """MAE, RMSE, R², Bias, Correlation — all on finite pairs."""
    mask = np.isfinite(obs) & np.isfinite(pred)
    if mask.sum() < 2:
        return {"n": 0, "mae": None, "rmse": None, "r2": None, "bias": None, "corr": None}
    o, p = obs[mask], pred[mask]
    mae  = float(np.mean(np.abs(p - o)))
    rmse = float(np.sqrt(np.mean((p - o)**2)))
    bias = float(np.mean(p - o))
    ss_res = np.sum((p - o)**2)
    ss_tot = np.sum((o - o.mean())**2)
    r2   = float(1 - ss_res / ss_tot) if ss_tot > 0 else np.nan
    corr = float(np.corrcoef(o, p)[0, 1]) if len(o) > 2 else np.nan
    return {"n": int(mask.sum()), "mae": round(mae,4), "rmse": round(rmse,4),
            "r2": round(r2,4) if np.isfinite(r2) else None,
            "bias": round(bias,4), "corr": round(corr,4) if np.isfinite(corr) else None}


def run_validation() -> dict:
    """Run validation against QC-passed ARGO profiles using GLORYS reference."""
    import xarray as xr
    from backend.inference import get_engine

    if not ARGO_QC_PARQUET.exists():
        log.warning("ARGO parquet not found — skipping validation")
        return {"error": "argo_qc.parquet not found — run argo_processing.py first"}

    argo_df = pd.read_parquet(ARGO_QC_PARQUET)
    if len(argo_df) == 0:
        return {"error": "No QC profiles available"}

    # Get target depths from GLORYS
    ds_g = xr.open_dataset(GLORYS_7DAY, decode_times=False)
    target_depths = ds_g["depth"].values.astype(np.float32)
    target_depths = target_depths[target_depths <= 1001.0]
    ds_g.close()

    engine = get_engine()

    all_obs, all_pred = [], []
    depth_obs = {s: [] for s, _, _ in DEPTH_STRATA}
    depth_pred = {s: [] for s, _, _ in DEPTH_STRATA}

    n_evaluated = 0
    for _, row in argo_df.iterrows():
        lat, lon = float(row["lat"]), float(row["lon"])
        if not (LAT_MIN <= lat <= LAT_MAX and LON_MIN <= lon <= LON_MAX):
            continue

        result = engine.predict(lat, lon)
        pred_profile = result.get("model_profile") or result.get("temperature_profile", [])
        if not pred_profile:
            continue

        pred_depths = np.array([p["depth"] for p in pred_profile])
        pred_temps  = np.array([p["temperature"] for p in pred_profile])

        # ARGO observed profile
        pres = np.array(row["pres"], dtype=np.float32)
        temp = np.array(row["temp"], dtype=np.float32)
        valid = np.isfinite(pres) & np.isfinite(temp)
        if valid.sum() < 2:
            continue

        # Interpolate ARGO to target depths
        p_v, t_v = pres[valid], temp[valid]
        order = np.argsort(p_v)
        p_v, t_v = p_v[order], t_v[order]
        p_v, idx = np.unique(p_v, return_index=True)
        t_v = t_v[idx]

        if p_v[0] > 25.0 or p_v[-1] < 150.0:
            continue

        obs_interp  = np.interp(target_depths, p_v, t_v, left=t_v[0], right=t_v[-1])
        pred_interp = np.interp(target_depths, pred_depths, pred_temps)

        all_obs.append(obs_interp)
        all_pred.append(pred_interp)

        # Depth strata
        for stratum, d_min, d_max in DEPTH_STRATA:
            mask_d = (target_depths >= d_min) & (target_depths < d_max)
            depth_obs[stratum].append(obs_interp[mask_d])
            depth_pred[stratum].append(pred_interp[mask_d])

        n_evaluated += 1

    if n_evaluated == 0:
        return {"error": "No profiles evaluated", "profiles_evaluated": 0}

    all_obs_arr  = np.concatenate(all_obs)
    all_pred_arr = np.concatenate(all_pred)
    overall = compute_metrics(all_obs_arr, all_pred_arr)
    overall["profiles_evaluated"] = n_evaluated

    strata_metrics = {}
    for stratum, _, _ in DEPTH_STRATA:
        o = np.concatenate(depth_obs[stratum]) if depth_obs[stratum] else np.array([])
        p = np.concatenate(depth_pred[stratum]) if depth_pred[stratum] else np.array([])
        strata_metrics[stratum] = compute_metrics(o, p)

    result_out = {
        "overall": overall,
        "by_depth_stratum": strata_metrics,
        "target_variable": "temperature_c",
        "reference": "GLORYS subsurface + DL reconstruction vs ARGO in-situ",
    }

    METRICS_DIR.mkdir(parents=True, exist_ok=True)
    with open(METRICS_DIR / "validation_report.json", "w") as f:
        json.dump(result_out, f, indent=2)
    log.info(f"Validation complete: {n_evaluated} profiles | Overall MAE={overall['mae']}°C")
    return result_out


if __name__ == "__main__":
    results = run_validation()
    print(json.dumps(results, indent=2))

"""Surface feature preprocessing — chunked reading of GLORYS, OSTIA, SSH, SSS, WINDS.

Usage:
    py -3 backend/preprocess.py

Outputs (READ-ONLY raw data, writes to data/processed/):
    data/processed/surface_features.parquet  — aligned surface inputs on 0.25° grid
    data/processed/glorys_features.parquet   — subsurface temp/salinity profiles
    data/indexes/glorys_grid_index.json      — lightweight grid metadata
"""
from __future__ import annotations

import json
import logging
from pathlib import Path

import numpy as np
import pandas as pd
import xarray as xr

import sys
sys.path.insert(0, str(Path(__file__).parent.parent))
from backend.config import (
    GLORYS_7DAY, GLORYS_025, OSTIA_025, SSH_025, SSS_025, WINDS_025, CURRENTS_025,
    PROCESSED_DIR, INDEXES_DIR, SURFACE_FEAT_PARQUET, GLORYS_FEAT_PARQUET, GLORYS_GRID_JSON,
    GLORYS_DEPTHS_M, LAT_MIN, LAT_MAX, LON_MIN, LON_MAX, MAX_DEPTH,
)

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
log = logging.getLogger(__name__)

KELVIN_TO_C = 273.15


def open_lazy(path: Path, **kw) -> xr.Dataset:
    return xr.open_dataset(path, decode_times=False, **kw)


def nearest_val(ds: xr.Dataset, var: str, lat: float, lon: float, time_idx: int = 0) -> float:
    """Return nearest grid value for a lat/lon point."""
    try:
        sel = ds[var].isel(time=time_idx).sel(
            latitude=lat, longitude=lon, method="nearest"
        )
        v = float(sel.values)
        return v if np.isfinite(v) else np.nan
    except Exception:
        return np.nan


def build_surface_features() -> pd.DataFrame:
    """Build aligned surface feature DataFrame on the 0.25° GLORYS grid."""
    log.info("Opening surface datasets (lazy)...")

    ds_glorys = open_lazy(GLORYS_025)
    ds_ostia  = open_lazy(OSTIA_025)
    ds_ssh    = open_lazy(SSH_025)
    ds_sss    = open_lazy(SSS_025)
    ds_winds  = open_lazy(WINDS_025)
    ds_curr   = open_lazy(CURRENTS_025)

    lats = ds_glorys["latitude"].values
    lons = ds_glorys["longitude"].values
    times = ds_glorys["time"].values
    n_times = len(times)

    log.info(f"Grid: {len(lats)} lats × {len(lons)} lons × {n_times} times")

    records: list[dict] = []

    for t_idx in range(n_times):
        log.info(f"Processing time step {t_idx+1}/{n_times}...")

        # Load one time slice at a time to avoid RAM overload
        # Surface temperature from GLORYS (first depth level)
        glorys_sst_slice = ds_glorys["thetao"].isel(time=t_idx, depth=0).values  # (lat, lon)
        glorys_sss_slice = ds_glorys["so"].isel(time=t_idx, depth=0).values
        glorys_ssh_slice = ds_glorys["zos"].isel(time=t_idx).values
        glorys_mld_slice = ds_glorys["mlotst"].isel(time=t_idx).values

        # OSTIA SST (may have different grid — nearest interp handled per-point would be slow)
        # Instead use the 0.25° regridded version
        try:
            ostia_t_idx = min(t_idx, ds_ostia["time"].shape[0] - 1)
            ostia_sst_slice = ds_ostia["analysed_sst"].isel(time=ostia_t_idx).values - KELVIN_TO_C
            ostia_err_slice = ds_ostia["analysis_error"].isel(time=ostia_t_idx).values
        except Exception:
            ostia_sst_slice = np.full_like(glorys_sst_slice, np.nan)
            ostia_err_slice = np.full_like(glorys_sst_slice, np.nan)

        try:
            ssh_t_idx = min(t_idx, ds_ssh["time"].shape[0] - 1)
            sla_slice = ds_ssh["sla"].isel(time=ssh_t_idx).values
            adt_slice = ds_ssh["adt"].isel(time=ssh_t_idx).values
        except Exception:
            sla_slice = np.full_like(glorys_sst_slice, np.nan)
            adt_slice = np.full_like(glorys_sst_slice, np.nan)

        try:
            sss_t_idx = min(t_idx, ds_sss["time"].shape[0] - 1)
            sos_slice = ds_sss["sos"].isel(time=sss_t_idx, depth=0).values
        except Exception:
            sos_slice = np.full_like(glorys_sst_slice, np.nan)

        # Wind — 28 time steps (6-hourly), pick closest to daily
        try:
            wind_t_idx = min(t_idx * 4, ds_winds["time"].shape[0] - 1)
            uwnd_slice = ds_winds["uwnd"].isel(time=wind_t_idx).values
            vwnd_slice = ds_winds["vwnd"].isel(time=wind_t_idx).values
            ws_slice   = ds_winds["ws"].isel(time=wind_t_idx).values
        except Exception:
            uwnd_slice = np.full_like(glorys_sst_slice, np.nan)
            vwnd_slice = np.full_like(glorys_sst_slice, np.nan)
            ws_slice   = np.full_like(glorys_sst_slice, np.nan)

        # Currents
        try:
            curr_t_idx = min(t_idx, ds_curr["time"].shape[0] - 1)
            u_curr_slice = ds_curr["u"].isel(time=curr_t_idx).values  # shape: (lon, lat) — transposed!
            v_curr_slice = ds_curr["v"].isel(time=curr_t_idx).values
            # Transpose to (lat, lon) to match GLORYS grid
            if u_curr_slice.shape == (len(lons), len(lats)):
                u_curr_slice = u_curr_slice.T
                v_curr_slice = v_curr_slice.T
        except Exception:
            u_curr_slice = np.full_like(glorys_sst_slice, np.nan)
            v_curr_slice = np.full_like(glorys_sst_slice, np.nan)

        # Flatten grid
        for i_lat, lat in enumerate(lats):
            for i_lon, lon in enumerate(lons):
                g_sst = float(glorys_sst_slice[i_lat, i_lon]) if glorys_sst_slice.shape == (len(lats), len(lons)) else np.nan
                g_sss = float(glorys_sss_slice[i_lat, i_lon]) if glorys_sss_slice.shape == (len(lats), len(lons)) else np.nan
                g_ssh = float(glorys_ssh_slice[i_lat, i_lon]) if glorys_ssh_slice.shape == (len(lats), len(lons)) else np.nan
                g_mld = float(glorys_mld_slice[i_lat, i_lon]) if glorys_mld_slice.shape == (len(lats), len(lons)) else np.nan

                # Safely get OSTIA SST — may differ in shape
                def safe_2d(arr, i, j):
                    try:
                        v = float(arr[i, j])
                        return v if np.isfinite(v) else np.nan
                    except (IndexError, TypeError):
                        return np.nan

                records.append({
                    "time_idx": t_idx,
                    "time_raw": float(times[t_idx]),
                    "lat": float(lat),
                    "lon": float(lon),
                    "glorys_sst": g_sst if np.isfinite(g_sst) else np.nan,
                    "glorys_sss": g_sss if np.isfinite(g_sss) else np.nan,
                    "glorys_ssh": g_ssh if np.isfinite(g_ssh) else np.nan,
                    "glorys_mld": g_mld if np.isfinite(g_mld) else np.nan,
                    "ostia_sst":  safe_2d(ostia_sst_slice, i_lat, i_lon) if ostia_sst_slice.shape[0] > i_lat else np.nan,
                    "ostia_err":  safe_2d(ostia_err_slice, i_lat, i_lon) if ostia_err_slice.shape[0] > i_lat else np.nan,
                    "sla":        safe_2d(sla_slice, i_lat, i_lon) if sla_slice.shape[0] > i_lat else np.nan,
                    "adt":        safe_2d(adt_slice, i_lat, i_lon) if adt_slice.shape[0] > i_lat else np.nan,
                    "sos":        safe_2d(sos_slice, i_lat, i_lon) if sos_slice.shape[0] > i_lat else np.nan,
                    "uwnd":       safe_2d(uwnd_slice, i_lat, i_lon) if uwnd_slice.shape[0] > i_lat else np.nan,
                    "vwnd":       safe_2d(vwnd_slice, i_lat, i_lon) if vwnd_slice.shape[0] > i_lat else np.nan,
                    "wind_speed": safe_2d(ws_slice, i_lat, i_lon) if ws_slice.shape[0] > i_lat else np.nan,
                    "u_curr":     safe_2d(u_curr_slice, i_lat, i_lon) if u_curr_slice.shape[0] > i_lat else np.nan,
                    "v_curr":     safe_2d(v_curr_slice, i_lat, i_lon) if v_curr_slice.shape[0] > i_lat else np.nan,
                })

        # Release memory
        del glorys_sst_slice, glorys_sss_slice, glorys_ssh_slice, glorys_mld_slice
        del ostia_sst_slice, ostia_err_slice, sla_slice, adt_slice
        del sos_slice, uwnd_slice, vwnd_slice, ws_slice
        del u_curr_slice, v_curr_slice

    ds_glorys.close(); ds_ostia.close(); ds_ssh.close()
    ds_sss.close(); ds_winds.close(); ds_curr.close()

    df = pd.DataFrame(records)
    log.info(f"Surface feature table: {len(df)} rows, {len(df.columns)} columns")
    return df


def build_glorys_profiles() -> pd.DataFrame:
    """Extract GLORYS subsurface temperature and salinity profiles per grid cell per time."""
    log.info("Building GLORYS subsurface profiles (chunked by time step)...")
    ds = open_lazy(GLORYS_025)

    depths = ds["depth"].values  # 35 levels
    lats   = ds["latitude"].values
    lons   = ds["longitude"].values
    times  = ds["time"].values
    n_times = len(times)

    records: list[dict] = []
    for t_idx in range(n_times):
        log.info(f"GLORYS profile time {t_idx+1}/{n_times}...")
        temp_3d = ds["thetao"].isel(time=t_idx).values   # (depth, lat, lon)
        sal_3d  = ds["so"].isel(time=t_idx).values
        btm_t   = ds["bottomT"].isel(time=t_idx).values  # (lat, lon)

        for i_lat, lat in enumerate(lats):
            for i_lon, lon in enumerate(lons):
                temp_profile = temp_3d[:, i_lat, i_lon].astype(float).tolist()
                sal_profile  = sal_3d[:, i_lat, i_lon].astype(float).tolist()
                records.append({
                    "time_idx": t_idx,
                    "time_raw": float(times[t_idx]),
                    "lat": float(lat),
                    "lon": float(lon),
                    "temp_profile": temp_profile,
                    "sal_profile": sal_profile,
                    "bottom_temp": float(btm_t[i_lat, i_lon]),
                    "surf_temp": temp_profile[0] if temp_profile else np.nan,
                    "surf_sal": sal_profile[0] if sal_profile else np.nan,
                })
        del temp_3d, sal_3d, btm_t

    ds.close()
    df = pd.DataFrame(records)
    log.info(f"GLORYS profiles: {len(df)} rows")
    return df


def build_grid_index(df: pd.DataFrame) -> None:
    """Build a lightweight JSON index of available grid cells."""
    cells = df.groupby(["lat", "lon"]).agg(
        time_steps=("time_idx", "count"),
        surf_temp_mean=("glorys_sst", "mean"),
        surf_sal_mean=("glorys_sss", "mean"),
    ).reset_index()
    cells["lat"] = cells["lat"].round(4)
    cells["lon"] = cells["lon"].round(4)
    records = cells.to_dict(orient="records")
    with open(GLORYS_GRID_JSON, "w") as f:
        json.dump({"grid_cells": records, "count": len(records)}, f)
    log.info(f"Grid index: {len(records)} cells → {GLORYS_GRID_JSON}")


if __name__ == "__main__":
    PROCESSED_DIR.mkdir(parents=True, exist_ok=True)
    INDEXES_DIR.mkdir(parents=True, exist_ok=True)

    surf_df = build_surface_features()
    surf_df.to_parquet(SURFACE_FEAT_PARQUET, index=False)
    log.info(f"Saved {SURFACE_FEAT_PARQUET}")

    build_grid_index(surf_df)

    glorys_df = build_glorys_profiles()
    glorys_df.to_parquet(GLORYS_FEAT_PARQUET, index=False)
    log.info(f"Saved {GLORYS_FEAT_PARQUET}")

    print("\nPreprocessing complete.")
    print(f"  Surface features: {len(surf_df)} rows")
    print(f"  GLORYS profiles:  {len(glorys_df)} rows")

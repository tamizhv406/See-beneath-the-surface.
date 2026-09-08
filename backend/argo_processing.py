"""ARGO float processing — QC filtering, Indian Ocean subset, index building.

Usage:
    py -3 backend/argo_processing.py

Outputs (READ ONLY raw data, writes to data/processed/):
    data/processed/argo_qc.parquet    — QC-passed Indian Ocean profiles
    data/processed/argo_raw.parquet   — all profiles (pre-QC, for reference)
    data/indexes/argo_index.json      — lightweight profile index for API
"""
from __future__ import annotations

import json
import logging
from pathlib import Path

import numpy as np
import pandas as pd
import xarray as xr

# Allow running as script or imported
import sys
sys.path.insert(0, str(Path(__file__).parent.parent))
from backend.config import (
    ARGO_DIR, ARGO_QC_PARQUET, ARGO_RAW_PARQUET, ARGO_INDEX_JSON,
    LAT_MIN, LAT_MAX, LON_MIN, LON_MAX, MAX_DEPTH, PROCESSED_DIR, INDEXES_DIR,
)

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
log = logging.getLogger(__name__)

JULD_EPOCH = pd.Timestamp("1950-01-01")


def decode_bytes(val) -> str:
    if isinstance(val, bytes):
        return val.decode("ascii", errors="ignore").strip()
    return str(val).strip()


def juld_to_datetime(juld: float) -> pd.Timestamp:
    return JULD_EPOCH + pd.Timedelta(days=float(juld))


def process_argo_files() -> tuple[pd.DataFrame, pd.DataFrame]:
    """Process all ARGO *_prof.nc files. Returns (qc_df, raw_df)."""
    files = sorted(ARGO_DIR.glob("*_prof.nc"))
    if not files:
        raise FileNotFoundError(f"No *_prof.nc files in {ARGO_DIR}")
    log.info(f"Found {len(files)} ARGO files. Processing...")

    raw_records: list[dict] = []
    qc_records: list[dict] = []

    for file_idx, path in enumerate(files, 1):
        log.info(f"[{file_idx}/{len(files)}] {path.name}")
        try:
            with xr.open_dataset(path, decode_times=False) as ds:
                n_prof = ds.sizes["N_PROF"]
                n_levels = ds.sizes["N_LEVELS"]

                # Load arrays (entire file — each file ~4 MB, manageable)
                platform = np.array([decode_bytes(v) for v in ds["PLATFORM_NUMBER"].values])
                cycle    = ds["CYCLE_NUMBER"].values.astype(int)
                juld     = ds["JULD"].values.astype(float)
                lat      = ds["LATITUDE"].values.astype(float)
                lon      = ds["LONGITUDE"].values.astype(float)
                pos_qc   = np.array([decode_bytes(v) for v in ds["POSITION_QC"].values])

                # Delayed-mode files provide adjusted values; real-time files
                # commonly leave adjusted arrays empty and provide raw values.
                def prefer_adjusted(name: str) -> np.ndarray:
                    adjusted = ds[f"{name}_ADJUSTED"].values
                    raw = ds[name].values
                    return np.where(np.isfinite(adjusted), adjusted, raw).astype(np.float32)

                def prefer_adjusted_qc(name: str) -> np.ndarray:
                    adjusted_qc = ds[f"{name}_ADJUSTED_QC"].values
                    raw_qc = ds[f"{name}_QC"].values
                    return np.where(pd.notna(adjusted_qc), adjusted_qc, raw_qc)

                pres     = prefer_adjusted("PRES")
                pres_qc  = prefer_adjusted_qc("PRES")
                temp     = prefer_adjusted("TEMP")
                temp_qc  = prefer_adjusted_qc("TEMP")
                psal     = prefer_adjusted("PSAL")
                psal_qc  = prefer_adjusted_qc("PSAL")

                for i in range(n_prof):
                    # Replace 99999 sentinels with NaN
                    pres_i = pres[i].copy()
                    temp_i = temp[i].copy()
                    psal_i = psal[i].copy()
                    pres_i[~np.isfinite(pres_i) | (np.abs(pres_i) > 1e4)] = np.nan
                    temp_i[~np.isfinite(temp_i) | (np.abs(temp_i) > 50)] = np.nan
                    psal_i[~np.isfinite(psal_i) | (np.abs(psal_i) > 50)] = np.nan

                    lat_i = float(lat[i])
                    lon_i = float(lon[i])
                    if not (np.isfinite(lat_i) and np.isfinite(lon_i)):
                        continue

                    # Surface values
                    valid_mask = np.isfinite(pres_i) & np.isfinite(temp_i)
                    if not valid_mask.any():
                        continue
                    shallowest = int(np.nanargmin(np.where(valid_mask, pres_i, np.inf)))
                    surf_temp = float(temp_i[shallowest])
                    surf_pres = float(pres_i[shallowest])

                    surf_psal = np.nan
                    valid_s = np.isfinite(pres_i) & np.isfinite(psal_i)
                    if valid_s.any():
                        sh_s = int(np.nanargmin(np.where(valid_s, pres_i, np.inf)))
                        surf_psal = float(psal_i[sh_s])

                    max_depth = float(np.nanmax(pres_i[np.isfinite(pres_i)])) if np.isfinite(pres_i).any() else np.nan
                    date = juld_to_datetime(juld[i]) if np.isfinite(juld[i]) else pd.NaT

                    # Serialize profile as lists (only valid levels)
                    valid_all = np.isfinite(pres_i) & np.isfinite(temp_i)
                    pres_list = pres_i[valid_all].tolist()
                    temp_list = temp_i[valid_all].tolist()
                    psal_list = psal_i[valid_all].tolist() if valid_s.any() else []

                    # QC flags
                    tqc_i = [decode_bytes(v) for v in temp_qc[i]]
                    sqc_i = [decode_bytes(v) for v in psal_qc[i]]
                    pqc_i = [decode_bytes(v) for v in pres_qc[i]]

                    record = {
                        "platform": platform[i],
                        "cycle": int(cycle[i]),
                        "date": date,
                        "lat": lat_i,
                        "lon": lon_i,
                        "pos_qc": pos_qc[i],
                        "surf_temp": surf_temp,
                        "surf_psal": surf_psal,
                        "surf_pres": surf_pres,
                        "max_depth": max_depth,
                        "n_levels_valid": int(valid_all.sum()),
                        "pres": pres_list,
                        "temp": temp_list,
                        "psal": psal_list,
                        "source_file": path.name,
                    }

                    # Indian Ocean spatial filter
                    in_domain = (LAT_MIN <= lat_i <= LAT_MAX) and (LON_MIN <= lon_i <= LON_MAX)
                    raw_records.append({**record, "in_domain": in_domain})

                    # QC criteria for quality-controlled dataset
                    # 1) Position QC good
                    # 2) In Indian Ocean domain
                    # 3) Has valid surface observations
                    # 4) Reaches at least 50 m depth
                    # 5) Majority of temp levels flagged good (1 or 2)
                    good_temp_count = sum(1 for f in tqc_i if f in ("1", "2"))
                    total_temp = len(tqc_i)
                    temp_good_frac = good_temp_count / total_temp if total_temp > 0 else 0.0

                    is_qc_pass = (
                        in_domain
                        and pos_qc[i] in ("1", "2")
                        and np.isfinite(surf_temp)
                        and np.isfinite(max_depth)
                        and max_depth >= 50.0
                        and temp_good_frac >= 0.5
                    )
                    if is_qc_pass:
                        qc_records.append(record)

        except Exception as exc:
            log.warning(f"Error reading {path.name}: {exc}")

    raw_df = pd.DataFrame(raw_records)
    qc_df  = pd.DataFrame(qc_records)
    log.info(f"Raw profiles: {len(raw_df)} | QC-passed Indian Ocean: {len(qc_df)}")
    return qc_df, raw_df


def save_outputs(qc_df: pd.DataFrame, raw_df: pd.DataFrame) -> None:
    PROCESSED_DIR.mkdir(parents=True, exist_ok=True)
    INDEXES_DIR.mkdir(parents=True, exist_ok=True)

    # Save parquet (list columns need object dtype — already correct)
    qc_df.to_parquet(ARGO_QC_PARQUET, index=False)
    raw_df.to_parquet(ARGO_RAW_PARQUET, index=False)
    log.info(f"Saved {ARGO_QC_PARQUET} ({len(qc_df)} rows)")
    log.info(f"Saved {ARGO_RAW_PARQUET} ({len(raw_df)} rows)")

    # Build lightweight JSON index (no profile data, just metadata)
    index_records = []
    for _, row in qc_df.iterrows():
        index_records.append({
            "id": f"{row['platform']}-{row['cycle']}",
            "platform": row["platform"],
            "cycle": int(row["cycle"]),
            "date": row["date"].isoformat() if pd.notna(row["date"]) else None,
            "lat": round(float(row["lat"]), 4),
            "lon": round(float(row["lon"]), 4),
            "max_depth": round(float(row["max_depth"]), 1) if pd.notna(row["max_depth"]) else None,
            "surf_temp": round(float(row["surf_temp"]), 3) if pd.notna(row["surf_temp"]) else None,
            "surf_psal": round(float(row["surf_psal"]), 3) if pd.notna(row["surf_psal"]) else None,
            "n_levels": int(row["n_levels_valid"]),
            "quality": "QC-passed",
            "source": row["source_file"],
        })

    with open(ARGO_INDEX_JSON, "w") as f:
        json.dump({"profiles": index_records, "count": len(index_records)}, f, indent=2)
    log.info(f"Saved ARGO index: {len(index_records)} profiles → {ARGO_INDEX_JSON}")


if __name__ == "__main__":
    qc_df, raw_df = process_argo_files()
    save_outputs(qc_df, raw_df)
    print(f"\nARGO processing complete.")
    print(f"  Raw (all):       {len(raw_df)} profiles")
    print(f"  QC-passed (NIO): {len(qc_df)} profiles")
    if len(qc_df) > 0:
        print(f"  Unique platforms: {qc_df['platform'].nunique()}")
        print(f"  Date range:       {qc_df['date'].min()} → {qc_df['date'].max()}")
        print(f"  Lat range:        {qc_df['lat'].min():.2f} → {qc_df['lat'].max():.2f}")
        print(f"  Lon range:        {qc_df['lon'].min():.2f} → {qc_df['lon'].max():.2f}")

"""Shared dataset paths and constants for the Ocean AI backend."""
from pathlib import Path

# ── Directory roots ─────────────────────────────────────────────────────────
BACKEND_DIR     = Path(__file__).parent
PROJECT_DIR     = BACKEND_DIR.parent

def _resolve_data_dir(folder_name: str, fallback_path: str) -> Path:
    local_path = PROJECT_DIR / folder_name
    if local_path.exists():
        return local_path
    fb = Path(fallback_path)
    if fb.exists():
        return fb
    return local_path

ARGO_DIR        = _resolve_data_dir("data set", r"C:\Users\tamiz\Downloads\data set")
OCEAN_DATA_DIR  = _resolve_data_dir("ocean_data", r"C:\Users\tamiz\Downloads\ocean_data")
ORG_DATA_DIR    = _resolve_data_dir("org dataset", r"C:\Users\tamiz\Downloads\org dataset")

# GLORYS
GLORYS_FULL     = OCEAN_DATA_DIR / "glorys_jan2024.nc"           # 1.9 GB — chunked only
GLORYS_7DAY     = OCEAN_DATA_DIR / "glorys_north_indian_ocean.nc" # 447 MB
GLORYS_025      = OCEAN_DATA_DIR / "GLORYS_Target_025_grid.nc"    # 200 MB

# Surface observations
OSTIA_SST       = OCEAN_DATA_DIR / "ostia_north_indian_ocean.nc"
OSTIA_025       = OCEAN_DATA_DIR / "SST_025_grid.nc"
SSH_NIO         = OCEAN_DATA_DIR / "ssh_north_indian_ocean.nc"
SSH_025         = OCEAN_DATA_DIR / "SSH_025_grid.nc"
SSS_NIO         = OCEAN_DATA_DIR / "sss_north_indian_ocean.nc"
SSS_025         = OCEAN_DATA_DIR / "SSS_025_grid.nc"
WINDS_025       = OCEAN_DATA_DIR / "WINDS_025_grid.nc"
CURRENTS_025    = OCEAN_DATA_DIR / "CURRENTS_025_grid.nc"

# ── Processed data (written by pipeline) ─────────────────────────────────────
BACKEND_DIR     = Path(__file__).parent
PROJECT_DIR     = BACKEND_DIR.parent
DATA_DIR        = PROJECT_DIR / "data"
PROCESSED_DIR   = DATA_DIR / "processed"
INDEXES_DIR     = DATA_DIR / "indexes"
METRICS_DIR     = DATA_DIR / "metrics"
MODELS_DIR      = PROJECT_DIR / "models"

# Processed outputs
ARGO_QC_PARQUET     = PROCESSED_DIR / "argo_qc.parquet"
ARGO_RAW_PARQUET    = PROCESSED_DIR / "argo_raw.parquet"
SURFACE_FEAT_PARQUET = PROCESSED_DIR / "surface_features.parquet"
GLORYS_FEAT_PARQUET  = PROCESSED_DIR / "glorys_features.parquet"
ARGO_INDEX_JSON     = INDEXES_DIR / "argo_index.json"
GLORYS_GRID_JSON    = INDEXES_DIR / "glorys_grid_index.json"

# Model paths
MODEL_PT  = PROJECT_DIR / "model_outputs" / "ocean_profile_model.pt"
MODEL_H5  = PROJECT_DIR / "model_outputs" / "ocean_profile_model.h5"
METRICS_JSON = PROJECT_DIR / "model_outputs" / "training_metrics.json"

# ── Domain ────────────────────────────────────────────────────────────────────
LAT_MIN, LAT_MAX = 5.0, 30.0
LON_MIN, LON_MAX = 45.0, 105.0
MAX_DEPTH = 1000.0

# GLORYS depth levels (35 levels, 0.49–902 m) — read from file at runtime
GLORYS_DEPTHS_M = [
    0.494, 1.541, 2.646, 3.819, 5.078, 6.441, 7.930, 9.573, 11.405,
    13.467, 15.810, 18.495, 21.598, 25.211, 29.444, 34.434, 40.344,
    47.373, 55.764, 65.807, 77.853, 92.326, 109.729, 130.666, 155.851,
    186.126, 222.475, 266.040, 318.127, 380.213, 453.938, 541.089,
    643.567, 763.333, 902.339,
]

# Argo QC accepted flags
ARGO_GOOD_QC = {b"1", b"2"}  # 1=good, 2=probably good

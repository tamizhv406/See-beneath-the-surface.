"""Ocean reconstruction model — enhanced ProfileMLP with temp + salinity heads.

Inputs (8 features):
  surface_temp_c, surface_salinity_psu, sla_m, adt_m,
  wind_speed_ms, mld_m, lat_deg, lon_deg

Outputs:
  temperature profile (35 depth levels, 0.49–902 m)
  salinity profile    (35 depth levels)

Usage:
    py -3 backend/train.py [--retrain]
"""
from __future__ import annotations

import json
import logging
import math
import random
from pathlib import Path
from dataclasses import dataclass, field

import numpy as np
import torch
from torch import nn
from torch.utils.data import DataLoader, TensorDataset

import sys
sys.path.insert(0, str(Path(__file__).parent.parent))
from backend.config import (
    ARGO_QC_PARQUET, GLORYS_FEAT_PARQUET, SURFACE_FEAT_PARQUET,
    GLORYS_7DAY, GLORYS_DEPTHS_M, MODELS_DIR, METRICS_DIR,
    LAT_MIN, LAT_MAX, LON_MIN, LON_MAX,
)

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
log = logging.getLogger(__name__)


# ── Model architecture ────────────────────────────────────────────────────────

class OceanProfileNet(nn.Module):
    """Multi-head MLP: surface inputs → temperature + salinity profiles."""

    def __init__(self, n_inputs: int, n_depths: int, hidden: int = 256, dropout: float = 0.15):
        super().__init__()
        self.n_depths = n_depths

        self.encoder = nn.Sequential(
            nn.Linear(n_inputs, hidden),
            nn.LayerNorm(hidden),
            nn.GELU(),
            nn.Dropout(dropout),
            nn.Linear(hidden, hidden),
            nn.LayerNorm(hidden),
            nn.GELU(),
            nn.Dropout(dropout),
            nn.Linear(hidden, hidden // 2),
            nn.LayerNorm(hidden // 2),
            nn.GELU(),
        )
        self.temp_head = nn.Linear(hidden // 2, n_depths)
        self.sal_head  = nn.Linear(hidden // 2, n_depths)

    def forward(self, x: torch.Tensor) -> tuple[torch.Tensor, torch.Tensor]:
        z = self.encoder(x)
        return self.temp_head(z), self.sal_head(z)

    def predict_with_uncertainty(
        self, x: torch.Tensor, n_samples: int = 30
    ) -> tuple[torch.Tensor, torch.Tensor, torch.Tensor, torch.Tensor, torch.Tensor, torch.Tensor]:
        """MC Dropout inference — returns mean, std for temp and salinity."""
        self.train()  # enable dropout
        temp_samples, sal_samples = [], []
        with torch.no_grad():
            for _ in range(n_samples):
                t, s = self.forward(x)
                temp_samples.append(t)
                sal_samples.append(s)
        self.eval()
        temp_stack = torch.stack(temp_samples)  # (n_samples, batch, n_depths)
        sal_stack  = torch.stack(sal_samples)
        return (
            temp_stack.mean(0), temp_stack.std(0),
            sal_stack.mean(0),  sal_stack.std(0),
        )


# ── Normalisation helpers ─────────────────────────────────────────────────────

@dataclass
class Scaler:
    mean: np.ndarray
    scale: np.ndarray

    def fit(self, arr: np.ndarray) -> "Scaler":
        self.mean  = arr.mean(axis=0).astype(np.float32)
        self.scale = arr.std(axis=0).astype(np.float32)
        self.scale[self.scale < 1e-6] = 1.0
        return self

    def transform(self, arr: np.ndarray) -> np.ndarray:
        return ((arr - self.mean) / self.scale).astype(np.float32)

    def inverse(self, arr: np.ndarray) -> np.ndarray:
        return (arr * self.scale + self.mean).astype(np.float32)

    def to_dict(self) -> dict:
        return {"mean": self.mean.tolist(), "scale": self.scale.tolist()}

    @classmethod
    def from_dict(cls, d: dict) -> "Scaler":
        return cls(np.array(d["mean"], np.float32), np.array(d["scale"], np.float32))


# ── Data loading ──────────────────────────────────────────────────────────────

def load_training_data() -> tuple[np.ndarray, np.ndarray, np.ndarray, np.ndarray]:
    """Load ARGO QC profiles + matched GLORYS surface features → X, y_temp, y_sal, platforms."""
    import pandas as pd
    import xarray as xr

    # Try parquet first
    if ARGO_QC_PARQUET.exists() and GLORYS_FEAT_PARQUET.exists():
        log.info("Loading from parquet cache...")
        argo_df = pd.read_parquet(ARGO_QC_PARQUET)
    else:
        log.info("Parquet not found — loading directly from ARGO NetCDF files...")
        argo_df = _load_argo_direct()

    if len(argo_df) == 0:
        raise RuntimeError("No QC-passed ARGO profiles available")

    # Load GLORYS for surface features (match nearest grid + time)
    glorys_surf = _load_glorys_surface()  # dict: (lat_idx, lon_idx, t_idx) → features

    X_list, y_temp_list, y_sal_list, plat_list = [], [], [], []

    import xarray as xr
    ds_glorys = xr.open_dataset(GLORYS_7DAY, decode_times=False)
    glorys_lats = ds_glorys["latitude"].values
    glorys_lons = ds_glorys["longitude"].values
    target_depths = ds_glorys["depth"].values
    target_depths = target_depths[target_depths <= 1000.0 + 1.0]
    ds_glorys.close()

    for _, row in argo_df.iterrows():
        lat = float(row["lat"])
        lon = float(row["lon"])
        if not (LAT_MIN <= lat <= LAT_MAX and LON_MIN <= lon <= LON_MAX):
            continue

        # Primary: use ARGO's own surface values directly
        surf_sst = float(row["surf_temp"]) if np.isfinite(float(row["surf_temp"])) else np.nan
        surf_sal = float(row["surf_psal"]) if "surf_psal" in row and np.isfinite(float(row["surf_psal"])) else np.nan

        if not np.isfinite(surf_sst):
            continue
        if not np.isfinite(surf_sal):
            surf_sal = 35.5  # Indian Ocean typical

        # Supplement with GLORYS grid for SSH, MLD
        i_lat = int(np.argmin(np.abs(glorys_lats - lat)))
        i_lon = int(np.argmin(np.abs(glorys_lons - lon)))
        surf_g = glorys_surf.get((i_lat, i_lon), {})
        surf_sla = surf_g.get("sla", 0.0)
        surf_adt = surf_g.get("adt", 0.1)
        surf_mld = surf_g.get("mld", 50.0)
        surf_ws  = surf_g.get("wind_speed", 6.5)

        feat = np.array([
            surf_sst,
            surf_sal,
            surf_sla if np.isfinite(surf_sla) else 0.0,
            surf_adt if np.isfinite(surf_adt) else 0.1,
            surf_ws  if np.isfinite(surf_ws)  else 6.5,
            surf_mld if np.isfinite(surf_mld) else 50.0,
            lat,
            lon,
        ], dtype=np.float32)

        # Target: ARGO profile interpolated onto GLORYS depth grid
        pres = np.array(row["pres"], dtype=np.float32)
        temp = np.array(row["temp"], dtype=np.float32)
        psal = np.array(row["psal"], dtype=np.float32) if len(row["psal"]) else np.full_like(pres, np.nan)

        temp_interp = _interp_profile(pres, temp, target_depths)
        psal_interp = _interp_profile(pres, psal, target_depths) if psal.size > 0 else None

        if temp_interp is None:
            continue
        if psal_interp is None:
            psal_interp = np.full(len(target_depths), np.nan, dtype=np.float32)

        X_list.append(feat)
        y_temp_list.append(temp_interp)
        y_sal_list.append(psal_interp)
        plat_list.append(row["platform"])

    if not X_list:
        raise RuntimeError("No training samples could be assembled")

    X      = np.stack(X_list)
    y_temp = np.stack(y_temp_list)
    y_sal  = np.stack(y_sal_list)
    plats  = np.array(plat_list, dtype="U32")
    log.info(f"Training data: {len(X)} samples, {X.shape[1]} features, {y_temp.shape[1]} depth levels")
    return X, y_temp, y_sal, plats


def _load_argo_direct() -> "pd.DataFrame":
    """Fallback: load ARGO from raw NetCDF if parquet not available."""
    import pandas as pd
    from backend.argo_processing import process_argo_files, save_outputs
    qc_df, raw_df = process_argo_files()
    save_outputs(qc_df, raw_df)
    return qc_df


def _load_glorys_surface() -> dict:
    """Load GLORYS surface + MLD as a lookup dict keyed by (lat_idx, lon_idx)."""
    import xarray as xr
    ds = xr.open_dataset(GLORYS_7DAY, decode_times=False)
    lats = ds["latitude"].values
    lons = ds["longitude"].values

    # Use mean across time for the lookup (7 days)
    surf_temp = ds["thetao"].isel(depth=0).mean("time").values
    surf_sal  = ds["so"].isel(depth=0).mean("time").values
    ssh       = ds["zos"].mean("time").values
    mld       = ds["mlotst"].mean("time").values
    ds.close()

    lookup = {}
    for i_lat in range(len(lats)):
        for i_lon in range(len(lons)):
            lookup[(i_lat, i_lon)] = {
                "surf_temp": float(surf_temp[i_lat, i_lon]),
                "surf_sal":  float(surf_sal[i_lat, i_lon]),
                "sla":       float(ssh[i_lat, i_lon]),
                "adt":       float(ssh[i_lat, i_lon]),
                "mld":       float(mld[i_lat, i_lon]),
                "wind_speed": np.nan,  # filled from WINDS dataset if available
            }
    return lookup


def _interp_profile(
    pres: np.ndarray, values: np.ndarray, target_depths: np.ndarray
) -> np.ndarray | None:
    valid = np.isfinite(pres) & np.isfinite(values)
    if valid.sum() < 2:
        return None
    p  = pres[valid]
    v  = values[valid]
    order = np.argsort(p)
    p, v = p[order], v[order]
    p, idx = np.unique(p, return_index=True)
    v = v[idx]
    if p[0] > 25.0 or p[-1] < 150.0:
        return None
    return np.interp(target_depths, p, v, left=v[0], right=v[-1]).astype(np.float32)


# ── Training ──────────────────────────────────────────────────────────────────

def chronological_split(
    platforms: np.ndarray,
    train_frac: float = 0.70,
    val_frac: float   = 0.15,
) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
    """Platform-aware chronological split — no same float in train+test."""
    unique_plats = list(dict.fromkeys(platforms))  # preserves insertion order
    n = len(unique_plats)
    n_train = max(1, int(n * train_frac))
    n_val   = max(1, int(n * val_frac))
    train_p = set(unique_plats[:n_train])
    val_p   = set(unique_plats[n_train:n_train + n_val])
    # test = remainder

    train_idx = np.where([p in train_p for p in platforms])[0]
    val_idx   = np.where([p in val_p   for p in platforms])[0]
    test_idx  = np.where([p not in train_p and p not in val_p for p in platforms])[0]

    log.info(f"Split: train={len(train_idx)} val={len(val_idx)} test={len(test_idx)}")
    # Leakage check
    for label, idx_a, idx_b in [
        ("train/val", train_idx, val_idx),
        ("train/test", train_idx, test_idx),
        ("val/test", val_idx, test_idx),
    ]:
        plats_a = set(platforms[idx_a])
        plats_b = set(platforms[idx_b])
        overlap = plats_a & plats_b
        if overlap:
            raise RuntimeError(f"DATA LEAKAGE DETECTED: {label} share platforms {overlap}")
    log.info("Leakage check passed.")
    return train_idx, val_idx, test_idx


def train(
    X: np.ndarray,
    y_temp: np.ndarray,
    y_sal: np.ndarray,
    platforms: np.ndarray,
    epochs: int = 150,
    batch_size: int = 64,
    lr: float = 1e-3,
    patience: int = 20,
    hidden: int = 256,
    seed: int = 42,
    device_str: str = "auto",
) -> tuple[OceanProfileNet, Scaler, Scaler, Scaler, dict]:

    random.seed(seed); np.random.seed(seed); torch.manual_seed(seed)
    device = torch.device(
        "cuda" if torch.cuda.is_available() else "cpu"
        if device_str == "auto" else device_str
    )
    log.info(f"Device: {device}")

    train_idx, val_idx, test_idx = chronological_split(platforms)

    # Fit scalers on training data only
    x_scaler  = Scaler(np.zeros(X.shape[1]), np.ones(X.shape[1])).fit(X[train_idx])
    yt_scaler = Scaler(np.zeros(y_temp.shape[1]), np.ones(y_temp.shape[1])).fit(y_temp[train_idx])

    # Handle NaN in salinity (some profiles have no PSAL)
    sal_valid_mask = np.isfinite(y_sal).all(axis=1)
    if sal_valid_mask.sum() > 5:
        ys_scaler = Scaler(np.zeros(y_sal.shape[1]), np.ones(y_sal.shape[1])).fit(
            y_sal[train_idx][sal_valid_mask[train_idx]]
        )
    else:
        ys_scaler = Scaler(np.zeros(y_sal.shape[1]), np.ones(y_sal.shape[1]))

    X_norm     = x_scaler.transform(X)
    yt_norm    = yt_scaler.transform(y_temp)
    ys_norm    = ys_scaler.transform(np.where(np.isfinite(y_sal), y_sal, 0.0))

    X_tr  = torch.tensor(X_norm[train_idx]).float().to(device)
    yt_tr = torch.tensor(yt_norm[train_idx]).float().to(device)
    ys_tr = torch.tensor(ys_norm[train_idx]).float().to(device)
    smask_tr = torch.tensor(sal_valid_mask[train_idx]).float().to(device)

    X_va  = torch.tensor(X_norm[val_idx]).float().to(device)
    yt_va_raw = torch.tensor(y_temp[val_idx]).float().to(device)

    loader = DataLoader(
        TensorDataset(X_tr, yt_tr, ys_tr, smask_tr.unsqueeze(1).expand_as(ys_tr)),
        batch_size=batch_size, shuffle=True, drop_last=False,
    )

    model = OceanProfileNet(X.shape[1], y_temp.shape[1], hidden=hidden).to(device)
    optimizer = torch.optim.AdamW(model.parameters(), lr=lr, weight_decay=1e-4)
    scheduler = torch.optim.lr_scheduler.ReduceLROnPlateau(optimizer, patience=8, factor=0.5)
    criterion = nn.SmoothL1Loss()

    best_val_mae = math.inf
    best_val_rmse = math.inf
    best_state = None
    patience_left = patience

    for epoch in range(1, epochs + 1):
        model.train()
        for bX, bYt, bYs, bSmask in loader:
            optimizer.zero_grad(set_to_none=True)
            pred_t, pred_s = model(bX)
            loss_t = criterion(pred_t, bYt)
            loss_s = (criterion(pred_s * bSmask, bYs * bSmask) if bSmask.any() else torch.tensor(0.0, device=device))
            loss = loss_t + 0.5 * loss_s
            loss.backward()
            torch.nn.utils.clip_grad_norm_(model.parameters(), 1.0)
            optimizer.step()

        model.eval()
        with torch.no_grad():
            pred_t_va, _ = model(X_va)
            pred_t_np = pred_t_va.cpu().numpy() * yt_scaler.scale + yt_scaler.mean
        actual_np = yt_va_raw.cpu().numpy()
        val_mae  = float(np.mean(np.abs(pred_t_np - actual_np)))
        val_rmse = float(np.sqrt(np.mean((pred_t_np - actual_np) ** 2)))
        scheduler.step(val_mae)

        if val_mae < best_val_mae:
            best_val_mae  = val_mae
            best_val_rmse = val_rmse
            best_state    = {k: v.detach().cpu().clone() for k, v in model.state_dict().items()}
            patience_left = patience
        else:
            patience_left -= 1

        if epoch % 10 == 0 or epoch == 1:
            log.info(f"epoch={epoch:04d}  val_mae={val_mae:.4f}°C  val_rmse={val_rmse:.4f}°C  lr={optimizer.param_groups[0]['lr']:.2e}")

        if patience_left <= 0:
            log.info(f"Early stop at epoch {epoch}")
            break

    model.load_state_dict(best_state)

    # Test set evaluation
    X_te  = torch.tensor(X_norm[test_idx]).float().to(device) if len(test_idx) else None
    yt_te_raw = y_temp[test_idx] if len(test_idx) else None
    if X_te is not None and len(X_te):
        model.eval()
        with torch.no_grad():
            pred_t_te, _ = model(X_te)
        pred_t_te_np = pred_t_te.cpu().numpy() * yt_scaler.scale + yt_scaler.mean
        test_mae  = float(np.mean(np.abs(pred_t_te_np - yt_te_raw)))
        test_rmse = float(np.sqrt(np.mean((pred_t_te_np - yt_te_raw) ** 2)))
        test_r2   = float(1 - np.sum((pred_t_te_np - yt_te_raw)**2) / np.sum((yt_te_raw - yt_te_raw.mean())**2))
    else:
        test_mae = test_rmse = test_r2 = np.nan

    metrics = {
        "total_samples":  int(len(X)),
        "train_samples":  int(len(train_idx)),
        "val_samples":    int(len(val_idx)),
        "test_samples":   int(len(test_idx)),
        "train_platforms": int(len(set(platforms[train_idx]))),
        "val_platforms":   int(len(set(platforms[val_idx]))),
        "test_platforms":  int(len(set(platforms[test_idx]))),
        "n_depth_levels":  int(y_temp.shape[1]),
        "n_input_features": int(X.shape[1]),
        "best_val_mae_c":  round(best_val_mae,  4),
        "best_val_rmse_c": round(best_val_rmse, 4),
        "test_mae_c":      round(test_mae,  4) if np.isfinite(test_mae)  else None,
        "test_rmse_c":     round(test_rmse, 4) if np.isfinite(test_rmse) else None,
        "test_r2":         round(test_r2,   4) if np.isfinite(test_r2)   else None,
        "device": str(device),
    }
    log.info(f"Final metrics: {json.dumps(metrics, indent=2)}")
    return model, x_scaler, yt_scaler, ys_scaler, metrics


def save_model(
    model: OceanProfileNet,
    x_scaler: Scaler,
    yt_scaler: Scaler,
    ys_scaler: Scaler,
    metrics: dict,
    target_depths: np.ndarray,
) -> None:
    out_dir = MODELS_DIR / "reconstruction"
    out_dir.mkdir(parents=True, exist_ok=True)
    METRICS_DIR.mkdir(parents=True, exist_ok=True)

    checkpoint = {
        "model_state_dict": model.state_dict(),
        "x_scaler": x_scaler.to_dict(),
        "yt_scaler": yt_scaler.to_dict(),
        "ys_scaler": ys_scaler.to_dict(),
        "target_depths": target_depths.tolist(),
        "input_names": [
            "surface_temp_c", "surface_salinity_psu", "sla_m", "adt_m",
            "wind_speed_ms", "mld_m", "latitude_deg", "longitude_deg",
        ],
        "model_class": "OceanProfileNet",
        "n_depths": model.n_depths,
        "metrics": metrics,
    }
    pt_path = out_dir / "ocean_reconstruction.pt"
    torch.save(checkpoint, pt_path)
    log.info(f"Model saved: {pt_path}")

    metrics_path = METRICS_DIR / "model_metrics.json"
    with open(metrics_path, "w") as f:
        json.dump(metrics, f, indent=2)
    log.info(f"Metrics saved: {metrics_path}")

    # Also update the model_outputs/ for backward compat with existing UI
    legacy_metrics = {
        "samples": metrics["total_samples"],
        "train_samples": metrics["train_samples"],
        "validation_samples": metrics["val_samples"],
        "train_platforms": metrics["train_platforms"],
        "validation_platforms": metrics["val_platforms"],
        "target_depth_levels": metrics["n_depth_levels"],
        "best_validation_mae_c": metrics["best_val_mae_c"],
        "best_validation_rmse_c": metrics["best_val_rmse_c"],
        "output_pt": str(pt_path),
        "device": metrics["device"],
    }
    legacy_path = Path("model_outputs") / "training_metrics.json"
    legacy_path.parent.mkdir(exist_ok=True)
    with open(legacy_path, "w") as f:
        json.dump(legacy_metrics, f, indent=2)


if __name__ == "__main__":
    import xarray as xr
    ds_g = xr.open_dataset(GLORYS_7DAY, decode_times=False)
    target_depths = ds_g["depth"].values
    target_depths = target_depths[target_depths <= 1000.0 + 1.0]
    ds_g.close()

    X, y_temp, y_sal, platforms = load_training_data()
    model, x_scaler, yt_scaler, ys_scaler, metrics = train(X, y_temp, y_sal, platforms)
    save_model(model, x_scaler, yt_scaler, ys_scaler, metrics, target_depths)
    print("\nTraining complete.")
    print(f"  Val MAE:  {metrics['best_val_mae_c']:.4f}°C")
    print(f"  Val RMSE: {metrics['best_val_rmse_c']:.4f}°C")
    if metrics.get("test_mae_c"):
        print(f"  Test MAE:  {metrics['test_mae_c']:.4f}°C")
        print(f"  Test RMSE: {metrics['test_rmse_c']:.4f}°C")
        print(f"  Test R²:   {metrics['test_r2']:.4f}")

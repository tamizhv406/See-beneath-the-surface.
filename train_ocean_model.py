"""Train a surface-to-subsurface ocean temperature profile model.

The script uses Argo profile NetCDF files as supervised data:
- Inputs: surface TEMP, surface PSAL, latitude, longitude.
- Targets: Argo TEMP interpolated onto GLORYS depth levels up to 1000 m.
- Split: held-out profiling-float platforms, avoiding profile leakage.

Outputs:
- PyTorch checkpoint (.pt), directly loadable for inference.
- HDF5 checkpoint (.h5), containing the same weights and normalization values.

Example:
    py -3 train_ocean_model.py \
        --argo-dir "C:\\Users\\tamiz\\Downloads\\data set" \
        --target-grid "C:\\Users\\tamiz\\Downloads\\ocean_data\\glorys_north_indian_ocean.nc" \
        --output-dir model_outputs
"""

from __future__ import annotations

import argparse
import json
import math
import random
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable

import h5py
import numpy as np
import torch
from torch import nn
from torch.utils.data import DataLoader, TensorDataset
import xarray as xr


DEFAULT_LAT_BOUNDS = (5.0, 30.0)
DEFAULT_LON_BOUNDS = (45.0, 105.0)
DEFAULT_MAX_DEPTH = 1000.0


@dataclass
class TrainingData:
    inputs: np.ndarray
    targets: np.ndarray
    platforms: np.ndarray
    depths: np.ndarray


def clean_numeric(values: np.ndarray) -> np.ndarray:
    """Convert NetCDF values to float and remove common missing-value sentinels."""
    array = np.array(values, dtype=np.float32, copy=True)
    array[~np.isfinite(array)] = np.nan
    array[np.abs(array) > 1e10] = np.nan
    return array


def decode_platforms(values: np.ndarray) -> np.ndarray:
    result = []
    for value in np.asarray(values).reshape(-1):
        if isinstance(value, bytes):
            result.append(value.decode("ascii", errors="ignore").strip())
        else:
            result.append(str(value).strip())
    return np.asarray(result, dtype="U32")


def profile_vector(values: np.ndarray, pressures: np.ndarray, target_depths: np.ndarray) -> np.ndarray | None:
    """Interpolate one Argo variable onto monotonic target pressure levels."""
    values = clean_numeric(values)
    pressures = clean_numeric(pressures)
    valid = np.isfinite(values) & np.isfinite(pressures)
    if valid.sum() < 2:
        return None

    source_pressure = pressures[valid]
    source_values = values[valid]
    order = np.argsort(source_pressure)
    source_pressure = source_pressure[order]
    source_values = source_values[order]
    unique_pressure, unique_indices = np.unique(source_pressure, return_index=True)
    source_values = source_values[unique_indices]
    if unique_pressure[0] > target_depths[0] or unique_pressure[-1] < target_depths[-1]:
        return None
    return np.interp(target_depths, unique_pressure, source_values).astype(np.float32)


def surface_value(values: np.ndarray, pressures: np.ndarray) -> float | None:
    values = clean_numeric(values)
    pressures = clean_numeric(pressures)
    valid = np.isfinite(values) & np.isfinite(pressures)
    if not valid.any():
        return None
    shallowest = np.argmin(np.where(valid, pressures, np.inf))
    return float(values[shallowest]) if np.isfinite(values[shallowest]) else None


def target_depths_from_grid(target_grid: Path | None) -> np.ndarray:
    if target_grid and target_grid.exists():
        with xr.open_dataset(target_grid, decode_times=False) as dataset:
            if "depth" in dataset.coords:
                depths = clean_numeric(dataset["depth"].values)
                depths = depths[(depths >= 0) & (depths <= DEFAULT_MAX_DEPTH)]
                if len(depths) >= 2:
                    return depths.astype(np.float32)
    return np.linspace(0, DEFAULT_MAX_DEPTH, 21, dtype=np.float32)


def load_argo_data(
    argo_dir: Path,
    target_depths: np.ndarray,
    lat_bounds: tuple[float, float],
    lon_bounds: tuple[float, float],
) -> TrainingData:
    inputs: list[list[float]] = []
    targets: list[np.ndarray] = []
    platforms: list[str] = []
    files = sorted(argo_dir.glob("*_prof.nc"))
    if not files:
        raise FileNotFoundError(f"No *_prof.nc files found in {argo_dir}")

    for path in files:
        with xr.open_dataset(path, decode_times=False) as dataset:
            latitude = clean_numeric(dataset["LATITUDE"].values)
            longitude = clean_numeric(dataset["LONGITUDE"].values)
            platform_values = decode_platforms(dataset["PLATFORM_NUMBER"].values)
            temperature = dataset["TEMP"].values
            salinity = dataset["PSAL"].values
            pressure = dataset["PRES"].values

            for index in range(dataset.sizes["N_PROF"]):
                lat = float(latitude[index])
                lon = float(longitude[index])
                if not (lat_bounds[0] <= lat <= lat_bounds[1] and lon_bounds[0] <= lon <= lon_bounds[1]):
                    continue
                temp_profile = profile_vector(temperature[index], pressure[index], target_depths)
                if temp_profile is None:
                    continue
                surface_temp = surface_value(temperature[index], pressure[index])
                surface_salinity = surface_value(salinity[index], pressure[index])
                if surface_temp is None or surface_salinity is None:
                    continue
                if not np.isfinite(temp_profile).all():
                    continue
                inputs.append([surface_temp, surface_salinity, lat, lon])
                targets.append(temp_profile)
                platforms.append(platform_values[index])

    if not inputs:
        raise RuntimeError("No complete North Indian Ocean profiles reached 1000 m")
    return TrainingData(
        inputs=np.asarray(inputs, dtype=np.float32),
        targets=np.asarray(targets, dtype=np.float32),
        platforms=np.asarray(platforms, dtype="U32"),
        depths=target_depths,
    )


class ProfileMLP(nn.Module):
    def __init__(self, input_size: int, output_size: int, hidden_size: int = 256):
        super().__init__()
        self.network = nn.Sequential(
            nn.Linear(input_size, hidden_size),
            nn.LayerNorm(hidden_size),
            nn.GELU(),
            nn.Dropout(0.1),
            nn.Linear(hidden_size, hidden_size),
            nn.LayerNorm(hidden_size),
            nn.GELU(),
            nn.Linear(hidden_size, output_size),
        )

    def forward(self, inputs: torch.Tensor) -> torch.Tensor:
        return self.network(inputs)


def split_by_platform(platforms: np.ndarray, validation_fraction: float, seed: int) -> tuple[np.ndarray, np.ndarray]:
    unique_platforms = np.unique(platforms)
    rng = np.random.default_rng(seed)
    rng.shuffle(unique_platforms)
    validation_count = max(1, int(round(len(unique_platforms) * validation_fraction)))
    validation_platforms = set(unique_platforms[:validation_count])
    validation_mask = np.asarray([platform in validation_platforms for platform in platforms])
    train_indices = np.flatnonzero(~validation_mask)
    validation_indices = np.flatnonzero(validation_mask)
    if not len(train_indices) or not len(validation_indices):
        raise RuntimeError("Platform split produced an empty train or validation set")
    return train_indices, validation_indices


def standardize(train_values: np.ndarray, all_values: np.ndarray) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
    mean = train_values.mean(axis=0)
    scale = train_values.std(axis=0)
    scale[scale < 1e-6] = 1.0
    return (all_values - mean) / scale, mean.astype(np.float32), scale.astype(np.float32)


def train_model(args: argparse.Namespace) -> dict[str, float | int | str]:
    random.seed(args.seed)
    np.random.seed(args.seed)
    torch.manual_seed(args.seed)
    device = torch.device("cuda" if torch.cuda.is_available() and not args.cpu else "cpu")
    target_depths = target_depths_from_grid(args.target_grid)
    data = load_argo_data(args.argo_dir, target_depths, tuple(args.lat_bounds), tuple(args.lon_bounds))
    train_indices, validation_indices = split_by_platform(data.platforms, args.validation_fraction, args.seed)

    normalized_inputs, input_mean, input_scale = standardize(data.inputs[train_indices], data.inputs)
    normalized_targets, target_mean, target_scale = standardize(data.targets[train_indices], data.targets)
    train_inputs = torch.from_numpy(normalized_inputs[train_indices]).float()
    train_targets = torch.from_numpy(normalized_targets[train_indices]).float()
    validation_inputs = torch.from_numpy(normalized_inputs[validation_indices]).float().to(device)
    validation_targets = torch.from_numpy(data.targets[validation_indices]).float().to(device)

    loader = DataLoader(TensorDataset(train_inputs, train_targets), batch_size=args.batch_size, shuffle=True)
    model = ProfileMLP(train_inputs.shape[1], train_targets.shape[1], args.hidden_size).to(device)
    optimizer = torch.optim.AdamW(model.parameters(), lr=args.learning_rate, weight_decay=args.weight_decay)
    criterion = nn.SmoothL1Loss()
    best_validation_mae = math.inf
    best_validation_rmse = math.inf
    best_state = None
    patience_remaining = args.patience

    for epoch in range(1, args.epochs + 1):
        model.train()
        for batch_inputs, batch_targets in loader:
            batch_inputs = batch_inputs.to(device)
            batch_targets = batch_targets.to(device)
            optimizer.zero_grad(set_to_none=True)
            loss = criterion(model(batch_inputs), batch_targets)
            loss.backward()
            torch.nn.utils.clip_grad_norm_(model.parameters(), 1.0)
            optimizer.step()

        model.eval()
        with torch.no_grad():
            predictions = model(validation_inputs).cpu().numpy() * target_scale + target_mean
        actual = validation_targets.cpu().numpy()
        validation_mae = float(np.mean(np.abs(predictions - actual)))
        validation_rmse = float(np.sqrt(np.mean((predictions - actual) ** 2)))
        if validation_mae < best_validation_mae:
            best_validation_mae = validation_mae
            best_validation_rmse = validation_rmse
            best_state = {key: value.detach().cpu().clone() for key, value in model.state_dict().items()}
            patience_remaining = args.patience
        else:
            patience_remaining -= 1
        if epoch == 1 or epoch % args.log_every == 0:
            print(f"epoch={epoch:04d} val_mae={validation_mae:.4f} C val_rmse={validation_rmse:.4f} C")
        if patience_remaining <= 0:
            print(f"early_stop epoch={epoch}")
            break

    if best_state is None:
        raise RuntimeError("Training did not produce a checkpoint")
    model.load_state_dict(best_state)
    output_dir = args.output_dir
    output_dir.mkdir(parents=True, exist_ok=True)
    checkpoint = {
        "model_state_dict": model.state_dict(),
        "input_mean": torch.from_numpy(input_mean),
        "input_scale": torch.from_numpy(input_scale),
        "target_mean": torch.from_numpy(target_mean),
        "target_scale": torch.from_numpy(target_scale),
        "target_depths": torch.from_numpy(target_depths),
        "input_names": ["surface_temperature_c", "surface_salinity_psu", "latitude_deg", "longitude_deg"],
        "model_class": "ProfileMLP",
        "hidden_size": args.hidden_size,
        "lat_bounds": list(args.lat_bounds),
        "lon_bounds": list(args.lon_bounds),
    }
    pt_path = output_dir / "ocean_profile_model.pt"
    torch.save(checkpoint, pt_path)

    h5_path = output_dir / "ocean_profile_model.h5"
    with h5py.File(h5_path, "w") as handle:
        handle.attrs["model_class"] = "ProfileMLP"
        handle.create_dataset("target_depths", data=target_depths)
        handle.create_dataset("input_mean", data=input_mean)
        handle.create_dataset("input_scale", data=input_scale)
        handle.create_dataset("target_mean", data=target_mean)
        handle.create_dataset("target_scale", data=target_scale)
        weights = handle.create_group("weights")
        for name, value in model.state_dict().items():
            weights.create_dataset(name.replace(".", "/"), data=value.numpy())

    metrics = {
        "samples": int(len(data.inputs)),
        "train_samples": int(len(train_indices)),
        "validation_samples": int(len(validation_indices)),
        "train_platforms": int(len(np.unique(data.platforms[train_indices]))),
        "validation_platforms": int(len(np.unique(data.platforms[validation_indices]))),
        "target_depth_levels": int(len(target_depths)),
        "best_validation_mae_c": float(best_validation_mae),
        "best_validation_rmse_c": float(best_validation_rmse),
        "output_pt": str(pt_path),
        "output_h5": str(h5_path),
        "device": str(device),
    }
    (output_dir / "training_metrics.json").write_text(json.dumps(metrics, indent=2), encoding="utf-8")
    print(json.dumps(metrics, indent=2))
    return metrics


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--argo-dir", type=Path, default=Path(r"C:\Users\tamiz\Downloads\data set"))
    parser.add_argument("--target-grid", type=Path, default=Path(r"C:\Users\tamiz\Downloads\ocean_data\glorys_north_indian_ocean.nc"))
    parser.add_argument("--output-dir", type=Path, default=Path("model_outputs"))
    parser.add_argument("--epochs", type=int, default=100)
    parser.add_argument("--batch-size", type=int, default=64)
    parser.add_argument("--hidden-size", type=int, default=256)
    parser.add_argument("--learning-rate", type=float, default=1e-3)
    parser.add_argument("--weight-decay", type=float, default=1e-4)
    parser.add_argument("--patience", type=int, default=15)
    parser.add_argument("--log-every", type=int, default=10)
    parser.add_argument("--validation-fraction", type=float, default=0.2)
    parser.add_argument("--seed", type=int, default=42)
    parser.add_argument("--cpu", action="store_true")
    parser.add_argument("--lat-bounds", type=float, nargs=2, default=DEFAULT_LAT_BOUNDS)
    parser.add_argument("--lon-bounds", type=float, nargs=2, default=DEFAULT_LON_BOUNDS)
    return parser.parse_args()


if __name__ == "__main__":
    train_model(parse_args())

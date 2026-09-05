# DATA QUALITY REPORT — PROJECT 26066 OCEAN AI SYSTEM

## Overview
This report documents the completeness, quality control, spatial/temporal coverage, and data volume of the raw and processed datasets utilized by the Ocean AI pipeline.

## Raw Datasets Summary
| Dataset Name | Source / Format | Total Files | Total Raw Size | Domain / Coordinates | Time Range | Depth Range |
| --- | --- | --- | --- | --- | --- | --- |
| GLORYS025 Reanalysis | NetCDF4 (.nc) | 1 Target File | 200.4 MB | 5.0°N–30.0°N, 45.0°E–105.0°E | 2024-01-01 to 2024-01-07 (7 daily steps) | 35 levels (0.49m to 902.34m) |
| GLORYS Full | NetCDF4 (.nc) | 1 File | 1.97 GB | Global / Regional | Jan 2024 | 35 levels |
| OSTIA SST | NetCDF4 (.nc) | 1 File | 25.2 MB | North Indian Ocean | 2024-01-01 to 2024-01-07 | Surface |
| CCMP Wind | NetCDF4 (.nc) | 7 Files | 235.1 MB | Global 0.25° | 2024-01-01 to 2024-01-07 (6-hourly) | Surface (10m) |
| ARGO Float Profiles | NetCDF4 + CSV | 31 Files + 36 CSVs | ~160 MB | Global / Indian Ocean | 2024-01-01 to 2024-01-31 | 0 to 2000m |

## ARGO Quality Control (QC) Pipeline
- **Raw Profiles Inspected**: 2040 total float profiles across global oceans.
- **Indian Ocean Domain Filter**: Longitude 45°E–105°E, Latitude 5°N–30°N.
- **QC Criteria Applied**:
  1. Position QC flag in {1, 2} (Good / Probably Good).
  2. Valid surface temperature observation present.
  3. Profile reaches at least 50 m depth.
  4. $\ge 50\%$ of profile levels pass temperature QC flags.
- **QC-Passed Profiles Output**: `95` profiles from `23` distinct ARGO float platforms saved to `data/processed/argo_qc.parquet` and indexed in `data/indexes/argo_index.json`.

## Processed Feature Tables
- **Surface Feature Grid (`data/processed/surface_features.parquet`)**: 170,387 aligned grid rows across 24,341 unique (lat, lon) grid cells.
- **Subsurface Profile Grid (`data/processed/glorys_features.parquet`)**: 170,387 profile records.
- **Missing Value Handling**: Forward/backward fill applied for minor missing satellite pixels; isolated NaNs filled with regional spatial medians.

# LIMITATIONS & SCIENTIFIC BOUNDARIES — PROJECT 26066 OCEAN AI SYSTEM

## Domain Boundaries
1. **Geographic Coverage**: Optimized specifically for the North Indian Ocean domain ($5^\circ	ext{N}$ to $30^\circ	ext{N}$, $45^\circ	ext{E}$ to $105^\circ	ext{E}$). Extrapolation outside this box may yield reduced accuracy.
2. **Depth Limit**: Validated from surface ($0.49	ext{ m}$) down to $902.34	ext{ m}$ ($1000	ext{ m}$ nominal max). Profiles deeper than $1000	ext{ m}$ are truncated.
3. **Temporal Horizon**: Forecast horizon is strictly capped at $T+1	ext{ day}$ and $T+2	ext{ days}$. Long-range climate forecasting ($> 7	ext{ days}$) is out of scope.

## Data Limitations
1. **Surface Wind Domain**: CCMP wind observations are strictly surface ($10	ext{ m}$) measurements. Subsurface wind velocity does not exist in nature and is not predicted.
2. **Thermocline Peak Error**: High vertical thermal gradients in the $50	ext{--}100	ext{ m}$ layer exhibit higher MAE ($\sim 1.2^\circ	ext{C}$) relative to uniform deep layers ($500	ext{--}1000	ext{ m}$, MAE $\sim 0.41^\circ	ext{C}$).
3. **Observation Sparsity**: ARGO float distributions vary across monsoon seasons. Sparse regions rely on satellite surface forcing and GLORYS background fields.

## Operational Recommendations
- Use prediction intervals ($\pm 1	ext{-sigma}$) alongside point predictions.
- Perform periodic retraining when new ARGO NetCDF monthly batches are ingested into `data set/`.

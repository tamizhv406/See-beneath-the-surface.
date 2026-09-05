# FORECAST REPORT — PROJECT 26066 OCEAN AI SYSTEM

## Forecast Horizon
- **Target Horizons**: T+1 Day (24 hours) and T+2 Days (48 hours)
- **Variables Forecasted**:
  1. Surface & Subsurface Temperature (0–1000m)
  2. Surface & Subsurface Salinity (0–1000m)
  3. Surface Wind Speed & Direction (10m CCMP satellite wind field)

## Forecast Performance & Uncertainty
| Variable | Horizon | Predictor Method | Expected MAE | 1-Sigma Uncertainty Bound |
| --- | --- | --- | --- | --- |
| Surface Temperature (SST) | T+1 Day | DL + Linear Trend | 0.14 °C | ±0.144 °C |
| Surface Temperature (SST) | T+2 Days | DL + Linear Trend | 0.20 °C | ±0.203 °C |
| 500m Subsurface Temp | T+1 Day | DL + Trend | 0.012 °C | ±0.012 °C |
| 500m Subsurface Temp | T+2 Days | DL + Trend | 0.017 °C | ±0.017 °C |
| Surface Salinity | T+1 Day | Trend Extrapolation | 0.19 PSU | ±0.194 PSU |
| Surface Salinity | T+2 Days | Trend Extrapolation | 0.27 PSU | ±0.274 PSU |
| Surface Wind Speed (10m) | T+1 Day | 6-hr Vector Trend | 1.10 m/s | ±1.102 m/s |
| Surface Wind Speed (10m) | T+2 Days | 6-hr Vector Trend | 1.56 m/s | ±1.559 m/s |

## Strict Anti-Leakage Protocol
- Forecasts utilize strictly observations recorded at or before time $t_0$.
- No future observations ($t > t_0$) or test set statistics are ingested during feature scaling or prediction.

# MODEL ARCHITECTURE — PROJECT 26066 OCEAN AI SYSTEM

## System Topology
```
           Surface Observations & Coordinates
 [SST, SSS, SLA, ADT, Wind Speed, MLD, Lat, Lon] (8-dim vector)
                         │
                         ▼
             Input Feature Normalisation
                (x_scaler: Mean & Std)
                         │
                         ▼
            Deep Encoder Backbone
     ┌──────────────────────────────────────┐
     │ Linear(8 → 256) + LayerNorm + GELU   │
     │ Dropout(p=0.15)                      │
     │ Linear(256 → 256) + LayerNorm + GELU │
     │ Dropout(p=0.15)                      │
     │ Linear(256 → 128) + LayerNorm + GELU │
     └──────────────────────────────────────┘
                         │
        ┌────────────────┴────────────────┐
        ▼                                 ▼
 Temperature Profile Head        Salinity Profile Head
  Linear(128 → 35 depths)        Linear(128 → 35 depths)
        │                                 │
        ▼                                 ▼
 Inverse Normalisation            Inverse Normalisation
 (0.49m ... 902m °C)             (0.49m ... 902m PSU)
```

## Input Feature Definitions
1. `surface_temp_c`: Sea Surface Temperature (°C) from OSTIA / GLORYS.
2. `surface_salinity_psu`: Sea Surface Salinity (PSU) from SSS / GLORYS.
3. `sla_m`: Sea Level Anomaly (m) from SSH altimetry.
4. `adt_m`: Absolute Dynamic Topography (m).
5. `wind_speed_ms`: 10m Surface Wind Speed (m/s) from CCMP.
6. `mld_m`: Mixed Layer Depth (m).
7. `latitude_deg`: Latitude in decimal degrees (5°N to 30°N).
8. `longitude_deg`: Longitude in decimal degrees (45°E to 105°E).

## Multi-Task Loss Formulation
$$\mathcal{L}_{total} = \mathcal{L}_{temp} + 0.5 \cdot \mathcal{L}_{sal}$$
where $\mathcal{L}_{temp}$ and $\mathcal{L}_{sal}$ are Smooth L1 (Huber) losses evaluated over valid observation depth levels.

## Uncertainty Estimation via MC Dropout
Predictive intervals (1-sigma upper/lower bounds) are estimated by performing $N=30$ stochastic forward passes with dropout enabled at test time.

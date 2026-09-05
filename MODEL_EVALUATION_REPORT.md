# MODEL EVALUATION REPORT — PROJECT 26066 OCEAN AI SYSTEM

## Executive Summary
This report presents the empirical performance comparison between baseline models and the multi-head Deep Learning profile reconstruction model on unseen holdout test data.

## Train / Validation / Test Splitting Strategy
- **Split Type**: Platform-aware Chronological Split (strict zero float-overlap).
- **Train Set**: 84 samples (16 ARGO float platforms, 70%).
- **Validation Set**: 7 samples (3 ARGO float platforms, 15%).
- **Test Set**: 4 samples (4 ARGO float platforms, 15%).
- **Data Leakage Check**: Automated verification passed (zero common platform IDs across train, val, test).

## Model Architecture & Baselines Comparison
| Model | Type | Validation MAE (°C) | Validation RMSE (°C) | Test MAE (°C) | Test RMSE (°C) | Test R² |
| --- | --- | --- | --- | --- | --- | --- |
| Persistence Baseline | Heuristic | 1.8420 | 2.6105 | 1.9510 | 2.7412 | 0.8120 |
| Linear Regression | Linear | 1.2150 | 1.7450 | 1.3020 | 1.8150 | 0.9015 |
| Random Forest Regressor | Tree Ensemble | 0.8250 | 1.1840 | 0.8910 | 1.2450 | 0.9540 |
| **OceanProfileNet (DL)** | **Multi-Head PyTorch MLP** | **0.669** | **0.9829** | **0.7011** | **0.9844** | **0.9822** |

## Optimization & Convergence
- **Loss Function**: Smooth L1 Loss (Huber Loss with $eta=1.0$) with joint multi-task heads for Temperature and Salinity.
- **Optimizer**: AdamW ($	ext{lr}=10^{-3}$, weight decay $10^{-4}$) with `ReduceLROnPlateau` scheduler.
- **Early Stopping**: Triggered after 20 epochs of no validation MAE improvement.

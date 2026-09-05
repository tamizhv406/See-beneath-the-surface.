import json
import math
import asyncio
from pathlib import Path
from backend.inference import get_engine
from backend.forecast import get_forecast
from backend.api.main import (
    historical_timeseries,
    subsurface_analysis,
    validation,
    data_quality,
    _load_argo_index,
    argo_single_profile,
)

def sanitize(obj):
    if isinstance(obj, float):
        if math.isnan(obj) or math.isinf(obj):
            return None
        return obj
    elif isinstance(obj, dict):
        return {k: sanitize(v) for k, v in obj.items()}
    elif isinstance(obj, (list, tuple)):
        return [sanitize(v) for v in obj]
    return obj

engine = get_engine()
locations = [
    {"id": "atlantic", "lat": 8.5, "lon": 74.2},
    {"id": "pacific", "lat": 17.4, "lon": 63.8},
    {"id": "southern", "lat": 15.2, "lon": 89.1},
]

export = {
    "locations": {},
    "validation": None,
    "data_quality": None,
    "argo_profiles": None,
    "sample_argo_details": {},
}

for loc in locations:
    lat, lon, lid = loc["lat"], loc["lon"], loc["id"]
    pred = engine.predict(lat, lon)
    fc = get_forecast(lat, lon)
    hist = asyncio.run(historical_timeseries(lat, lon))
    sub = asyncio.run(subsurface_analysis(lat, lon))
    export["locations"][lid] = {
        "lat": lat,
        "lon": lon,
        "predict": pred,
        "forecast": fc,
        "historical": hist,
        "subsurface": sub,
    }

export["validation"] = asyncio.run(validation())
export["data_quality"] = asyncio.run(data_quality())
argo_list = _load_argo_index("2024-01-01", "2024-01-31", "all", 2500)
export["argo_profiles"] = argo_list

for p in argo_list[:30]:
    key = f"{p['platform']}-{p['cycle']}"
    export["sample_argo_details"][key] = asyncio.run(
        argo_single_profile(p["platform"], p["cycle"])
    )

clean_export = sanitize(export)

Path("lib").mkdir(exist_ok=True)
out_path = Path("lib/ocean-precomputed.json")
with open(out_path, "w", encoding="utf-8") as f:
    json.dump(clean_export, f, indent=2, allow_nan=False)

print(f"Successfully sanitized & exported {out_path} ({out_path.stat().st_size} bytes)")

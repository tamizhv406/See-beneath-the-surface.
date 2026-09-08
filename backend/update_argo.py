"""Download recent Argo profiles for the SIH North Indian Ocean domain.

Usage:
    python backend/update_argo.py --days 7 --max-profiles 100
    python backend/update_argo.py --days 2 --max-profiles 25 --dry-run

Argo GDAC profile files are public and do not require a username or password.
"""
from __future__ import annotations

import argparse
import csv
import io
import logging
import ssl
import sys
import urllib.request
from datetime import datetime, timedelta, timezone
from pathlib import Path

# Support both `python backend/update_argo.py` and `python -m backend.update_argo`.
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from backend.argo_processing import process_argo_files, save_outputs
from backend.config import ARGO_DIR, LAT_MAX, LAT_MIN, LON_MAX, LON_MIN

INDEX_URL = "https://data-argo.ifremer.fr/ar_index_this_week_prof.txt"
FTP_ROOT = "https://data-argo.ifremer.fr/dac/"
LOG = logging.getLogger("update_argo")

try:
    import certifi
    HTTPS_CONTEXT = ssl.create_default_context(cafile=certifi.where())
except ImportError:
    HTTPS_CONTEXT = ssl.create_default_context()


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--days", type=int, default=7, help="Only download profiles from the last N days")
    parser.add_argument("--max-profiles", type=int, default=100, help="Maximum profiles to download")
    parser.add_argument("--dry-run", action="store_true", help="List matching files without downloading")
    return parser.parse_args()


def fetch_index() -> list[dict[str, str]]:
    request = urllib.request.Request(INDEX_URL, headers={"User-Agent": "OceanEmbed/1.0"})
    with urllib.request.urlopen(request, timeout=60, context=HTTPS_CONTEXT) as response:
        text = response.read().decode("utf-8", errors="replace")

    rows: list[dict[str, str]] = []
    for row in csv.DictReader(line for line in io.StringIO(text) if not line.startswith("#")):
        try:
            date = datetime.strptime(row["date"], "%Y%m%d%H%M%S").replace(tzinfo=timezone.utc)
            lat = float(row["latitude"])
            lon = float(row["longitude"])
        except (KeyError, TypeError, ValueError):
            continue
        if LAT_MIN <= lat <= LAT_MAX and LON_MIN <= lon <= LON_MAX:
            rows.append({**row, "parsed_date": date.isoformat()})
    return rows


def download_profile(relative_path: str) -> Path:
    target = ARGO_DIR / Path(relative_path).name.replace(".nc", "_prof.nc")
    if target.exists():
        LOG.info("Already present: %s", target.name)
        return target
    target.parent.mkdir(parents=True, exist_ok=True)
    url = FTP_ROOT + relative_path
    temporary = target.with_suffix(target.suffix + ".part")
    request = urllib.request.Request(url, headers={"User-Agent": "OceanEmbed/1.0"})
    try:
        with urllib.request.urlopen(request, timeout=120, context=HTTPS_CONTEXT) as response, temporary.open("wb") as output:
            while chunk := response.read(1024 * 1024):
                output.write(chunk)
        temporary.replace(target)
    except Exception:
        temporary.unlink(missing_ok=True)
        raise
    LOG.info("Downloaded: %s", target.name)
    return target


def main() -> int:
    args = parse_args()
    if args.days < 1 or args.max_profiles < 1:
        raise SystemExit("--days and --max-profiles must be positive")

    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
    cutoff = datetime.now(timezone.utc) - timedelta(days=args.days)
    matches = [row for row in fetch_index() if datetime.fromisoformat(row["parsed_date"]) >= cutoff]
    matches.sort(key=lambda row: row["parsed_date"], reverse=True)
    matches = matches[: args.max_profiles]
    LOG.info("Found %d matching profiles in the SIH domain", len(matches))

    if args.dry_run:
        for row in matches:
            LOG.info("%s %sN %sE %s", row["file"], row["latitude"], row["longitude"], row["date"])
        return 0

    for row in matches:
        try:
            download_profile(row["file"])
        except Exception as exc:
            LOG.warning("Skipping %s: %s", row["file"], exc)

    qc_df, raw_df = process_argo_files()
    save_outputs(qc_df, raw_df)
    LOG.info("Argo update complete: %d raw, %d QC-passed profiles", len(raw_df), len(qc_df))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
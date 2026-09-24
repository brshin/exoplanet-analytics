"""Download the NASA composite catalog, clean it, and write api/planets.json.

Run weekly (GitHub Action) or by hand:

    python scripts/refresh_planets.py
"""

from pathlib import Path

import pandas as pd
import requests

# One composite row per planet. Mass and period can come from different papers.
TAP_URL = "https://exoplanetarchive.ipac.caltech.edu/TAP/sync?query=select+pl_name,pl_bmasse,pl_orbper+from+pscomppars&format=json"
PLANETS_PATH = Path(__file__).resolve().parent.parent / "api" / "planets.json"


def refresh_planets(path: Path = PLANETS_PATH) -> int:
    response = requests.get(TAP_URL, timeout=120)
    response.raise_for_status()

    df = pd.DataFrame(response.json())
    df["pl_bmasse"] = pd.to_numeric(df["pl_bmasse"], errors="coerce")
    df["pl_orbper"] = pd.to_numeric(df["pl_orbper"], errors="coerce")
    df = df.dropna().drop_duplicates(subset="pl_name")

    path.parent.mkdir(parents=True, exist_ok=True)
    df.to_json(path, orient="records")
    return len(df)


if __name__ == "__main__":
    count = refresh_planets()
    print(f"Wrote {count} planets to {PLANETS_PATH}")

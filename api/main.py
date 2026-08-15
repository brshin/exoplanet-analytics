import os
import time
from pathlib import Path

import pandas as pd
import requests
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from openai import OpenAI
from pydantic import BaseModel

# Same key you used in .streamlit/secrets.toml — now an env var so React never sees it.
load_dotenv(Path(__file__).resolve().parent / ".env")
client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

app = FastAPI()

# React (Vite) runs on :5173; the API on :8000. Browsers block that unless we allow it.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Same TAP query as app.py
targetUrl = "https://exoplanetarchive.ipac.caltech.edu/TAP/sync?query=select+pl_name,pl_bmasse,pl_orbper+from+ps&format=json"

# NASA updates ~weekly. Cache the cleaned table in this process so each page load
# does not re-download the full TAP dump.
_cache = {"dfUnique": None, "fetched_at": 0}
CACHE_TTL_SECONDS = 60 * 60 * 24


def load_planets():
    now = time.time()
    if _cache["dfUnique"] is not None and now - _cache["fetched_at"] < CACHE_TTL_SECONDS:
        return _cache["dfUnique"]

    response = requests.get(targetUrl)

    if response.status_code != 200:
        print("Failed to connect.")
        raise HTTPException(status_code=502, detail="Failed to connect to NASA Exoplanet Archive.")

    print("Connection successful!")

    raw_data = response.json()

    df = pd.DataFrame(raw_data)

    df["pl_bmasse"] = pd.to_numeric(df["pl_bmasse"], errors="coerce")
    df["pl_orbper"] = pd.to_numeric(df["pl_orbper"], errors="coerce")

    df = df.dropna()

    print(df)

    dfUnique = df.drop_duplicates(subset="pl_name")
    print(dfUnique)

    _cache["dfUnique"] = dfUnique
    _cache["fetched_at"] = now
    return dfUnique


@app.get("/planets")
def get_planets():
    dfUnique = load_planets()
    return dfUnique.to_dict(orient="records")


class AnalyzeRequest(BaseModel):
    selectedPlanet: str


@app.post("/analyze")
def analyze(body: AnalyzeRequest):
    dfUnique = load_planets()
    selectedPlanet = body.selectedPlanet

    match = dfUnique.loc[dfUnique["pl_name"] == selectedPlanet]
    if match.empty:
        raise HTTPException(status_code=404, detail="Planet not found.")

    selectedPlanetMass = match["pl_bmasse"].values[0]
    print(selectedPlanetMass)

    selectedPlanetOrbitalPeriod = match["pl_orbper"].values[0]
    print(selectedPlanetOrbitalPeriod)

    prompt = f"Act as a NASA astrophysicist. I am analyzing exoplanet {selectedPlanet}. It has a mass of {selectedPlanetMass} Earth masses and an orbital period of {selectedPlanetOrbitalPeriod} days. Give me a 2-sentence scientific hypothesis of what its climate or environment might be like."

    response = client.chat.completions.create(
        model="gpt-3.5-turbo",
        messages=[{"role": "user", "content": prompt}],
    )

    aiSummary = response.choices[0].message.content
    return {"aiSummary": aiSummary}

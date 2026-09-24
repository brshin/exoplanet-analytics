import os
from pathlib import Path

import pandas as pd
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from openai import OpenAI
from pydantic import BaseModel

load_dotenv(Path(__file__).resolve().parent / ".env")

CORS_ORIGINS = [
    origin.strip()
    for origin in os.getenv(
        "CORS_ORIGINS",
        "http://localhost:5173,http://127.0.0.1:5173",
    ).split(",")
    if origin.strip()
]

app = FastAPI()

# React (Vite) and the API are different origins. Allowlist comes from CORS_ORIGINS.
app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Written by scripts/refresh_planets.py. The request path never calls NASA.
PLANETS_PATH = Path(__file__).resolve().parent / "planets.json"
_cache = {"dfUnique": None, "mtime": None}


def load_planets():
    if not PLANETS_PATH.is_file():
        raise HTTPException(
            status_code=503,
            detail="Planet catalog is missing. Run python scripts/refresh_planets.py.",
        )

    mtime = PLANETS_PATH.stat().st_mtime
    if _cache["dfUnique"] is not None and _cache["mtime"] == mtime:
        return _cache["dfUnique"]

    dfUnique = pd.read_json(PLANETS_PATH)
    _cache["dfUnique"] = dfUnique
    _cache["mtime"] = mtime
    return dfUnique


@app.get("/planets")
def get_planets():
    dfUnique = load_planets()
    return dfUnique.to_dict(orient="records")


class AnalyzeRequest(BaseModel):
    selectedPlanet: str


@app.post("/analyze")
def analyze(body: AnalyzeRequest):
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        raise HTTPException(status_code=503, detail="OPENAI_API_KEY is not set.")

    dfUnique = load_planets()
    selectedPlanet = body.selectedPlanet

    match = dfUnique.loc[dfUnique["pl_name"] == selectedPlanet]
    if match.empty:
        raise HTTPException(status_code=404, detail="Planet not found.")

    selectedPlanetMass = match["pl_bmasse"].values[0]
    selectedPlanetOrbitalPeriod = match["pl_orbper"].values[0]

    prompt = f"Act as a NASA astrophysicist. I am analyzing exoplanet {selectedPlanet}. It has a mass of {selectedPlanetMass} Earth masses and an orbital period of {selectedPlanetOrbitalPeriod} days. Give me a 2-sentence scientific hypothesis of what its climate or environment might be like."

    client = OpenAI(api_key=api_key)
    response = client.chat.completions.create(
        model="gpt-3.5-turbo",
        messages=[{"role": "user", "content": prompt}],
    )

    aiSummary = response.choices[0].message.content
    return {"aiSummary": aiSummary}

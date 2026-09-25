import os
import time
from collections import defaultdict, deque
from pathlib import Path

import pandas as pd
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, Request
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

ANALYZE_LIMIT = 5
ANALYZE_WINDOW_SECONDS = 60 * 60
_analyze_hits = defaultdict(deque)


def _client_ip(request: Request) -> str:
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


def _allow_analyze(ip: str) -> bool:
    now = time.time()
    hits = _analyze_hits[ip]
    while hits and now - hits[0] >= ANALYZE_WINDOW_SECONDS:
        hits.popleft()
    if len(hits) >= ANALYZE_LIMIT:
        return False
    hits.append(now)
    return True


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


ANALYZE_SYSTEM_PROMPT = """Write exactly two sentences for a public exoplanet chart.
Sentence 1: classify the planet from mass only as rocky, super-Earth, ice giant, or gas giant.
Sentence 2: compare the orbital period to Earth's 365 days (much shorter, similar, or much longer).
Do not mention atmosphere, temperature, climate, the host star, or habitability.
Do not add a third sentence."""


def _prompt_number(n):
    value = float(n)
    if value >= 100:
        return f"{value:,.1f}"
    if value >= 1:
        return f"{value:,.2f}"
    return f"{value:,.3f}"


@app.post("/analyze")
def analyze(request: Request, body: AnalyzeRequest):
    if not _allow_analyze(_client_ip(request)):
        raise HTTPException(
            status_code=429,
            detail="Too many AI requests. Try again in an hour.",
        )

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

    user_prompt = (
        f"Planet: {selectedPlanet}\n"
        f"Mass: {_prompt_number(selectedPlanetMass)} Earth masses\n"
        f"Orbital period: {_prompt_number(selectedPlanetOrbitalPeriod)} days"
    )

    client = OpenAI(api_key=api_key)
    response = client.chat.completions.create(
        model="gpt-4o-mini",
        temperature=0.2,
        max_tokens=80,
        messages=[
            {"role": "system", "content": ANALYZE_SYSTEM_PROMPT},
            {"role": "user", "content": user_prompt},
        ],
    )

    aiSummary = response.choices[0].message.content
    return {"aiSummary": aiSummary}

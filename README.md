# Exoplanet Analytics

An interactive dashboard for confirmed exoplanets: mass vs. orbital period on a log-log chart, plus an optional AI hypothesis for a selected planet.

**[Live demo](https://exoplanet-analytics.vercel.app/)** — the catalog is a saved file, so the chart does not wait on NASA. A cold Render instance can still take a moment to wake before the API answers.

> AI output is speculative and for exploration only. It is not a scientific assessment.

## Features

- Serves `pl_name`, `pl_bmasse`, and `pl_orbper` from `api/planets.json`
- A weekly script pulls the [NASA Exoplanet Archive](https://exoplanetarchive.ipac.caltech.edu/) TAP `pscomppars` table (one composite row per planet), drops rows missing a mass or period, and writes one row per planet name
- Interactive Plotly scatter (log mass vs. log period) with hover labels
- Planet selector with formatted mass and orbital-period metrics
- Optional OpenAI (`gpt-3.5-turbo`) 2-sentence climate/environment hypothesis, capped at 5 requests per IP per hour

## Architecture

```
React (Vercel)                          FastAPI (Render)
  GET  /planets  ─────────────────────►  api/planets.json
  POST /analyze  ─────────────────────►  OpenAI (key stays on the server)

Weekly GitHub Action
  NASA TAP → pandas cleanup → commit api/planets.json
```

Locally the same split runs at `localhost:5173` → `localhost:8000`. The browser never receives the OpenAI key.

| Layer | Stack |
| --- | --- |
| UI | React, Vite, Plotly.js |
| API | FastAPI, pandas (reads the saved catalog) |
| Catalog refresh | requests, pandas, GitHub Actions |
| Data | NASA Exoplanet Archive TAP `pscomppars`, saved as `api/planets.json` |
| AI | OpenAI `gpt-3.5-turbo` |
| Hosting | Vercel (frontend), Render (API) |

```
api/main.py              FastAPI: read api/planets.json, OpenAI
api/planets.json          cleaned catalog (name, mass, period)
scripts/refresh_planets.py  weekly TAP fetch, cleanup, and JSON write
api/.env.example       OPENAI_API_KEY, CORS_ORIGINS
frontend/              React UI
frontend/.env.example  VITE_API_URL (defaults to http://localhost:8000)
```

## Local setup

**API**

```bash
python3.13 -m venv .venv
source .venv/bin/activate
pip install -r api/requirements.txt
cp api/.env.example api/.env   # set OPENAI_API_KEY
uvicorn api.main:app --reload --reload-dir api --port 8000
```

**Frontend** (second terminal)

```bash
cd frontend
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173). `/planets` reads `api/planets.json`. Refresh that file with `python scripts/refresh_planets.py`. A GitHub Action runs the same script every Monday at 16:00 UTC.

## Environment variables

Local defaults work without a frontend `.env`. Production:

| Where | Variable | Value |
| --- | --- | --- |
| Render | `OPENAI_API_KEY` | server-side secret |
| Render | `CORS_ORIGINS` | `https://exoplanet-analytics.vercel.app` |
| Vercel (set before build) | `VITE_API_URL` | `https://exoplanet-api-rpsl.onrender.com` |

`VITE_API_URL` is inlined at build time. `CORS_ORIGINS` is a comma-separated list of allowed frontend origins. Locally, put `OPENAI_API_KEY` in `api/.env`. That file is gitignored and is never sent to the browser.

## Data source

TAP query against Planetary Systems Composite Parameters (`pscomppars`):

```
select pl_name, pl_bmasse, pl_orbper from pscomppars
```

`pl_bmasse` is planetary mass or Mass·sin(i) in Earth masses; `pl_orbper` is orbital period in days. `pscomppars` keeps one row per planet and fills each column from the best available reference, so a mass from one paper can sit next to a period from another. `scripts/refresh_planets.py` drops rows that are missing either value and writes one row per planet name to `api/planets.json`. The NASA Exoplanet Archive adds planets about weekly, which is why the refresh job runs weekly.

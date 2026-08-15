# Exoplanet Analytics

An interactive dashboard for confirmed exoplanets: mass vs. orbital period on a log-log chart, plus an optional AI hypothesis for a selected planet.

**[Live demo](https://exoplanet-analytics.vercel.app/)** — the first load can take up to a minute while the catalog is fetched from NASA.

> AI output is speculative and for exploration only. It is not a scientific assessment.

## Features

- Ingests `pl_name`, `pl_bmasse`, and `pl_orbper` from the [NASA Exoplanet Archive](https://exoplanetarchive.ipac.caltech.edu/) TAP `ps` table
- Cleans non-numeric values and keeps one row per planet name
- Interactive Plotly scatter (log mass vs. log period) with hover labels
- Planet selector with formatted mass and orbital-period metrics
- Optional OpenAI (`gpt-3.5-turbo`) 2-sentence climate/environment hypothesis

## Architecture

```
React (Vercel)                          FastAPI (Render)
  GET  /planets  ─────────────────────►  NASA TAP → pandas → 24h cache
  POST /analyze  ─────────────────────►  OpenAI (key stays on the server)
```

Locally the same split runs at `localhost:5173` → `localhost:8000`. The browser never receives the OpenAI key.

| Layer | Stack |
| --- | --- |
| UI | React, Vite, Plotly.js |
| API | FastAPI, pandas, requests |
| Data | NASA Exoplanet Archive TAP |
| AI | OpenAI `gpt-3.5-turbo` |
| Hosting | Vercel (frontend), Render (API) |

```
api/main.py            FastAPI: TAP fetch, cleanup, cache, OpenAI
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

Open [http://localhost:5173](http://localhost:5173). The first `/planets` call downloads the TAP dump and caches it in the API process for 24 hours.

## Environment variables

Local defaults work without a frontend `.env`. Production:

| Where | Variable | Value |
| --- | --- | --- |
| Render | `OPENAI_API_KEY` | server-side secret |
| Render | `CORS_ORIGINS` | `https://exoplanet-analytics.vercel.app` |
| Vercel (set before build) | `VITE_API_URL` | `https://exoplanet-api-rpsl.onrender.com` |

`VITE_API_URL` is inlined at build time. `CORS_ORIGINS` is a comma-separated list of allowed frontend origins.

## Data source

TAP query against Planetary Systems (`ps`):

```
select pl_name, pl_bmasse, pl_orbper from ps
```

`pl_bmasse` is planetary mass or Mass·sin(i) in Earth masses; `pl_orbper` is orbital period in days. The query does not filter by solution type or default flag; after cleaning, the app keeps one row per planet name.

## Legacy

`app.py` is the original Streamlit app (`streamlit run app.py`). `exoplanet.py` is a standalone matplotlib plot and is not used by the dashboard.

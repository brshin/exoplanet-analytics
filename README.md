# Exoplanet Analytics

Fetches exoplanet parameters from the [NASA Exoplanet Archive](https://exoplanetarchive.ipac.caltech.edu/) TAP service, cleans the data with pandas, and plots planetary mass vs. orbital period on an interactive log-log chart. Selecting a planet sends its mass and orbital period to OpenAI (`gpt-3.5-turbo`) for a short, speculative climate/environment hypothesis.

The UI is a React app. FastAPI serves the NASA data and the OpenAI call so the API key never goes to the browser.

> **Note:** AI output is speculative and for exploration only—not a scientific assessment.

## Architecture

```
React (localhost:5173)
  GET  /planets   → cleaned planet rows (for the dropdown + chart)
  POST /analyze   → AI hypothesis for the selected planet
        ↓
FastAPI (localhost:8000)
  NASA TAP fetch → pandas clean/dedupe → 24h in-memory cache
  OpenAI call (key in api/.env)
```

`app.py` is the original Streamlit version (same pipeline). Left in place so you can compare.

## Project structure

```
api/main.py           # FastAPI: same TAP + pandas + OpenAI logic as app.py
api/.env.example      # copy to api/.env and add your OpenAI key
frontend/.env.example # optional; defaults to http://localhost:8000
frontend/             # React UI (Vite)
app.py                # Original Streamlit app
exoplanet.py          # Standalone matplotlib plot (unchanged)
```

## Setup

### API

```bash
python3.13 -m venv .venv
source .venv/bin/activate
pip install -r api/requirements.txt
cp api/.env.example api/.env   # then set OPENAI_API_KEY
uvicorn api.main:app --reload --reload-dir api --port 8000
```

### Frontend (second terminal)

```bash
cd frontend
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173).

The first `/planets` request downloads the NASA TAP dump and caches it in the API process for 24 hours.

## Environment variables

Local defaults work without extra frontend config. For Vercel + Railway:

| Where | Variable | Example |
| --- | --- | --- |
| Railway (API) | `OPENAI_API_KEY` | `sk-...` |
| Railway (API) | `CORS_ORIGINS` | `https://your-app.vercel.app` |
| Vercel (frontend, set before build) | `VITE_API_URL` | `https://your-api.up.railway.app` |

`VITE_API_URL` is baked in at build time. `CORS_ORIGINS` is a comma-separated list of allowed frontend origins.

## Original Streamlit app

```bash
pip install -r requirements.txt
streamlit run app.py
```

Secrets live in `.streamlit/secrets.toml` (gitignored).

## Data source

NASA Exoplanet Archive TAP sync query against the Planetary Systems (`ps`) table:

```
select pl_name, pl_bmasse, pl_orbper from ps
```

`pl_bmasse` is planetary mass or Mass·sin(i) in Earth masses; `pl_orbper` is orbital period in days. The query does not filter by solution type or default flag; the app keeps one row per planet name after cleaning.

# Exoplanet Analytics Dashboard

A Streamlit app that fetches exoplanet parameters from the [NASA Exoplanet Archive](https://exoplanetarchive.ipac.caltech.edu/) TAP service, cleans the data with pandas, and plots planetary mass vs. orbital period on an interactive log-log chart. Selecting a planet sends its mass and orbital period to OpenAI (`gpt-3.5-turbo`) for a short, speculative climate/environment hypothesis.

**[Live demo](https://exoplanet-pipeline.streamlit.app/)**

## Features

- Ingests JSON from the NASA Exoplanet Archive TAP endpoint (`ps` table: `pl_name`, `pl_bmasse`, `pl_orbper`)
- Cleans missing or non-numeric values and deduplicates by planet name
- Interactive Plotly scatter plot (log mass vs. log orbital period) with hover labels
- Planet selector with mass and orbital period metrics
- Optional OpenAI-generated 2-sentence hypothesis based on the selected planet’s mass and period

> **Note:** AI output is speculative and for exploration only—not a scientific assessment.

## Tech stack

| Area | Libraries |
| --- | --- |
| App / UI | `streamlit` |
| Data fetch & clean | `requests`, `pandas` |
| Visualization | `plotly` |
| AI hypothesis | `openai` (`gpt-3.5-turbo`) |
| Standalone plot script | `matplotlib` (see `exoplanet.py`; not required for the Streamlit app) |

## Project structure

```
app.py           # Streamlit dashboard (main app)
exoplanet.py     # Standalone matplotlib scatter plot (no Streamlit/OpenAI)
requirements.txt # Dependencies for the Streamlit app
```

## Setup

1. Clone the repo and install dependencies:

```bash
pip install -r requirements.txt
```

2. Add an OpenAI API key in `.streamlit/secrets.toml`:

```toml
OPENAI_API_KEY = "your-key-here"
```

3. Run the app:

```bash
streamlit run app.py
```

To regenerate the static mass vs. period plot without Streamlit:

```bash
pip install matplotlib
python exoplanet.py
```

## Data source

NASA Exoplanet Archive TAP sync query against the Planetary Systems (`ps`) table:

```
select pl_name, pl_bmasse, pl_orbper from ps
```

`pl_bmasse` is planetary mass or Mass·sin(i) in Earth masses; `pl_orbper` is orbital period in days. The query does not filter by solution type or default flag; the app keeps one row per planet name after cleaning.
